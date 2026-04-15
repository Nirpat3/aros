/**
 * Stock Pulse — Real-time Inventory Health Monitor
 *
 * Scans current inventory levels and flags:
 * - Low stock: qty below reorder point
 * - Overstock: qty > 3x reorder point (tying up cash)
 * - Dead stock: no sales in 30+ days
 * - Out of stock: qty = 0
 *
 * Core skill that feeds into morning-briefing and auto-reorder.
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

export interface StockAlert {
  itemCode: string;
  itemDesc: string;
  category: string;
  status: 'out-of-stock' | 'low-stock' | 'overstock' | 'dead-stock';
  qtyOnHand: number;
  reorderPoint: number;
  daysSinceLastSold: number | null;
  estimatedValue: number;
}

export interface StockPulseData {
  totalSkus: number;
  totalInventoryValue: number;
  outOfStock: StockAlert[];
  lowStock: StockAlert[];
  overstock: StockAlert[];
  deadStock: StockAlert[];
  healthyCount: number;
  categoryBreakdown: Record<string, { count: number; value: number }>;
}

/** Compute days between two date strings */
function daysBetween(dateStr: string, today: string): number | null {
  if (!dateStr) return null;
  const d1 = new Date(dateStr).getTime();
  const d2 = new Date(today).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Analyze inventory health. Exported for composition.
 */
export function computeStockPulse(
  inventory: InventoryRow[],
  _recentItems: InvoiceItemRow[],
  today: string,
): StockPulseData {
  const outOfStock: StockAlert[] = [];
  const lowStock: StockAlert[] = [];
  const overstock: StockAlert[] = [];
  const deadStock: StockAlert[] = [];

  const categoryBreakdown: Record<string, { count: number; value: number }> = {};
  let totalInventoryValue = 0;

  for (const item of inventory) {
    const value = item.qty_on_hand * item.unit_cost;
    totalInventoryValue += value;

    // Category breakdown
    const cat = categoryBreakdown[item.category];
    if (cat) {
      cat.count++;
      cat.value += value;
    } else {
      categoryBreakdown[item.category] = { count: 1, value };
    }

    const daysSinceLastSold = daysBetween(item.last_sold_date, today);

    const makeAlert = (status: StockAlert['status']): StockAlert => ({
      itemCode: item.item_code,
      itemDesc: item.item_desc,
      category: item.category,
      status,
      qtyOnHand: item.qty_on_hand,
      reorderPoint: item.reorder_point,
      daysSinceLastSold,
      estimatedValue: value,
    });

    if (item.qty_on_hand <= 0) {
      outOfStock.push(makeAlert('out-of-stock'));
    } else if (item.qty_on_hand <= item.reorder_point) {
      lowStock.push(makeAlert('low-stock'));
    }

    if (item.qty_on_hand > item.reorder_point * 3 && item.reorder_point > 0) {
      overstock.push(makeAlert('overstock'));
    }

    if (daysSinceLastSold !== null && daysSinceLastSold > 30 && item.qty_on_hand > 0) {
      deadStock.push(makeAlert('dead-stock'));
    }
  }

  // Sort by severity / value
  outOfStock.sort((a, b) => b.reorderPoint - a.reorderPoint);
  lowStock.sort((a, b) => a.qtyOnHand - b.qtyOnHand);
  overstock.sort((a, b) => b.estimatedValue - a.estimatedValue);
  deadStock.sort((a, b) => (b.daysSinceLastSold ?? 0) - (a.daysSinceLastSold ?? 0));

  const problemCount = outOfStock.length + lowStock.length + overstock.length + deadStock.length;
  const healthyCount = inventory.length - problemCount;

  return {
    totalSkus: inventory.length,
    totalInventoryValue,
    outOfStock,
    lowStock,
    overstock,
    deadStock,
    healthyCount,
    categoryBreakdown,
  };
}

export class StockPulseSkill implements ArosSkill {
  readonly id = 'stock-pulse';
  readonly name = 'Stock Pulse';
  readonly category = 'inventory' as const;
  readonly frequency = 'realtime' as const;
  readonly requiredData = ['inventory', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, today } = context;

    const [inventory, recentItems] = await Promise.all([
      connector.getInventory(),
      connector.getInvoiceItems(dateRange),
    ]);

    const data = computeStockPulse(inventory, recentItems, today);
    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Out of stock — critical
    for (const item of data.outOfStock.slice(0, 10)) {
      alerts.push({
        severity: 'critical',
        message: `OUT OF STOCK: ${item.itemDesc} (${item.itemCode})`,
        code: 'OUT_OF_STOCK',
        entity: item.itemCode,
      });
    }

    // Low stock — warning
    for (const item of data.lowStock.slice(0, 10)) {
      alerts.push({
        severity: 'warning',
        message: `Low stock: ${item.itemDesc} — ${item.qtyOnHand} units (reorder at ${item.reorderPoint})`,
        code: 'LOW_STOCK',
        entity: item.itemCode,
        value: item.qtyOnHand,
        threshold: item.reorderPoint,
      });
    }

    // Dead stock — info
    if (data.deadStock.length > 0) {
      const totalDeadValue = data.deadStock.reduce((s, i) => s + i.estimatedValue, 0);
      alerts.push({
        severity: 'info',
        message: `${data.deadStock.length} dead stock items ($${totalDeadValue.toFixed(2)} tied up, no sales in 30+ days)`,
        code: 'DEAD_STOCK',
        value: data.deadStock.length,
      });
      actions.push({
        description: `Review ${data.deadStock.length} dead stock items for markdown or return to vendor`,
        priority: 3,
        automatable: false,
        payload: { items: data.deadStock.map((i) => i.itemCode) },
      });
    }

    // Overstock — info
    if (data.overstock.length > 0) {
      const totalOverValue = data.overstock.reduce((s, i) => s + i.estimatedValue, 0);
      alerts.push({
        severity: 'info',
        message: `${data.overstock.length} overstocked items ($${totalOverValue.toFixed(2)} excess inventory)`,
        code: 'OVERSTOCK',
        value: data.overstock.length,
      });
    }

    // Reorder actions
    for (const item of [...data.outOfStock, ...data.lowStock].slice(0, 5)) {
      actions.push({
        description: `Reorder ${item.itemDesc} (${item.itemCode}) — currently ${item.qtyOnHand} units`,
        priority: item.status === 'out-of-stock' ? 1 : 2,
        automatable: true,
        payload: { itemCode: item.itemCode, currentQty: item.qtyOnHand },
      });
    }

    const summary = `Inventory: ${data.totalSkus} SKUs worth $${data.totalInventoryValue.toFixed(2)}. ${data.outOfStock.length} out of stock, ${data.lowStock.length} low, ${data.overstock.length} overstocked, ${data.deadStock.length} dead stock.`;

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
