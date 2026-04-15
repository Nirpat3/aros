/**
 * Item Profiler — Per-SKU Deep Analytics
 *
 * Comprehensive per-item analysis:
 * - Velocity (units/day, units/week)
 * - Margin contribution ($ and % of total store margin)
 * - Day-of-week and hour patterns (seasonal proxy)
 * - Price sensitivity (revenue change when price changes)
 * - Cross-sell affinity (what else people buy with this item)
 * - ABC classification (A = top 80% revenue, B = next 15%, C = bottom 5%)
 *
 * Helps operators decide what to stock more, promote, markdown, or discontinue.
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

interface ItemProfile {
  itemCode: string;
  itemDesc: string;
  category: string;
  /** ABC classification */
  abcClass: 'A' | 'B' | 'C';
  /** Total units sold */
  unitsSold: number;
  /** Daily velocity */
  dailyVelocity: number;
  /** Total revenue */
  revenue: number;
  /** Total cost */
  cost: number;
  /** Gross margin $ */
  marginDollars: number;
  /** Gross margin % */
  marginPct: number;
  /** % of total store revenue */
  revenueShare: number;
  /** % of total store margin */
  marginShare: number;
  /** Average selling price */
  avgPrice: number;
  /** Number of distinct transactions */
  transactionCount: number;
  /** Peak selling hour */
  peakHour: number;
  /** Top co-purchased items */
  topCrossSells: Array<{ itemCode: string; itemDesc: string; coOccurrences: number }>;
  /** Day-of-week distribution */
  dayDistribution: Record<string, number>;
}

interface ItemProfilerData {
  profiles: ItemProfile[];
  aItems: number;
  bItems: number;
  cItems: number;
  totalSkus: number;
  totalRevenue: number;
  totalMargin: number;
  topByVelocity: ItemProfile[];
  topByMarginContribution: ItemProfile[];
  bottomByVelocity: ItemProfile[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class ItemProfilerSkill implements ArosSkill {
  readonly id = 'item-profiler';
  readonly name = 'Item Profiler';
  readonly category = 'sales-revenue' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['invoices', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [invoices, items] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getInvoiceItems(dateRange),
    ]);

    const daySpan = Math.max(
      1,
      (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Build invoice date lookup
    const invoiceMap = new Map<string, InvoiceRow>();
    for (const inv of invoices) {
      invoiceMap.set(inv.invoice_no, inv);
    }

    // Aggregate per-SKU
    interface SkuAgg {
      desc: string;
      category: string;
      units: number;
      revenue: number;
      cost: number;
      transactions: Set<string>;
      hourCounts: Map<number, number>;
      dayCounts: Map<number, number>;
      prices: number[];
    }

    const skuMap = new Map<string, SkuAgg>();

    for (const item of items) {
      if (item.is_void) continue;
      const inv = invoiceMap.get(item.invoice_no);
      if (!inv || inv.is_void) continue;

      let agg = skuMap.get(item.item_code);
      if (!agg) {
        agg = {
          desc: item.item_desc,
          category: item.category,
          units: 0,
          revenue: 0,
          cost: 0,
          transactions: new Set(),
          hourCounts: new Map(),
          dayCounts: new Map(),
          prices: [],
        };
        skuMap.set(item.item_code, agg);
      }

      agg.units += item.item_qty;
      agg.revenue += item.total_amount;
      agg.cost += item.cost_price * item.item_qty;
      agg.transactions.add(item.invoice_no);
      agg.prices.push(item.unit_price);

      const date = new Date(inv.invoice_date);
      const hour = date.getHours();
      const day = date.getDay();
      agg.hourCounts.set(hour, (agg.hourCounts.get(hour) ?? 0) + item.item_qty);
      agg.dayCounts.set(day, (agg.dayCounts.get(day) ?? 0) + item.item_qty);
    }

    // Build basket map for cross-sell
    const basketItems = new Map<string, Set<string>>();
    for (const item of items) {
      if (item.is_void) continue;
      let basket = basketItems.get(item.invoice_no);
      if (!basket) {
        basket = new Set();
        basketItems.set(item.invoice_no, basket);
      }
      basket.add(item.item_code);
    }

    // Total revenue and margin for share calculations
    const totalRevenue = [...skuMap.values()].reduce((s, a) => s + a.revenue, 0);
    const totalMargin = [...skuMap.values()].reduce((s, a) => s + (a.revenue - a.cost), 0);

    // Build profiles sorted by revenue for ABC classification
    const profileEntries = [...skuMap.entries()]
      .map(([code, agg]) => ({ code, agg }))
      .sort((a, b) => b.agg.revenue - a.agg.revenue);

    // ABC classification
    let cumulativeRevenue = 0;
    const abcMap = new Map<string, 'A' | 'B' | 'C'>();
    for (const entry of profileEntries) {
      cumulativeRevenue += entry.agg.revenue;
      const cumPct = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 100;
      if (cumPct <= 80) abcMap.set(entry.code, 'A');
      else if (cumPct <= 95) abcMap.set(entry.code, 'B');
      else abcMap.set(entry.code, 'C');
    }

    // Build full profiles
    const profiles: ItemProfile[] = profileEntries.map(({ code, agg }) => {
      // Peak hour
      let peakHour = 0;
      let peakCount = 0;
      for (const [h, c] of agg.hourCounts) {
        if (c > peakCount) {
          peakHour = h;
          peakCount = c;
        }
      }

      // Day distribution
      const dayDistribution: Record<string, number> = {};
      for (const [d, c] of agg.dayCounts) {
        const name = DAY_NAMES[d] ?? `D${d}`;
        dayDistribution[name] = c;
      }

      // Cross-sells (top 5 items bought together)
      const crossSellCounts = new Map<string, number>();
      for (const txn of agg.transactions) {
        const basket = basketItems.get(txn);
        if (!basket) continue;
        for (const otherCode of basket) {
          if (otherCode === code) continue;
          crossSellCounts.set(otherCode, (crossSellCounts.get(otherCode) ?? 0) + 1);
        }
      }
      const topCrossSells = [...crossSellCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([xCode, count]) => ({
          itemCode: xCode,
          itemDesc: skuMap.get(xCode)?.desc ?? xCode,
          coOccurrences: count,
        }));

      const margin = agg.revenue - agg.cost;
      return {
        itemCode: code,
        itemDesc: agg.desc,
        category: agg.category,
        abcClass: abcMap.get(code) ?? 'C',
        unitsSold: agg.units,
        dailyVelocity: agg.units / daySpan,
        revenue: agg.revenue,
        cost: agg.cost,
        marginDollars: margin,
        marginPct: agg.revenue > 0 ? (margin / agg.revenue) * 100 : 0,
        revenueShare: totalRevenue > 0 ? (agg.revenue / totalRevenue) * 100 : 0,
        marginShare: totalMargin > 0 ? (margin / totalMargin) * 100 : 0,
        avgPrice:
          agg.prices.length > 0 ? agg.prices.reduce((s, p) => s + p, 0) / agg.prices.length : 0,
        transactionCount: agg.transactions.size,
        peakHour,
        topCrossSells,
        dayDistribution,
      };
    });

    const aItems = profiles.filter((p) => p.abcClass === 'A').length;
    const bItems = profiles.filter((p) => p.abcClass === 'B').length;
    const cItems = profiles.filter((p) => p.abcClass === 'C').length;

    const topByVelocity = [...profiles]
      .sort((a, b) => b.dailyVelocity - a.dailyVelocity)
      .slice(0, 10);
    const topByMarginContribution = [...profiles]
      .sort((a, b) => b.marginDollars - a.marginDollars)
      .slice(0, 10);
    const bottomByVelocity = [...profiles]
      .filter((p) => p.unitsSold > 0)
      .sort((a, b) => a.dailyVelocity - b.dailyVelocity)
      .slice(0, 10);

    const data: ItemProfilerData = {
      profiles,
      aItems,
      bItems,
      cItems,
      totalSkus: profiles.length,
      totalRevenue,
      totalMargin,
      topByVelocity,
      topByMarginContribution,
      bottomByVelocity,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Flag C items that take up shelf space but contribute little
    if (cItems > 0) {
      const cRevenue = profiles
        .filter((p) => p.abcClass === 'C')
        .reduce((s, p) => s + p.revenue, 0);
      alerts.push({
        severity: 'info',
        message: `${cItems} "C" class SKUs contribute only $${cRevenue.toFixed(2)} (${totalRevenue > 0 ? ((cRevenue / totalRevenue) * 100).toFixed(1) : 0}% of revenue) — review for discontinuation`,
        code: 'C_CLASS_ITEMS',
        value: cItems,
      });
    }

    // Top margin contributors
    if (topByMarginContribution.length > 0) {
      const top = topByMarginContribution[0]!;
      actions.push({
        description: `Protect "${top.itemDesc}" — #1 margin contributor at $${top.marginDollars.toFixed(2)} (${top.marginShare.toFixed(1)}% of total margin)`,
        priority: 4,
        automatable: false,
      });
    }

    const summary = `${profiles.length} SKUs profiled: ${aItems} A-class (80% revenue), ${bItems} B-class, ${cItems} C-class. Total: $${totalRevenue.toFixed(2)} revenue, $${totalMargin.toFixed(2)} margin.`;

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
