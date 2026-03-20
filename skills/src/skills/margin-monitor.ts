/**
 * Margin Monitor — Gross Margin Analysis by Category & SKU
 *
 * Calculates gross margin at category and SKU level.
 * Flags items selling below the store's target margin.
 * Helps operators identify profit leaks and pricing issues.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceItemRow,
  Alert,
  Action,
} from '../types.js';

interface MarginBySku {
  itemCode: string;
  itemDesc: string;
  category: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  qtySold: number;
}

interface MarginByCategory {
  category: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  skuCount: number;
}

interface MarginMonitorData {
  overallRevenue: number;
  overallCost: number;
  overallMargin: number;
  overallMarginPct: number;
  byCategory: MarginByCategory[];
  bySku: MarginBySku[];
  belowTargetSkus: MarginBySku[];
  negativeMarginsSkus: MarginBySku[];
}

/**
 * Compute margin analysis from invoice items.
 * Exported for composition by other skills.
 */
export function computeMargins(
  items: InvoiceItemRow[],
  targetMarginPct: number
): MarginMonitorData {
  // Filter valid (non-void) items
  const validItems = items.filter(i => !i.is_void);

  // SKU-level aggregation
  const skuMap = new Map<string, {
    desc: string; category: string;
    revenue: number; cost: number; qty: number;
  }>();

  for (const item of validItems) {
    const existing = skuMap.get(item.item_code);
    if (existing) {
      existing.revenue += item.total_amount;
      existing.cost += item.cost_price * item.item_qty;
      existing.qty += item.item_qty;
    } else {
      skuMap.set(item.item_code, {
        desc: item.item_desc,
        category: item.category,
        revenue: item.total_amount,
        cost: item.cost_price * item.item_qty,
        qty: item.item_qty,
      });
    }
  }

  const bySku: MarginBySku[] = [...skuMap.entries()]
    .map(([code, d]) => ({
      itemCode: code,
      itemDesc: d.desc,
      category: d.category,
      revenue: d.revenue,
      cost: d.cost,
      margin: d.revenue - d.cost,
      marginPct: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
      qtySold: d.qty,
    }))
    .sort((a, b) => a.marginPct - b.marginPct);

  // Category-level aggregation
  const catMap = new Map<string, { revenue: number; cost: number; skus: Set<string> }>();
  for (const sku of bySku) {
    const existing = catMap.get(sku.category);
    if (existing) {
      existing.revenue += sku.revenue;
      existing.cost += sku.cost;
      existing.skus.add(sku.itemCode);
    } else {
      catMap.set(sku.category, {
        revenue: sku.revenue,
        cost: sku.cost,
        skus: new Set([sku.itemCode]),
      });
    }
  }

  const byCategory: MarginByCategory[] = [...catMap.entries()]
    .map(([cat, d]) => ({
      category: cat,
      revenue: d.revenue,
      cost: d.cost,
      margin: d.revenue - d.cost,
      marginPct: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
      skuCount: d.skus.size,
    }))
    .sort((a, b) => a.marginPct - b.marginPct);

  const overallRevenue = bySku.reduce((s, x) => s + x.revenue, 0);
  const overallCost = bySku.reduce((s, x) => s + x.cost, 0);
  const overallMargin = overallRevenue - overallCost;
  const overallMarginPct = overallRevenue > 0
    ? (overallMargin / overallRevenue) * 100
    : 0;

  const belowTargetSkus = bySku.filter(
    s => s.marginPct < targetMarginPct && s.marginPct >= 0
  );
  const negativeMarginsSkus = bySku.filter(s => s.marginPct < 0);

  return {
    overallRevenue,
    overallCost,
    overallMargin,
    overallMarginPct,
    byCategory,
    bySku,
    belowTargetSkus,
    negativeMarginsSkus,
  };
}

export class MarginMonitorSkill implements ArosSkill {
  readonly id = 'margin-monitor';
  readonly name = 'Margin Monitor';
  readonly category = 'sales-revenue' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, store } = context;
    const items = await connector.getInvoiceItems(dateRange);
    const data = computeMargins(items, store.targetMarginPct);

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Alert: overall margin below target
    if (data.overallMarginPct < store.targetMarginPct && data.overallRevenue > 0) {
      alerts.push({
        severity: 'warning',
        message: `Overall margin ${data.overallMarginPct.toFixed(1)}% is below target ${store.targetMarginPct}%`,
        code: 'MARGIN_BELOW_TARGET',
        value: data.overallMarginPct,
        threshold: store.targetMarginPct,
      });
    }

    // Alert: items selling at a loss
    for (const sku of data.negativeMarginsSkus.slice(0, 5)) {
      alerts.push({
        severity: 'critical',
        message: `${sku.itemDesc} (${sku.itemCode}) selling at ${sku.marginPct.toFixed(1)}% margin — losing money`,
        code: 'NEGATIVE_MARGIN',
        entity: sku.itemCode,
        value: sku.marginPct,
        threshold: 0,
      });
      actions.push({
        description: `Review pricing for ${sku.itemDesc} — current margin is negative`,
        priority: 1,
        automatable: false,
      });
    }

    // Action: categories below target
    const weakCategories = data.byCategory.filter(
      c => c.marginPct < store.targetMarginPct && c.marginPct >= 0
    );
    for (const cat of weakCategories.slice(0, 3)) {
      actions.push({
        description: `Review ${cat.category} category — margin ${cat.marginPct.toFixed(1)}% (${cat.skuCount} SKUs)`,
        priority: 3,
        automatable: false,
      });
    }

    const summary = data.overallRevenue > 0
      ? `Overall margin: ${data.overallMarginPct.toFixed(1)}% ($${data.overallMargin.toFixed(2)} profit on $${data.overallRevenue.toFixed(2)} revenue). ${data.negativeMarginsSkus.length} items at negative margin, ${data.belowTargetSkus.length} below ${store.targetMarginPct}% target.`
      : 'No sales data available for margin analysis.';

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
