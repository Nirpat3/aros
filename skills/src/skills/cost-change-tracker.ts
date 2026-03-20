/**
 * Cost Change Tracker — Vendor/Wholesale Cost Monitoring
 *
 * Monitors cost price changes per SKU across deliveries/invoices.
 * Calculates margin erosion when vendor costs rise but retail stays flat.
 * Alerts on margin squeeze so operators can adjust pricing proactively.
 *
 * Different from price-change-monitor: this focuses specifically on the
 * COST side (vendor/wholesale) rather than the retail price side.
 *
 * Key metrics:
 * - Cost change % per SKU over time
 * - Margin erosion: retail price didn't keep up with cost increase
 * - Category-level cost inflation rate
 * - Vendor-level cost trend (which vendors are raising prices fastest)
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceItemRow,
  InvoiceRow,
  Alert,
  Action,
} from '../types.js';

interface CostChangeEvent {
  itemCode: string;
  itemDesc: string;
  category: string;
  vendorId: string;
  oldCost: number;
  newCost: number;
  costChangePct: number;
  currentRetail: number;
  oldMarginPct: number;
  newMarginPct: number;
  marginErosionPct: number;
  firstObservedDate: string;
  lastObservedDate: string;
  /** Is the margin now dangerously low? */
  marginSqueeze: boolean;
}

interface CategoryCostTrend {
  category: string;
  avgCostChangePct: number;
  skuCount: number;
  totalMarginErosion: number;
}

interface VendorCostTrend {
  vendorId: string;
  avgCostChangePct: number;
  skuCount: number;
  skusWithIncrease: number;
}

interface CostChangeTrackerData {
  costChanges: CostChangeEvent[];
  marginSqueezeItems: CostChangeEvent[];
  categoryTrends: CategoryCostTrend[];
  vendorTrends: VendorCostTrend[];
  totalSkusAnalyzed: number;
  skusWithCostChange: number;
  avgCostChangePct: number;
}

/** Margin below this % triggers margin squeeze alert */
const MARGIN_SQUEEZE_THRESHOLD = 10;
/** Cost change above this % triggers an alert */
const COST_CHANGE_ALERT_PCT = 5;

export class CostChangeTrackerSkill implements ArosSkill {
  readonly id = 'cost-change-tracker';
  readonly name = 'Cost Change Tracker';
  readonly category = 'procurement' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoices', 'invoice_items', 'inventory'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, store } = context;

    const [invoices, items, inventory] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getInvoiceItems(dateRange),
      connector.getInventory(),
    ]);

    // Invoice date lookup
    const invoiceMap = new Map<string, InvoiceRow>();
    for (const inv of invoices) {
      invoiceMap.set(inv.invoice_no, inv);
    }

    // Vendor lookup from inventory
    const vendorMap = new Map<string, string>();
    for (const inv of inventory) {
      vendorMap.set(inv.item_code, inv.vendor_id);
    }

    // Group items by SKU, get cost trajectory
    const skuItems = new Map<string, InvoiceItemRow[]>();
    for (const item of items) {
      if (item.is_void) continue;
      const existing = skuItems.get(item.item_code);
      if (existing) {
        existing.push(item);
      } else {
        skuItems.set(item.item_code, [item]);
      }
    }

    const costChanges: CostChangeEvent[] = [];

    for (const [itemCode, txns] of skuItems) {
      // Sort by date
      const sorted = txns.sort((a, b) => {
        const dateA = invoiceMap.get(a.invoice_no)?.invoice_date ?? '';
        const dateB = invoiceMap.get(b.invoice_no)?.invoice_date ?? '';
        return dateA.localeCompare(dateB);
      });

      if (sorted.length < 2) continue;

      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;

      // Only track if cost actually changed
      if (first.cost_price === last.cost_price || first.cost_price <= 0) continue;

      const costChangePct = ((last.cost_price - first.cost_price) / first.cost_price) * 100;

      // Skip trivial changes (< 0.5%)
      if (Math.abs(costChangePct) < 0.5) continue;

      const currentRetail = last.unit_price;
      const oldMarginPct = first.unit_price > 0
        ? ((first.unit_price - first.cost_price) / first.unit_price) * 100
        : 0;
      const newMarginPct = currentRetail > 0
        ? ((currentRetail - last.cost_price) / currentRetail) * 100
        : 0;
      const marginErosionPct = oldMarginPct - newMarginPct;
      const marginSqueeze = newMarginPct < MARGIN_SQUEEZE_THRESHOLD && newMarginPct < store.targetMarginPct;

      costChanges.push({
        itemCode,
        itemDesc: first.item_desc,
        category: first.category,
        vendorId: vendorMap.get(itemCode) ?? 'unknown',
        oldCost: first.cost_price,
        newCost: last.cost_price,
        costChangePct,
        currentRetail,
        oldMarginPct,
        newMarginPct,
        marginErosionPct,
        firstObservedDate: invoiceMap.get(first.invoice_no)?.invoice_date ?? '',
        lastObservedDate: invoiceMap.get(last.invoice_no)?.invoice_date ?? '',
        marginSqueeze,
      });
    }

    costChanges.sort((a, b) => b.marginErosionPct - a.marginErosionPct);
    const marginSqueezeItems = costChanges.filter(c => c.marginSqueeze);

    // Category-level trends
    const catMap = new Map<string, { totalChange: number; totalErosion: number; count: number }>();
    for (const cc of costChanges) {
      const existing = catMap.get(cc.category);
      if (existing) {
        existing.totalChange += cc.costChangePct;
        existing.totalErosion += cc.marginErosionPct;
        existing.count++;
      } else {
        catMap.set(cc.category, {
          totalChange: cc.costChangePct,
          totalErosion: cc.marginErosionPct,
          count: 1,
        });
      }
    }
    const categoryTrends: CategoryCostTrend[] = [...catMap.entries()]
      .map(([category, d]) => ({
        category,
        avgCostChangePct: d.count > 0 ? d.totalChange / d.count : 0,
        skuCount: d.count,
        totalMarginErosion: d.totalErosion,
      }))
      .sort((a, b) => b.avgCostChangePct - a.avgCostChangePct);

    // Vendor-level trends
    const venMap = new Map<string, { totalChange: number; count: number; increases: number }>();
    for (const cc of costChanges) {
      const existing = venMap.get(cc.vendorId);
      if (existing) {
        existing.totalChange += cc.costChangePct;
        existing.count++;
        if (cc.costChangePct > 0) existing.increases++;
      } else {
        venMap.set(cc.vendorId, {
          totalChange: cc.costChangePct,
          count: 1,
          increases: cc.costChangePct > 0 ? 1 : 0,
        });
      }
    }
    const vendorTrends: VendorCostTrend[] = [...venMap.entries()]
      .map(([vendorId, d]) => ({
        vendorId,
        avgCostChangePct: d.count > 0 ? d.totalChange / d.count : 0,
        skuCount: d.count,
        skusWithIncrease: d.increases,
      }))
      .sort((a, b) => b.avgCostChangePct - a.avgCostChangePct);

    const avgCostChangePct = costChanges.length > 0
      ? costChanges.reduce((s, c) => s + c.costChangePct, 0) / costChanges.length
      : 0;

    const data: CostChangeTrackerData = {
      costChanges,
      marginSqueezeItems,
      categoryTrends,
      vendorTrends,
      totalSkusAnalyzed: skuItems.size,
      skusWithCostChange: costChanges.length,
      avgCostChangePct,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Margin squeeze alerts
    for (const item of marginSqueezeItems.slice(0, 10)) {
      alerts.push({
        severity: 'critical',
        message: `Margin squeeze: ${item.itemDesc} — cost up ${item.costChangePct.toFixed(1)}%, margin now ${item.newMarginPct.toFixed(1)}% (was ${item.oldMarginPct.toFixed(1)}%)`,
        code: 'MARGIN_SQUEEZE',
        entity: item.itemCode,
        value: item.newMarginPct,
        threshold: store.targetMarginPct,
      });
      actions.push({
        description: `Raise retail price on ${item.itemDesc} or find cheaper vendor — margin eroded ${item.marginErosionPct.toFixed(1)}pp`,
        priority: 1,
        automatable: false,
        payload: { itemCode: item.itemCode, currentRetail: item.currentRetail, newCost: item.newCost },
      });
    }

    // Big cost increases
    const bigIncreases = costChanges.filter(
      c => c.costChangePct > COST_CHANGE_ALERT_PCT && !c.marginSqueeze
    );
    for (const cc of bigIncreases.slice(0, 5)) {
      alerts.push({
        severity: 'warning',
        message: `Cost increase: ${cc.itemDesc} from ${cc.vendorId} — up ${cc.costChangePct.toFixed(1)}% ($${cc.oldCost.toFixed(2)} → $${cc.newCost.toFixed(2)})`,
        code: 'SIGNIFICANT_COST_INCREASE',
        entity: cc.itemCode,
        value: cc.costChangePct,
        threshold: COST_CHANGE_ALERT_PCT,
      });
    }

    // Vendor-level action
    const aggressiveVendors = vendorTrends.filter(v => v.avgCostChangePct > 3 && v.skuCount >= 3);
    for (const v of aggressiveVendors) {
      actions.push({
        description: `Negotiate with vendor ${v.vendorId} — avg cost increase ${v.avgCostChangePct.toFixed(1)}% across ${v.skuCount} SKUs`,
        priority: 2,
        automatable: false,
      });
    }

    const summary = `Tracked ${skuItems.size} SKUs: ${costChanges.length} with cost changes (avg ${avgCostChangePct.toFixed(1)}%). ${marginSqueezeItems.length} items in margin squeeze. ${categoryTrends.length} categories, ${vendorTrends.length} vendors analyzed.`;

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
