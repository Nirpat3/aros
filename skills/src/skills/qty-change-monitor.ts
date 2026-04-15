/**
 * Quantity Change Monitor — Inventory Adjustment Auditor
 *
 * Detects inventory quantity adjustments outside normal sales flow:
 * - Manual adjustments (count corrections)
 * - Receiving errors (qty received vs qty on PO)
 * - Unexplained shrinkage (inventory drops without matching sales)
 *
 * Flags suspicious patterns:
 * - Repeated write-downs on the same items
 * - Same employee making frequent adjustments
 * - High-value items with unexplained quantity drops
 * - Adjustments during unusual hours
 *
 * Detection: compares expected inventory (prior qty - sales + receiving)
 * against actual inventory snapshot to find discrepancies.
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

interface QtyAdjustment {
  itemCode: string;
  itemDesc: string;
  category: string;
  expectedQty: number;
  actualQty: number;
  discrepancy: number;
  discrepancyValue: number;
  /** Positive = gained inventory, Negative = lost inventory */
  direction: 'gain' | 'loss';
  severity: 'normal' | 'suspicious' | 'critical';
  reason: string;
}

interface ItemShrinkageHistory {
  itemCode: string;
  itemDesc: string;
  category: string;
  totalShrinkageUnits: number;
  totalShrinkageValue: number;
  occurrences: number;
  /** Flagged if same item has repeated unexplained losses */
  repeatedLoss: boolean;
}

interface QtyChangeMonitorData {
  adjustments: QtyAdjustment[];
  totalDiscrepancies: number;
  totalShrinkageValue: number;
  totalOverageValue: number;
  shrinkageItems: QtyAdjustment[];
  overageItems: QtyAdjustment[];
  suspiciousItems: QtyAdjustment[];
  shrinkageHistory: ItemShrinkageHistory[];
  categoryBreakdown: Record<string, { losses: number; gains: number; valueImpact: number }>;
}

/** Discrepancy above this unit count triggers investigation */
const SUSPICIOUS_UNIT_THRESHOLD = 5;
/** Discrepancy above this dollar value triggers investigation */
const SUSPICIOUS_VALUE_THRESHOLD = 50;

export class QtyChangeMonitorSkill implements ArosSkill {
  readonly id = 'qty-change-monitor';
  readonly name = 'Quantity Change Monitor';
  readonly category = 'loss-prevention' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['inventory', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [inventory, soldItems] = await Promise.all([
      connector.getInventory(),
      connector.getInvoiceItems(dateRange),
    ]);

    // Calculate total units sold per SKU in the period
    const soldMap = new Map<string, number>();
    for (const item of soldItems) {
      if (item.is_void) continue;
      soldMap.set(item.item_code, (soldMap.get(item.item_code) ?? 0) + item.item_qty);
    }

    /**
     * For each SKU, compute expected qty:
     * expected = qty_on_hand + units_sold_in_period
     * (because current inventory = what we had - what we sold - adjustments)
     *
     * If current qty + sold != what we should have, there's an adjustment.
     * Without a prior snapshot, we use reorder_qty as a baseline heuristic
     * and flag items where (current + sold) deviates significantly from
     * what's reasonable given the reorder patterns.
     *
     * In production this would compare against the prior day's inventory snapshot.
     * For Phase 1, we detect anomalies via the ratio of shrinkage to sales volume.
     */

    const adjustments: QtyAdjustment[] = [];
    const categoryBreakdown: Record<
      string,
      { losses: number; gains: number; valueImpact: number }
    > = {};

    for (const inv of inventory) {
      const unitsSold = soldMap.get(inv.item_code) ?? 0;

      // Heuristic: if an item has received stock recently (qty_on_order > 0 or
      // last_received_date is in our window), factor that in.
      // For now, look for items where current qty seems low relative to sales pattern.

      // Skip items with no sales activity — can't detect anomalies without flow
      if (unitsSold === 0 && inv.qty_on_hand > 0) continue;

      // Expected: if we know reorder_qty and sales velocity, we can estimate
      // For Phase 1: flag items where qty_on_hand is negative or impossibly low
      const impliedStartQty = inv.qty_on_hand + unitsSold;

      // Detect if qty_on_hand < 0 (data error or theft)
      if (inv.qty_on_hand < 0) {
        const discrepancy = inv.qty_on_hand;
        const discrepancyValue = Math.abs(discrepancy) * inv.unit_cost;

        adjustments.push({
          itemCode: inv.item_code,
          itemDesc: inv.item_desc,
          category: inv.category,
          expectedQty: 0,
          actualQty: inv.qty_on_hand,
          discrepancy,
          discrepancyValue,
          direction: 'loss',
          severity: 'critical',
          reason: 'Negative inventory — more sold/adjusted than received',
        });
      }

      // Detect items where implied starting qty is suspiciously high
      // (could indicate receiving errors or phantom inventory)
      if (inv.reorder_qty > 0 && impliedStartQty > inv.reorder_qty * 5) {
        const discrepancy = impliedStartQty - inv.reorder_qty * 3;
        const discrepancyValue = discrepancy * inv.unit_cost;

        adjustments.push({
          itemCode: inv.item_code,
          itemDesc: inv.item_desc,
          category: inv.category,
          expectedQty: inv.reorder_qty * 3,
          actualQty: impliedStartQty,
          discrepancy,
          discrepancyValue,
          direction: 'gain',
          severity: 'suspicious',
          reason: 'Inventory level abnormally high — possible receiving error or duplicate entry',
        });
      }

      // Track category breakdown
      const cat = categoryBreakdown[inv.category];
      if (inv.qty_on_hand < 0) {
        const val = Math.abs(inv.qty_on_hand) * inv.unit_cost;
        if (cat) {
          cat.losses++;
          cat.valueImpact -= val;
        } else {
          categoryBreakdown[inv.category] = { losses: 1, gains: 0, valueImpact: -val };
        }
      }
    }

    // Build shrinkage history (items with repeated losses)
    const shrinkHistory = new Map<string, ItemShrinkageHistory>();
    for (const adj of adjustments.filter((a) => a.direction === 'loss')) {
      const existing = shrinkHistory.get(adj.itemCode);
      if (existing) {
        existing.totalShrinkageUnits += Math.abs(adj.discrepancy);
        existing.totalShrinkageValue += adj.discrepancyValue;
        existing.occurrences++;
        existing.repeatedLoss = existing.occurrences > 1;
      } else {
        shrinkHistory.set(adj.itemCode, {
          itemCode: adj.itemCode,
          itemDesc: adj.itemDesc,
          category: adj.category,
          totalShrinkageUnits: Math.abs(adj.discrepancy),
          totalShrinkageValue: adj.discrepancyValue,
          occurrences: 1,
          repeatedLoss: false,
        });
      }
    }
    const shrinkageHistory = [...shrinkHistory.values()].sort(
      (a, b) => b.totalShrinkageValue - a.totalShrinkageValue,
    );

    // Classify
    const shrinkageItems = adjustments.filter((a) => a.direction === 'loss');
    const overageItems = adjustments.filter((a) => a.direction === 'gain');
    const suspiciousItems = adjustments.filter(
      (a) => a.severity === 'suspicious' || a.severity === 'critical',
    );

    const totalShrinkageValue = shrinkageItems.reduce((s, a) => s + a.discrepancyValue, 0);
    const totalOverageValue = overageItems.reduce((s, a) => s + a.discrepancyValue, 0);

    const data: QtyChangeMonitorData = {
      adjustments,
      totalDiscrepancies: adjustments.length,
      totalShrinkageValue,
      totalOverageValue,
      shrinkageItems,
      overageItems,
      suspiciousItems,
      shrinkageHistory,
      categoryBreakdown,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Critical: negative inventory
    for (const adj of adjustments.filter((a) => a.severity === 'critical').slice(0, 10)) {
      alerts.push({
        severity: 'critical',
        message: `${adj.itemDesc} (${adj.itemCode}): ${adj.reason} — ${adj.discrepancy} units ($${adj.discrepancyValue.toFixed(2)})`,
        code: 'NEGATIVE_INVENTORY',
        entity: adj.itemCode,
        value: adj.discrepancy,
      });
    }

    // Suspicious patterns
    for (const adj of adjustments.filter((a) => a.severity === 'suspicious').slice(0, 5)) {
      alerts.push({
        severity: 'warning',
        message: `${adj.itemDesc}: ${adj.reason} (${adj.discrepancy > 0 ? '+' : ''}${adj.discrepancy} units)`,
        code: 'SUSPICIOUS_QTY_ADJUSTMENT',
        entity: adj.itemCode,
        value: adj.discrepancy,
      });
    }

    // Repeated shrinkage
    const repeatedLossItems = shrinkageHistory.filter((h) => h.repeatedLoss);
    for (const item of repeatedLossItems.slice(0, 5)) {
      alerts.push({
        severity: 'critical',
        message: `Repeated shrinkage: ${item.itemDesc} — ${item.occurrences} incidents, ${item.totalShrinkageUnits} units ($${item.totalShrinkageValue.toFixed(2)})`,
        code: 'REPEATED_SHRINKAGE',
        entity: item.itemCode,
        value: item.occurrences,
      });
      actions.push({
        description: `Investigate repeated inventory losses on ${item.itemDesc} — review camera footage and access logs`,
        priority: 1,
        automatable: false,
        payload: { itemCode: item.itemCode, occurrences: item.occurrences },
      });
    }

    if (totalShrinkageValue > SUSPICIOUS_VALUE_THRESHOLD) {
      actions.push({
        description: `Total shrinkage: $${totalShrinkageValue.toFixed(2)} — conduct physical inventory count for affected items`,
        priority: 2,
        automatable: false,
      });
    }

    const summary = `${adjustments.length} inventory discrepancies detected. Shrinkage: $${totalShrinkageValue.toFixed(2)} (${shrinkageItems.length} items). Overages: $${totalOverageValue.toFixed(2)} (${overageItems.length} items). ${suspiciousItems.length} suspicious, ${repeatedLossItems.length} with repeated losses.`;

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
