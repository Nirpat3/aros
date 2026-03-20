/**
 * Cashier Scorecard — Per-Employee Performance Metrics
 *
 * Tracks key metrics per cashier:
 * - Transaction count and speed (avg time between transactions)
 * - Average ticket size
 * - Void rate (% of transactions voided)
 * - Refund rate
 * - Total revenue handled
 *
 * Helps identify top performers and those needing coaching.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceRow,
  Alert,
  Action,
} from '../types.js';

interface CashierMetrics {
  cashierName: string;
  transactionCount: number;
  totalRevenue: number;
  avgTicket: number;
  voidCount: number;
  voidRate: number;
  refundCount: number;
  refundRate: number;
  customerCount: number;
  /** Revenue rank among all cashiers (1 = highest) */
  rank: number;
}

interface CashierScorecardData {
  cashiers: CashierMetrics[];
  storeAvgTicket: number;
  storeVoidRate: number;
  topPerformer: string | null;
  needsCoaching: string[];
}

/** Void rate threshold — above this triggers a warning */
const VOID_RATE_THRESHOLD = 3;

export class CashierScorecardSkill implements ArosSkill {
  readonly id = 'cashier-scorecard';
  readonly name = 'Cashier Scorecard';
  readonly category = 'workforce' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoices'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;
    const invoices = await connector.getInvoices(dateRange);

    // Group by cashier
    const cashierMap = new Map<string, {
      txns: InvoiceRow[];
      voids: number;
      refunds: number;
      revenue: number;
      customers: number;
    }>();

    for (const inv of invoices) {
      const name = inv.cashier_name;
      const existing = cashierMap.get(name);
      if (existing) {
        existing.txns.push(inv);
        if (inv.is_void) existing.voids++;
        if (inv.is_refund) existing.refunds++;
        if (!inv.is_void) {
          existing.revenue += inv.bill_amount;
          existing.customers += inv.customer_count;
        }
      } else {
        cashierMap.set(name, {
          txns: [inv],
          voids: inv.is_void ? 1 : 0,
          refunds: inv.is_refund ? 1 : 0,
          revenue: inv.is_void ? 0 : inv.bill_amount,
          customers: inv.is_void ? 0 : inv.customer_count,
        });
      }
    }

    let cashiers: CashierMetrics[] = [...cashierMap.entries()].map(([name, data]) => {
      const validCount = data.txns.filter(t => !t.is_void).length;
      return {
        cashierName: name,
        transactionCount: validCount,
        totalRevenue: data.revenue,
        avgTicket: validCount > 0 ? data.revenue / validCount : 0,
        voidCount: data.voids,
        voidRate: data.txns.length > 0 ? (data.voids / data.txns.length) * 100 : 0,
        refundCount: data.refunds,
        refundRate: data.txns.length > 0 ? (data.refunds / data.txns.length) * 100 : 0,
        customerCount: data.customers,
        rank: 0,
      };
    });

    // Rank by revenue
    cashiers.sort((a, b) => b.totalRevenue - a.totalRevenue);
    cashiers = cashiers.map((c, i) => ({ ...c, rank: i + 1 }));

    const totalValidTxns = cashiers.reduce((s, c) => s + c.transactionCount, 0);
    const totalRevenue = cashiers.reduce((s, c) => s + c.totalRevenue, 0);
    const totalVoids = cashiers.reduce((s, c) => s + c.voidCount, 0);

    const storeAvgTicket = totalValidTxns > 0 ? totalRevenue / totalValidTxns : 0;
    const storeVoidRate = totalValidTxns > 0
      ? (totalVoids / (totalValidTxns + totalVoids)) * 100
      : 0;

    const topPerformer = cashiers[0]?.cashierName ?? null;
    const needsCoaching = cashiers
      .filter(c => c.voidRate > VOID_RATE_THRESHOLD)
      .map(c => c.cashierName);

    const data: CashierScorecardData = {
      cashiers,
      storeAvgTicket,
      storeVoidRate,
      topPerformer,
      needsCoaching,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Flag high void rates
    for (const c of cashiers) {
      if (c.voidRate > VOID_RATE_THRESHOLD && c.transactionCount >= 5) {
        alerts.push({
          severity: 'warning',
          message: `${c.cashierName}: ${c.voidRate.toFixed(1)}% void rate (${c.voidCount} voids in ${c.transactionCount + c.voidCount} transactions)`,
          code: 'HIGH_CASHIER_VOID_RATE',
          entity: c.cashierName,
          value: c.voidRate,
          threshold: VOID_RATE_THRESHOLD,
        });
      }
    }

    if (needsCoaching.length > 0) {
      actions.push({
        description: `Schedule coaching for: ${needsCoaching.join(', ')} — void rates above ${VOID_RATE_THRESHOLD}%`,
        priority: 3,
        automatable: false,
      });
    }

    const summary = cashiers.length > 0
      ? `${cashiers.length} cashiers tracked. Top performer: ${topPerformer} ($${cashiers[0]?.totalRevenue.toFixed(2) ?? '0'}). Store avg ticket: $${storeAvgTicket.toFixed(2)}, void rate: ${storeVoidRate.toFixed(1)}%. ${needsCoaching.length} cashier(s) need coaching.`
      : 'No cashier data available for this period.';

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
