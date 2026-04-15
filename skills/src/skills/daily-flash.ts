/**
 * Daily Flash — End-of-Day Sales Summary
 *
 * Produces a snapshot of the day's performance:
 * total revenue, transaction count, average ticket, top sellers,
 * void/refund counts, and payment method breakdown.
 *
 * Designed to run at close-of-business or early next morning.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceRow,
  InvoiceItemRow,
  Alert,
  Action,
} from '../types.js';

interface TopSeller {
  itemCode: string;
  itemDesc: string;
  qtySold: number;
  revenue: number;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
  pct: number;
}

interface DailyFlashData {
  totalRevenue: number;
  transactionCount: number;
  avgTicket: number;
  customerCount: number;
  voidCount: number;
  voidAmount: number;
  refundCount: number;
  refundAmount: number;
  topSellers: TopSeller[];
  paymentBreakdown: PaymentBreakdown[];
  revenueByHour: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}

/**
 * Compute the daily flash report from raw invoice data.
 * Exported so other skills (e.g., morning-briefing) can reuse the logic.
 */
export function computeDailyFlash(invoices: InvoiceRow[], items: InvoiceItemRow[]): DailyFlashData {
  // Filter out voids for revenue calculations
  const validInvoices = invoices.filter((inv) => !inv.is_void);
  const voidInvoices = invoices.filter((inv) => inv.is_void);
  const refundInvoices = invoices.filter((inv) => inv.is_refund && !inv.is_void);

  const totalRevenue = validInvoices.reduce((sum, inv) => sum + inv.bill_amount, 0);
  const transactionCount = validInvoices.length;
  const avgTicket = transactionCount > 0 ? totalRevenue / transactionCount : 0;
  const customerCount = validInvoices.reduce((sum, inv) => sum + inv.customer_count, 0);

  // Void and refund totals
  const voidCount = voidInvoices.length;
  const voidAmount = voidInvoices.reduce((sum, inv) => sum + inv.bill_amount, 0);
  const refundCount = refundInvoices.length;
  const refundAmount = refundInvoices.reduce((sum, inv) => sum + inv.bill_amount, 0);

  // Top sellers by revenue
  const itemMap = new Map<string, { desc: string; qty: number; revenue: number }>();
  const validInvoiceNos = new Set(validInvoices.map((inv) => inv.invoice_no));
  for (const item of items) {
    if (!validInvoiceNos.has(item.invoice_no) || item.is_void) continue;
    const existing = itemMap.get(item.item_code);
    if (existing) {
      existing.qty += item.item_qty;
      existing.revenue += item.total_amount;
    } else {
      itemMap.set(item.item_code, {
        desc: item.item_desc,
        qty: item.item_qty,
        revenue: item.total_amount,
      });
    }
  }
  const topSellers: TopSeller[] = [...itemMap.entries()]
    .map(([code, data]) => ({
      itemCode: code,
      itemDesc: data.desc,
      qtySold: data.qty,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Payment method breakdown
  const paymentMap = new Map<string, { count: number; total: number }>();
  for (const inv of validInvoices) {
    const method = inv.payment_method;
    const existing = paymentMap.get(method);
    if (existing) {
      existing.count++;
      existing.total += inv.bill_amount;
    } else {
      paymentMap.set(method, { count: 1, total: inv.bill_amount });
    }
  }
  const paymentBreakdown: PaymentBreakdown[] = [...paymentMap.entries()]
    .map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
      pct: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Revenue by hour
  const revenueByHour: Record<string, number> = {};
  for (const inv of validInvoices) {
    const hour = inv.invoice_date.substring(11, 13) || '00';
    revenueByHour[hour] = (revenueByHour[hour] ?? 0) + inv.bill_amount;
  }

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  for (const item of items) {
    if (!validInvoiceNos.has(item.invoice_no) || item.is_void) continue;
    categoryBreakdown[item.category] = (categoryBreakdown[item.category] ?? 0) + item.total_amount;
  }

  return {
    totalRevenue,
    transactionCount,
    avgTicket,
    customerCount,
    voidCount,
    voidAmount,
    refundCount,
    refundAmount,
    topSellers,
    paymentBreakdown,
    revenueByHour,
    categoryBreakdown,
  };
}

export class DailyFlashSkill implements ArosSkill {
  readonly id = 'daily-flash';
  readonly name = 'Daily Flash';
  readonly category = 'sales-revenue' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoices', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [invoices, items] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getInvoiceItems(dateRange),
    ]);

    const flash = computeDailyFlash(invoices, items);
    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Alert on high void rate (>2% of transactions)
    const voidRate =
      flash.transactionCount > 0 ? (flash.voidCount / flash.transactionCount) * 100 : 0;
    if (voidRate > 2) {
      alerts.push({
        severity: 'warning',
        message: `Void rate ${voidRate.toFixed(1)}% exceeds 2% threshold (${flash.voidCount} voids)`,
        code: 'HIGH_VOID_RATE',
        value: voidRate,
        threshold: 2,
      });
    }

    // Alert on high refund rate (>1% of revenue)
    const refundRate = flash.totalRevenue > 0 ? (flash.refundAmount / flash.totalRevenue) * 100 : 0;
    if (refundRate > 1) {
      alerts.push({
        severity: 'warning',
        message: `Refund amount $${flash.refundAmount.toFixed(2)} is ${refundRate.toFixed(1)}% of revenue`,
        code: 'HIGH_REFUND_RATE',
        value: refundRate,
        threshold: 1,
      });
    }

    // Alert if zero transactions
    if (flash.transactionCount === 0) {
      alerts.push({
        severity: 'critical',
        message: 'No transactions recorded for this period',
        code: 'NO_TRANSACTIONS',
      });
    }

    const summary =
      flash.transactionCount > 0
        ? `Revenue: $${flash.totalRevenue.toFixed(2)} across ${flash.transactionCount} transactions (avg ticket $${flash.avgTicket.toFixed(2)}). ${flash.voidCount} voids, ${flash.refundCount} refunds.`
        : 'No transactions recorded for this period.';

    return {
      skillId: this.id,
      timestamp: new Date().toISOString(),
      summary,
      alerts,
      actions,
      data: flash as unknown as Record<string, unknown>,
    };
  }
}
