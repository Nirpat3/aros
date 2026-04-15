/**
 * Dead Item Killer — Zero/Low Velocity SKU Management
 *
 * Identifies items with zero or near-zero sales velocity over
 * configurable time windows (30, 60, 90+ days).
 *
 * For each dead item, proposes an action:
 * - Markdown: reduce price to move it
 * - Return to vendor: if return policy allows
 * - Discontinue: remove from active inventory
 * - Donate: tax write-off for unsellable goods
 *
 * Calculates the cash tied up in dead inventory and the opportunity
 * cost of shelf space occupied by non-movers.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InventoryRow,
  InvoiceItemRow,
  Alert,
  Action,
} from '../types.js';

interface DeadItem {
  itemCode: string;
  itemDesc: string;
  category: string;
  qtyOnHand: number;
  unitCost: number;
  retailPrice: number;
  inventoryValue: number;
  retailValue: number;
  daysSinceLastSold: number | null;
  /** Units sold in the analysis period */
  unitsSoldInPeriod: number;
  dailyVelocity: number;
  /** 30/60/90+ day bucket */
  ageBucket: '30-day' | '60-day' | '90-day' | '90-plus';
  recommendedAction: 'markdown' | 'return-to-vendor' | 'discontinue' | 'donate';
  actionReason: string;
  /** Suggested markdown price (50% off retail) */
  markdownPrice: number | null;
}

interface DeadItemKillerData {
  deadItems: DeadItem[];
  totalDeadSkus: number;
  totalDeadInventoryValue: number;
  totalDeadRetailValue: number;
  by30Day: DeadItem[];
  by60Day: DeadItem[];
  by90Day: DeadItem[];
  by90Plus: DeadItem[];
  byCategory: Record<string, { count: number; value: number }>;
  potentialRecovery: number;
}

function daysBetween(dateStr: string, today: string): number | null {
  if (!dateStr) return null;
  const d1 = new Date(dateStr).getTime();
  const d2 = new Date(today).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

export class DeadItemKillerSkill implements ArosSkill {
  readonly id = 'dead-item-killer';
  readonly name = 'Dead Item Killer';
  readonly category = 'inventory' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['inventory', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, today } = context;

    const [inventory, items] = await Promise.all([
      connector.getInventory(),
      connector.getInvoiceItems(dateRange),
    ]);

    const daySpan = Math.max(
      1,
      (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Sales volume per SKU in period
    const soldMap = new Map<string, number>();
    for (const item of items) {
      if (item.is_void) continue;
      soldMap.set(item.item_code, (soldMap.get(item.item_code) ?? 0) + item.item_qty);
    }

    const deadItems: DeadItem[] = [];

    for (const inv of inventory) {
      if (inv.qty_on_hand <= 0) continue;

      const daysSinceLastSold = daysBetween(inv.last_sold_date, today);
      const unitsSoldInPeriod = soldMap.get(inv.item_code) ?? 0;
      const dailyVelocity = unitsSoldInPeriod / daySpan;

      // Determine if item is "dead" — no sales in 30+ days or < 1 unit/month
      const isDead =
        (daysSinceLastSold !== null && daysSinceLastSold >= 30) ||
        (daysSinceLastSold === null && unitsSoldInPeriod === 0);

      if (!isDead) continue;

      // Age bucket
      let ageBucket: DeadItem['ageBucket'];
      if (daysSinceLastSold === null || daysSinceLastSold >= 90) {
        ageBucket = '90-plus';
      } else if (daysSinceLastSold >= 60) {
        ageBucket = '90-day';
      } else if (daysSinceLastSold >= 45) {
        ageBucket = '60-day';
      } else {
        ageBucket = '30-day';
      }

      // Recommended action based on age and value
      let recommendedAction: DeadItem['recommendedAction'];
      let actionReason: string;
      let markdownPrice: number | null = null;

      if (ageBucket === '30-day') {
        recommendedAction = 'markdown';
        markdownPrice = Math.round(inv.retail_price * 0.75 * 100) / 100; // 25% off
        actionReason = 'Recent slow-mover — try markdown to stimulate sales';
      } else if (ageBucket === '60-day') {
        recommendedAction = 'markdown';
        markdownPrice = Math.round(inv.retail_price * 0.5 * 100) / 100; // 50% off
        actionReason = '60+ days without sale — aggressive markdown recommended';
      } else if (inv.vendor_id && ageBucket === '90-day') {
        recommendedAction = 'return-to-vendor';
        actionReason = '90+ days dead — check vendor return policy';
      } else if (inv.unit_cost * inv.qty_on_hand < 10) {
        recommendedAction = 'donate';
        actionReason = 'Low value dead stock — donate for tax write-off';
      } else {
        recommendedAction = 'discontinue';
        actionReason = 'Long-term dead stock — remove from active inventory';
      }

      deadItems.push({
        itemCode: inv.item_code,
        itemDesc: inv.item_desc,
        category: inv.category,
        qtyOnHand: inv.qty_on_hand,
        unitCost: inv.unit_cost,
        retailPrice: inv.retail_price,
        inventoryValue: inv.qty_on_hand * inv.unit_cost,
        retailValue: inv.qty_on_hand * inv.retail_price,
        daysSinceLastSold,
        unitsSoldInPeriod,
        dailyVelocity,
        ageBucket,
        recommendedAction,
        actionReason,
        markdownPrice,
      });
    }

    deadItems.sort((a, b) => b.inventoryValue - a.inventoryValue);

    const by30Day = deadItems.filter((d) => d.ageBucket === '30-day');
    const by60Day = deadItems.filter((d) => d.ageBucket === '60-day');
    const by90Day = deadItems.filter((d) => d.ageBucket === '90-day');
    const by90Plus = deadItems.filter((d) => d.ageBucket === '90-plus');

    const totalDeadInventoryValue = deadItems.reduce((s, d) => s + d.inventoryValue, 0);
    const totalDeadRetailValue = deadItems.reduce((s, d) => s + d.retailValue, 0);

    // Category breakdown
    const byCategory: Record<string, { count: number; value: number }> = {};
    for (const d of deadItems) {
      const cat = byCategory[d.category];
      if (cat) {
        cat.count++;
        cat.value += d.inventoryValue;
      } else {
        byCategory[d.category] = { count: 1, value: d.inventoryValue };
      }
    }

    // Potential recovery from markdowns
    const markdownItems = deadItems.filter((d) => d.markdownPrice !== null);
    const potentialRecovery = markdownItems.reduce((s, d) => s + d.markdownPrice! * d.qtyOnHand, 0);

    const data: DeadItemKillerData = {
      deadItems,
      totalDeadSkus: deadItems.length,
      totalDeadInventoryValue,
      totalDeadRetailValue,
      by30Day,
      by60Day,
      by90Day,
      by90Plus,
      byCategory,
      potentialRecovery,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (totalDeadInventoryValue > 500) {
      alerts.push({
        severity: 'warning',
        message: `$${totalDeadInventoryValue.toFixed(2)} tied up in ${deadItems.length} dead SKUs — cash sitting on shelves`,
        code: 'HIGH_DEAD_STOCK_VALUE',
        value: totalDeadInventoryValue,
        threshold: 500,
      });
    }

    if (by90Plus.length > 0) {
      const value90 = by90Plus.reduce((s, d) => s + d.inventoryValue, 0);
      alerts.push({
        severity: 'critical',
        message: `${by90Plus.length} items haven't sold in 90+ days ($${value90.toFixed(2)} at cost)`,
        code: 'DEAD_STOCK_90_PLUS',
        value: by90Plus.length,
      });
    }

    // Group actions by type
    const markdownCount = deadItems.filter((d) => d.recommendedAction === 'markdown').length;
    const returnCount = deadItems.filter((d) => d.recommendedAction === 'return-to-vendor').length;
    const discontinueCount = deadItems.filter((d) => d.recommendedAction === 'discontinue').length;
    const donateCount = deadItems.filter((d) => d.recommendedAction === 'donate').length;

    if (markdownCount > 0) {
      actions.push({
        description: `Markdown ${markdownCount} slow-movers — potential recovery $${potentialRecovery.toFixed(2)}`,
        priority: 2,
        automatable: true,
        payload: {
          items: markdownItems
            .slice(0, 20)
            .map((d) => ({ code: d.itemCode, markdownPrice: d.markdownPrice })),
        },
      });
    }

    if (returnCount > 0) {
      actions.push({
        description: `Contact vendors about returning ${returnCount} dead items`,
        priority: 2,
        automatable: false,
      });
    }

    if (discontinueCount > 0) {
      actions.push({
        description: `Discontinue ${discontinueCount} long-term dead items — remove from active inventory`,
        priority: 3,
        automatable: false,
      });
    }

    if (donateCount > 0) {
      actions.push({
        description: `Donate ${donateCount} low-value dead items for tax write-off`,
        priority: 4,
        automatable: false,
      });
    }

    const summary = `${deadItems.length} dead SKUs identified ($${totalDeadInventoryValue.toFixed(2)} at cost). Breakdown: ${by30Day.length} @ 30d, ${by60Day.length} @ 60d, ${by90Day.length} @ 90d, ${by90Plus.length} @ 90+d. Actions: ${markdownCount} markdown, ${returnCount} return, ${discontinueCount} discontinue, ${donateCount} donate.`;

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
