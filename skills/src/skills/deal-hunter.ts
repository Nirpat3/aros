/**
 * Deal Hunter — Vendor Promotion & Deal Scanner
 *
 * Scans vendor promotions, close-out deals, and bulk discounts.
 * Cross-references each deal against the store's actual sales velocity
 * to determine if stocking up makes financial sense.
 *
 * Key insight: A "deal" is only a deal if you can sell through it
 * before the product expires or ties up too much cash.
 *
 * Scoring formula:
 *   dealScore = savingsPct * velocityFit * (1 - overstockRisk)
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  VendorPriceRow,
  InvoiceItemRow,
  InventoryRow,
  Alert,
  Action,
} from '../types.js';

interface DealEvaluation {
  vendorId: string;
  vendorName: string;
  itemCode: string;
  itemDesc: string;
  regularCost: number;
  promoCost: number;
  savingsPct: number;
  dailyVelocity: number;
  currentStock: number;
  /** Days of stock if we buy the promo qty */
  daysOfStockIfBought: number;
  /** Risk of overstock (0-1) */
  overstockRisk: number;
  /** Overall deal quality score (0-100) */
  dealScore: number;
  recommendation: 'buy' | 'skip' | 'review';
  reason: string;
  promoStart: string | null;
  promoEnd: string | null;
  suggestedOrderQty: number;
  estimatedSavings: number;
}

interface DealHunterData {
  deals: DealEvaluation[];
  buyRecommendations: DealEvaluation[];
  skipRecommendations: DealEvaluation[];
  reviewRecommendations: DealEvaluation[];
  totalPotentialSavings: number;
}

/** Max days of stock we'd want to hold from a promo buy */
const MAX_STOCK_DAYS = 60;

export class DealHunterSkill implements ArosSkill {
  readonly id = 'deal-hunter';
  readonly name = 'Deal Hunter';
  readonly category = 'procurement' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['vendor_prices', 'inventory', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, today } = context;

    const [vendorPrices, inventory, items] = await Promise.all([
      connector.getVendorPrices(),
      connector.getInventory(),
      connector.getInvoiceItems(dateRange),
    ]);

    // Calculate velocity per SKU
    const daySpan = Math.max(
      1,
      (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const velocityMap = new Map<string, number>();
    for (const item of items) {
      if (item.is_void) continue;
      velocityMap.set(item.item_code, (velocityMap.get(item.item_code) ?? 0) + item.item_qty);
    }
    // Convert to daily velocity
    for (const [code, qty] of velocityMap) {
      velocityMap.set(code, qty / daySpan);
    }

    // Inventory lookup
    const invMap = new Map(inventory.map((i) => [i.item_code, i]));

    // Find active promos
    const activePromos = vendorPrices.filter((vp) => {
      if (vp.promo_price === null) return false;
      if (vp.promo_start && new Date(vp.promo_start) > new Date(today)) return false;
      if (vp.promo_end && new Date(vp.promo_end) < new Date(today)) return false;
      return vp.promo_price < vp.unit_cost;
    });

    const deals: DealEvaluation[] = activePromos.map((promo) => {
      const dailyVelocity = velocityMap.get(promo.item_code) ?? 0;
      const inv = invMap.get(promo.item_code);
      const currentStock = inv?.qty_on_hand ?? 0;
      const promoCost = promo.promo_price!;
      const savingsPct =
        promo.unit_cost > 0 ? ((promo.unit_cost - promoCost) / promo.unit_cost) * 100 : 0;

      // How much should we order?
      const targetDaysOfStock = Math.min(MAX_STOCK_DAYS, 30);
      const idealOrderQty =
        dailyVelocity > 0 ? Math.ceil(dailyVelocity * targetDaysOfStock) - currentStock : 0;
      const suggestedOrderQty = Math.max(0, Math.max(idealOrderQty, promo.min_order_qty));

      const daysOfStockIfBought =
        dailyVelocity > 0 ? (currentStock + suggestedOrderQty) / dailyVelocity : Infinity;

      // Overstock risk: high if we'd have way more stock than we can move
      const overstockRisk =
        dailyVelocity > 0
          ? Math.min(1, Math.max(0, (daysOfStockIfBought - MAX_STOCK_DAYS) / MAX_STOCK_DAYS))
          : 1;

      // Velocity fit: 1.0 if item sells well, lower if slow/no movement
      const velocityFit = dailyVelocity > 0 ? Math.min(1, dailyVelocity / 2) : 0;

      const dealScore = Math.round((savingsPct / 100) * velocityFit * (1 - overstockRisk) * 100);

      let recommendation: DealEvaluation['recommendation'];
      let reason: string;

      if (dailyVelocity === 0) {
        recommendation = 'skip';
        reason = 'No sales velocity — buying would create dead stock';
      } else if (dealScore >= 30) {
        recommendation = 'buy';
        reason = `Strong deal: ${savingsPct.toFixed(0)}% savings with good velocity (${dailyVelocity.toFixed(1)}/day)`;
      } else if (dealScore >= 10) {
        recommendation = 'review';
        reason = `Moderate deal — check if ${daysOfStockIfBought.toFixed(0)} days of stock is acceptable`;
      } else {
        recommendation = 'skip';
        reason =
          overstockRisk > 0.5
            ? `Overstock risk too high — would have ${daysOfStockIfBought.toFixed(0)} days of stock`
            : `Savings too small relative to inventory risk`;
      }

      const estimatedSavings = suggestedOrderQty * (promo.unit_cost - promoCost);

      return {
        vendorId: promo.vendor_id,
        vendorName: promo.vendor_name,
        itemCode: promo.item_code,
        itemDesc: promo.item_desc,
        regularCost: promo.unit_cost,
        promoCost,
        savingsPct,
        dailyVelocity,
        currentStock,
        daysOfStockIfBought,
        overstockRisk,
        dealScore,
        recommendation,
        reason,
        promoStart: promo.promo_start,
        promoEnd: promo.promo_end,
        suggestedOrderQty,
        estimatedSavings,
      };
    });

    deals.sort((a, b) => b.dealScore - a.dealScore);

    const buyRecommendations = deals.filter((d) => d.recommendation === 'buy');
    const skipRecommendations = deals.filter((d) => d.recommendation === 'skip');
    const reviewRecommendations = deals.filter((d) => d.recommendation === 'review');
    const totalPotentialSavings = buyRecommendations.reduce((s, d) => s + d.estimatedSavings, 0);

    const data: DealHunterData = {
      deals,
      buyRecommendations,
      skipRecommendations,
      reviewRecommendations,
      totalPotentialSavings,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (buyRecommendations.length > 0) {
      alerts.push({
        severity: 'info',
        message: `${buyRecommendations.length} deals worth buying — est. $${totalPotentialSavings.toFixed(2)} savings`,
        code: 'GOOD_DEALS_AVAILABLE',
        value: buyRecommendations.length,
      });
    }

    for (const deal of buyRecommendations.slice(0, 5)) {
      actions.push({
        description: `Buy ${deal.suggestedOrderQty} × ${deal.itemDesc} from ${deal.vendorName} — save $${deal.estimatedSavings.toFixed(2)} (${deal.savingsPct.toFixed(0)}% off)`,
        priority: 2,
        automatable: true,
        payload: {
          vendorId: deal.vendorId,
          itemCode: deal.itemCode,
          orderQty: deal.suggestedOrderQty,
          promoCost: deal.promoCost,
        },
      });
    }

    const summary = `Scanned ${vendorPrices.length} vendor prices, found ${deals.length} active promos. ${buyRecommendations.length} recommended buys ($${totalPotentialSavings.toFixed(2)} potential savings), ${reviewRecommendations.length} to review, ${skipRecommendations.length} to skip.`;

    return {
      skillId: this.id,
      timestamp: new Date().toISOString(),
      summary,
      alerts,
      actions,
      data: data as unknown as Record<string, unknown>,
    };
  }
}
