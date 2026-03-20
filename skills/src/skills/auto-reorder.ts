/**
 * Auto-Reorder — Predictive Inventory Replenishment
 *
 * Calculates daily velocity for each SKU, estimates runout dates,
 * and generates purchase order drafts when items will run out
 * before the next delivery (based on vendor lead times).
 *
 * Key formula: daysUntilRunout = qtyOnHand / dailyVelocity
 * Reorder trigger: daysUntilRunout <= leadTimeDays + safetyBuffer
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

/** Safety buffer in days beyond lead time */
const SAFETY_BUFFER_DAYS = 2;

/** Minimum days of sales data to compute reliable velocity */
const MIN_VELOCITY_DAYS = 7;

interface SkuVelocity {
  itemCode: string;
  itemDesc: string;
  category: string;
  qtyOnHand: number;
  dailyVelocity: number;
  daysUntilRunout: number | null;
  leadTimeDays: number;
  reorderQty: number;
  vendorId: string;
  estimatedRunoutDate: string | null;
  urgency: 'critical' | 'soon' | 'ok';
}

interface PurchaseOrderDraft {
  vendorId: string;
  items: Array<{
    itemCode: string;
    itemDesc: string;
    orderQty: number;
    estimatedCost: number;
  }>;
  totalEstimatedCost: number;
}

interface AutoReorderData {
  velocities: SkuVelocity[];
  criticalItems: SkuVelocity[];
  soonItems: SkuVelocity[];
  purchaseOrders: PurchaseOrderDraft[];
  analysisWindowDays: number;
}

export class AutoReorderSkill implements ArosSkill {
  readonly id = 'auto-reorder';
  readonly name = 'Auto Reorder';
  readonly category = 'inventory' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['inventory', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, today } = context;

    const [inventory, items] = await Promise.all([
      connector.getInventory(),
      connector.getInvoiceItems(dateRange),
    ]);

    // Calculate sales velocity per SKU over the date range
    const daySpan = Math.max(
      1,
      (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Aggregate qty sold per item
    const soldMap = new Map<string, number>();
    for (const item of items) {
      if (item.is_void) continue;
      soldMap.set(item.item_code, (soldMap.get(item.item_code) ?? 0) + item.item_qty);
    }

    const velocities: SkuVelocity[] = [];

    for (const inv of inventory) {
      const qtySold = soldMap.get(inv.item_code) ?? 0;
      const dailyVelocity = qtySold / daySpan;
      const triggerDays = inv.lead_time_days + SAFETY_BUFFER_DAYS;

      let daysUntilRunout: number | null = null;
      let estimatedRunoutDate: string | null = null;
      let urgency: SkuVelocity['urgency'] = 'ok';

      if (dailyVelocity > 0) {
        daysUntilRunout = inv.qty_on_hand / dailyVelocity;
        const runoutMs = new Date(today).getTime() + daysUntilRunout * 86400000;
        estimatedRunoutDate = new Date(runoutMs).toISOString().split('T')[0] ?? null;

        if (daysUntilRunout <= triggerDays) {
          urgency = daysUntilRunout <= inv.lead_time_days ? 'critical' : 'soon';
        }
      } else if (inv.qty_on_hand <= 0) {
        urgency = 'critical';
        daysUntilRunout = 0;
      }

      velocities.push({
        itemCode: inv.item_code,
        itemDesc: inv.item_desc,
        category: inv.category,
        qtyOnHand: inv.qty_on_hand,
        dailyVelocity,
        daysUntilRunout,
        leadTimeDays: inv.lead_time_days,
        reorderQty: inv.reorder_qty,
        vendorId: inv.vendor_id,
        estimatedRunoutDate,
        urgency,
      });
    }

    const criticalItems = velocities.filter(v => v.urgency === 'critical');
    const soonItems = velocities.filter(v => v.urgency === 'soon');

    // Group reorder items by vendor into PO drafts
    const vendorItems = new Map<string, Array<{
      itemCode: string; itemDesc: string;
      orderQty: number; estimatedCost: number;
    }>>();

    const needsReorder = [...criticalItems, ...soonItems];
    for (const v of needsReorder) {
      const inv = inventory.find(i => i.item_code === v.itemCode);
      if (!inv) continue;
      const orderQty = Math.max(inv.reorder_qty, Math.ceil(v.dailyVelocity * (inv.lead_time_days + SAFETY_BUFFER_DAYS + 7)));
      const entry = {
        itemCode: v.itemCode,
        itemDesc: v.itemDesc,
        orderQty,
        estimatedCost: orderQty * inv.unit_cost,
      };
      const existing = vendorItems.get(v.vendorId);
      if (existing) {
        existing.push(entry);
      } else {
        vendorItems.set(v.vendorId, [entry]);
      }
    }

    const purchaseOrders: PurchaseOrderDraft[] = [...vendorItems.entries()].map(
      ([vendorId, poItems]) => ({
        vendorId,
        items: poItems,
        totalEstimatedCost: poItems.reduce((s, i) => s + i.estimatedCost, 0),
      })
    );

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    for (const item of criticalItems.slice(0, 10)) {
      alerts.push({
        severity: 'critical',
        message: `${item.itemDesc} will run out ${item.daysUntilRunout !== null && item.daysUntilRunout <= 0 ? 'NOW' : `in ${item.daysUntilRunout?.toFixed(0)} days`} (lead time: ${item.leadTimeDays}d)`,
        code: 'REORDER_CRITICAL',
        entity: item.itemCode,
        value: item.daysUntilRunout ?? 0,
        threshold: item.leadTimeDays,
      });
    }

    for (const po of purchaseOrders) {
      actions.push({
        description: `Send PO to vendor ${po.vendorId}: ${po.items.length} items, est. $${po.totalEstimatedCost.toFixed(2)}`,
        priority: 1,
        automatable: true,
        payload: po as unknown as Record<string, unknown>,
      });
    }

    const totalPoCost = purchaseOrders.reduce((s, po) => s + po.totalEstimatedCost, 0);
    const summary = needsReorder.length > 0
      ? `${criticalItems.length} critical, ${soonItems.length} soon-to-reorder items. ${purchaseOrders.length} PO drafts totaling $${totalPoCost.toFixed(2)}.`
      : `All ${velocities.length} SKUs have adequate stock for current velocity (${daySpan.toFixed(0)}-day analysis window).`;

    return {
      skillId: this.id,
      timestamp: new Date().toISOString(),
      summary,
      alerts,
      actions,
      data: {
        velocities,
        criticalItems,
        soonItems,
        purchaseOrders,
        analysisWindowDays: daySpan,
      } satisfies AutoReorderData as unknown as Record<string, unknown>,
    };
  }
}
