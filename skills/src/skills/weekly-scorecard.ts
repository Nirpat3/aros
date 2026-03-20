/**
 * Weekly Scorecard — KPI Dashboard for Store Owners
 *
 * Produces a comprehensive weekly performance report with:
 * - Sales trend (this week vs prior week vs same week last year)
 * - Gross margin %
 * - Labor cost % of revenue
 * - Shrink % (estimated)
 * - Customer count and average ticket
 * - Transaction count
 * - Top/bottom performers (categories and SKUs)
 *
 * All metrics include week-over-week and year-over-year comparisons
 * where data is available.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  Alert,
  Action,
} from '../types.js';

interface KpiMetric {
  name: string;
  value: number;
  unit: string;
  priorWeek: number | null;
  priorYear: number | null;
  wowChangePct: number | null;
  yoyChangePct: number | null;
  target: number | null;
  onTarget: boolean | null;
}

interface WeeklyScorecardData {
  weekStart: string;
  weekEnd: string;
  kpis: KpiMetric[];
  topCategories: Array<{ category: string; revenue: number; marginPct: number }>;
  bottomCategories: Array<{ category: string; revenue: number; marginPct: number }>;
  highlights: string[];
  concerns: string[];
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export class WeeklyScorecardSkill implements ArosSkill {
  readonly id = 'weekly-scorecard';
  readonly name = 'Weekly Scorecard';
  readonly category = 'owner-intelligence' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['invoices', 'invoice_items', 'employees'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, store } = context;

    const [invoices, items, employees] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getInvoiceItems(dateRange),
      connector.getEmployees(dateRange.start),
    ]);

    // Sales metrics
    const validInvoices = invoices.filter(inv => !inv.is_void);
    const totalRevenue = validInvoices.reduce((s, inv) => s + inv.bill_amount, 0);
    const transactionCount = validInvoices.length;
    const avgTicket = transactionCount > 0 ? totalRevenue / transactionCount : 0;
    const customerCount = validInvoices.reduce((s, inv) => s + inv.customer_count, 0);

    // Margin
    const validItems = items.filter(i => !i.is_void);
    const totalCost = validItems.reduce((s, i) => s + i.cost_price * i.item_qty, 0);
    const grossMargin = totalRevenue - totalCost;
    const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    // Labor
    const totalLaborCost = employees.reduce(
      (s, e) => s + e.hourly_rate * e.actual_hours, 0
    );
    const laborPct = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : 0;

    // Voids / shrink estimate
    const voidCount = invoices.filter(i => i.is_void).length;
    const voidAmount = invoices.filter(i => i.is_void)
      .reduce((s, i) => s + i.bill_amount, 0);
    const shrinkPct = totalRevenue > 0 ? (voidAmount / totalRevenue) * 100 : 0;

    // Category performance
    const catMap = new Map<string, { revenue: number; cost: number }>();
    for (const item of validItems) {
      const existing = catMap.get(item.category);
      const itemCost = item.cost_price * item.item_qty;
      if (existing) {
        existing.revenue += item.total_amount;
        existing.cost += itemCost;
      } else {
        catMap.set(item.category, { revenue: item.total_amount, cost: itemCost });
      }
    }
    const categories = [...catMap.entries()]
      .map(([category, d]) => ({
        category,
        revenue: d.revenue,
        marginPct: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topCategories = categories.slice(0, 5);
    const bottomCategories = [...categories].sort((a, b) => a.marginPct - b.marginPct).slice(0, 5);

    // Build KPIs (prior week/year would come from historical queries — null for Phase 1)
    const kpis: KpiMetric[] = [
      {
        name: 'Total Revenue',
        value: totalRevenue, unit: '$',
        priorWeek: null, priorYear: null,
        wowChangePct: null, yoyChangePct: null,
        target: null, onTarget: null,
      },
      {
        name: 'Transaction Count',
        value: transactionCount, unit: 'txn',
        priorWeek: null, priorYear: null,
        wowChangePct: null, yoyChangePct: null,
        target: null, onTarget: null,
      },
      {
        name: 'Average Ticket',
        value: avgTicket, unit: '$',
        priorWeek: null, priorYear: null,
        wowChangePct: null, yoyChangePct: null,
        target: null, onTarget: null,
      },
      {
        name: 'Customer Count',
        value: customerCount, unit: 'customers',
        priorWeek: null, priorYear: null,
        wowChangePct: null, yoyChangePct: null,
        target: null, onTarget: null,
      },
      {
        name: 'Gross Margin %',
        value: grossMarginPct, unit: '%',
        priorWeek: null, priorYear: null,
        wowChangePct: null, yoyChangePct: null,
        target: store.targetMarginPct,
        onTarget: grossMarginPct >= store.targetMarginPct,
      },
      {
        name: 'Labor Cost %',
        value: laborPct, unit: '%',
        priorWeek: null, priorYear: null,
        wowChangePct: null, yoyChangePct: null,
        target: store.targetLaborPct,
        onTarget: laborPct <= store.targetLaborPct,
      },
      {
        name: 'Shrink %',
        value: shrinkPct, unit: '%',
        priorWeek: null, priorYear: null,
        wowChangePct: null, yoyChangePct: null,
        target: 1.0,
        onTarget: shrinkPct <= 1.0,
      },
    ];

    // Highlights and concerns
    const highlights: string[] = [];
    const concerns: string[] = [];

    if (grossMarginPct >= store.targetMarginPct) {
      highlights.push(`Margin on target at ${grossMarginPct.toFixed(1)}%`);
    } else {
      concerns.push(`Margin below target: ${grossMarginPct.toFixed(1)}% vs ${store.targetMarginPct}% target`);
    }

    if (laborPct <= store.targetLaborPct) {
      highlights.push(`Labor cost controlled at ${laborPct.toFixed(1)}%`);
    } else {
      concerns.push(`Labor cost high: ${laborPct.toFixed(1)}% vs ${store.targetLaborPct}% target`);
    }

    if (shrinkPct > 1) {
      concerns.push(`Shrink at ${shrinkPct.toFixed(1)}% — investigate void patterns`);
    }

    const data: WeeklyScorecardData = {
      weekStart: dateRange.start,
      weekEnd: dateRange.end,
      kpis,
      topCategories,
      bottomCategories,
      highlights,
      concerns,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    for (const kpi of kpis) {
      if (kpi.onTarget === false) {
        alerts.push({
          severity: 'warning',
          message: `${kpi.name}: ${kpi.value.toFixed(1)}${kpi.unit} — off target (${kpi.target}${kpi.unit})`,
          code: `KPI_OFF_TARGET_${kpi.name.toUpperCase().replace(/\s+/g, '_')}`,
          value: kpi.value,
          threshold: kpi.target ?? undefined,
        });
      }
    }

    if (concerns.length > 0) {
      actions.push({
        description: `Address ${concerns.length} concern(s): ${concerns.join('; ')}`,
        priority: 2,
        automatable: false,
      });
    }

    const summary = `Weekly scorecard: $${totalRevenue.toFixed(2)} revenue, ${transactionCount} txns, ${grossMarginPct.toFixed(1)}% margin, ${laborPct.toFixed(1)}% labor. ${highlights.length} highlights, ${concerns.length} concerns.`;

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
