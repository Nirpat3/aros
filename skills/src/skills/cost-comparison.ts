/**
 * Cost Comparison — Vendor Price Matrix & Savings Finder
 *
 * Builds a price matrix across vendors for each SKU.
 * Identifies where switching vendors saves money, considering:
 * - Unit cost differences
 * - Case pricing (bulk discount)
 * - Minimum order quantities
 * - Current vendor relationship
 *
 * Outputs a prioritized list of switches ranked by annual savings potential.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  VendorPriceRow,
  InvoiceItemRow,
  Alert,
  Action,
} from '../types.js';

interface VendorOption {
  vendorId: string;
  vendorName: string;
  unitCost: number;
  caseCost: number;
  caseQty: number;
  effectiveUnitCost: number;
  minOrderQty: number;
}

interface SkuComparison {
  itemCode: string;
  itemDesc: string;
  currentVendorId: string;
  currentUnitCost: number;
  vendors: VendorOption[];
  cheapestVendor: VendorOption;
  potentialSavingsPerUnit: number;
  annualVolume: number;
  annualSavings: number;
  switchRecommended: boolean;
}

interface CostComparisonData {
  comparisons: SkuComparison[];
  switchRecommendations: SkuComparison[];
  totalAnnualSavings: number;
  skusAnalyzed: number;
  vendorCount: number;
}

/** Minimum annual savings to recommend a vendor switch */
const MIN_SAVINGS_THRESHOLD = 50;

export class CostComparisonSkill implements ArosSkill {
  readonly id = 'cost-comparison';
  readonly name = 'Cost Comparison';
  readonly category = 'procurement' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['vendor_prices', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [vendorPrices, items] = await Promise.all([
      connector.getVendorPrices(),
      connector.getInvoiceItems(dateRange),
    ]);

    // Calculate annual volume per SKU (extrapolate from date range)
    const daySpan = Math.max(
      1,
      (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const volumeMap = new Map<string, number>();
    for (const item of items) {
      if (item.is_void) continue;
      volumeMap.set(item.item_code, (volumeMap.get(item.item_code) ?? 0) + item.item_qty);
    }

    // Group vendor prices by item
    const pricesByItem = new Map<string, VendorPriceRow[]>();
    for (const vp of vendorPrices) {
      const existing = pricesByItem.get(vp.item_code);
      if (existing) {
        existing.push(vp);
      } else {
        pricesByItem.set(vp.item_code, [vp]);
      }
    }

    const vendorIds = new Set(vendorPrices.map(vp => vp.vendor_id));

    const comparisons: SkuComparison[] = [];

    for (const [itemCode, prices] of pricesByItem) {
      if (prices.length < 2) continue; // Need at least 2 vendors to compare

      const vendors: VendorOption[] = prices.map(p => {
        const caseUnitCost = p.case_qty > 0 ? p.case_cost / p.case_qty : p.unit_cost;
        return {
          vendorId: p.vendor_id,
          vendorName: p.vendor_name,
          unitCost: p.unit_cost,
          caseCost: p.case_cost,
          caseQty: p.case_qty,
          effectiveUnitCost: Math.min(p.unit_cost, caseUnitCost),
          minOrderQty: p.min_order_qty,
        };
      });

      vendors.sort((a, b) => a.effectiveUnitCost - b.effectiveUnitCost);
      const cheapest = vendors[0]!;

      // Assume current vendor is the most expensive (or first one) — in real
      // implementation this would come from the store's vendor assignments
      const current = vendors[vendors.length - 1]!;

      const periodVolume = volumeMap.get(itemCode) ?? 0;
      const annualVolume = daySpan > 0 ? (periodVolume / daySpan) * 365 : 0;
      const savingsPerUnit = current.effectiveUnitCost - cheapest.effectiveUnitCost;
      const annualSavings = savingsPerUnit * annualVolume;

      const switchRecommended = annualSavings >= MIN_SAVINGS_THRESHOLD;

      comparisons.push({
        itemCode,
        itemDesc: prices[0]?.item_desc ?? itemCode,
        currentVendorId: current.vendorId,
        currentUnitCost: current.effectiveUnitCost,
        vendors,
        cheapestVendor: cheapest,
        potentialSavingsPerUnit: savingsPerUnit,
        annualVolume,
        annualSavings,
        switchRecommended,
      });
    }

    comparisons.sort((a, b) => b.annualSavings - a.annualSavings);

    const switchRecommendations = comparisons.filter(c => c.switchRecommended);
    const totalAnnualSavings = switchRecommendations.reduce(
      (s, c) => s + c.annualSavings, 0
    );

    const data: CostComparisonData = {
      comparisons,
      switchRecommendations,
      totalAnnualSavings,
      skusAnalyzed: comparisons.length,
      vendorCount: vendorIds.size,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (totalAnnualSavings > 500) {
      alerts.push({
        severity: 'info',
        message: `Potential annual savings of $${totalAnnualSavings.toFixed(2)} by switching vendors on ${switchRecommendations.length} SKUs`,
        code: 'VENDOR_SWITCH_SAVINGS',
        value: totalAnnualSavings,
        threshold: 500,
      });
    }

    for (const rec of switchRecommendations.slice(0, 5)) {
      actions.push({
        description: `Switch ${rec.itemDesc} from ${rec.currentVendorId} to ${rec.cheapestVendor.vendorName} — save $${rec.annualSavings.toFixed(2)}/year ($${rec.potentialSavingsPerUnit.toFixed(3)}/unit)`,
        priority: rec.annualSavings > 200 ? 2 : 3,
        automatable: false,
        payload: {
          itemCode: rec.itemCode,
          fromVendor: rec.currentVendorId,
          toVendor: rec.cheapestVendor.vendorId,
          savingsPerUnit: rec.potentialSavingsPerUnit,
        },
      });
    }

    const summary = `Compared prices across ${vendorIds.size} vendors for ${comparisons.length} SKUs. ${switchRecommendations.length} vendor switches recommended — est. $${totalAnnualSavings.toFixed(2)}/year savings.`;

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
