/**
 * Transaction Profiler — Deep Transaction Pattern Analysis
 *
 * Analyzes transactions across multiple dimensions:
 * - Items per basket distribution
 * - Payment type patterns and trends
 * - Time-of-day revenue curves
 * - Cashier-transaction correlations
 * - Discount and void patterns
 * - Peak vs off-peak comparisons
 *
 * Provides the analytical foundation for staffing, pricing,
 * and operational decisions.
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

interface BasketSizeDistribution {
  itemCount: number;
  basketCount: number;
  avgTicket: number;
  pctOfBaskets: number;
}

interface PaymentTypeProfile {
  method: string;
  transactionCount: number;
  totalRevenue: number;
  avgTicket: number;
  pctOfTransactions: number;
  pctOfRevenue: number;
}

interface HourlyProfile {
  hour: number;
  transactionCount: number;
  revenue: number;
  avgTicket: number;
  avgItemsPerBasket: number;
  isPeak: boolean;
}

interface CashierCorrelation {
  cashierName: string;
  transactionCount: number;
  avgTicket: number;
  avgItemsPerBasket: number;
  discountRate: number;
  /** Deviation from store average ticket */
  ticketDeviation: number;
}

interface TransactionProfilerData {
  basketSizeDistribution: BasketSizeDistribution[];
  paymentProfiles: PaymentTypeProfile[];
  hourlyProfiles: HourlyProfile[];
  cashierCorrelations: CashierCorrelation[];
  overallMetrics: {
    totalTransactions: number;
    totalRevenue: number;
    avgTicket: number;
    medianTicket: number;
    avgItemsPerBasket: number;
    peakHour: number;
    offPeakHour: number;
    peakToOffPeakRatio: number;
  };
}

export class TransactionProfilerSkill implements ArosSkill {
  readonly id = 'transaction-profiler';
  readonly name = 'Transaction Profiler';
  readonly category = 'sales-revenue' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['invoices', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [invoices, items] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getInvoiceItems(dateRange),
    ]);

    const valid = invoices.filter((inv) => !inv.is_void);
    const totalTxns = valid.length;
    const totalRevenue = valid.reduce((s, inv) => s + inv.bill_amount, 0);
    const avgTicket = totalTxns > 0 ? totalRevenue / totalTxns : 0;

    // Median ticket
    const sortedTickets = valid.map((inv) => inv.bill_amount).sort((a, b) => a - b);
    const medianTicket =
      sortedTickets.length > 0 ? (sortedTickets[Math.floor(sortedTickets.length / 2)] ?? 0) : 0;

    // Items per basket
    const basketItemCounts = new Map<string, number>();
    for (const item of items) {
      if (item.is_void) continue;
      basketItemCounts.set(item.invoice_no, (basketItemCounts.get(item.invoice_no) ?? 0) + 1);
    }

    const totalItemsSold = [...basketItemCounts.values()].reduce((s, c) => s + c, 0);
    const avgItemsPerBasket =
      basketItemCounts.size > 0 ? totalItemsSold / basketItemCounts.size : 0;

    // Basket size distribution
    const sizeMap = new Map<number, { count: number; revenue: number }>();
    for (const inv of valid) {
      const itemCount = basketItemCounts.get(inv.invoice_no) ?? 1;
      const existing = sizeMap.get(itemCount);
      if (existing) {
        existing.count++;
        existing.revenue += inv.bill_amount;
      } else {
        sizeMap.set(itemCount, { count: 1, revenue: inv.bill_amount });
      }
    }
    const basketSizeDistribution: BasketSizeDistribution[] = [...sizeMap.entries()]
      .map(([itemCount, d]) => ({
        itemCount,
        basketCount: d.count,
        avgTicket: d.count > 0 ? d.revenue / d.count : 0,
        pctOfBaskets: totalTxns > 0 ? (d.count / totalTxns) * 100 : 0,
      }))
      .sort((a, b) => a.itemCount - b.itemCount);

    // Payment type profiles
    const payMap = new Map<string, { count: number; revenue: number }>();
    for (const inv of valid) {
      const existing = payMap.get(inv.payment_method);
      if (existing) {
        existing.count++;
        existing.revenue += inv.bill_amount;
      } else {
        payMap.set(inv.payment_method, { count: 1, revenue: inv.bill_amount });
      }
    }
    const paymentProfiles: PaymentTypeProfile[] = [...payMap.entries()]
      .map(([method, d]) => ({
        method,
        transactionCount: d.count,
        totalRevenue: d.revenue,
        avgTicket: d.count > 0 ? d.revenue / d.count : 0,
        pctOfTransactions: totalTxns > 0 ? (d.count / totalTxns) * 100 : 0,
        pctOfRevenue: totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Hourly profiles
    const hourMap = new Map<number, { count: number; revenue: number; items: number }>();
    for (const inv of valid) {
      const hour = new Date(inv.invoice_date).getHours();
      const itemCount = basketItemCounts.get(inv.invoice_no) ?? 1;
      const existing = hourMap.get(hour);
      if (existing) {
        existing.count++;
        existing.revenue += inv.bill_amount;
        existing.items += itemCount;
      } else {
        hourMap.set(hour, { count: 1, revenue: inv.bill_amount, items: itemCount });
      }
    }

    const maxHourlyRevenue = Math.max(...[...hourMap.values()].map((h) => h.revenue), 0);
    const peakThreshold = maxHourlyRevenue * 0.6;

    const hourlyProfiles: HourlyProfile[] = [...hourMap.entries()]
      .map(([hour, d]) => ({
        hour,
        transactionCount: d.count,
        revenue: d.revenue,
        avgTicket: d.count > 0 ? d.revenue / d.count : 0,
        avgItemsPerBasket: d.count > 0 ? d.items / d.count : 0,
        isPeak: d.revenue >= peakThreshold,
      }))
      .sort((a, b) => a.hour - b.hour);

    const peakHour = hourlyProfiles.reduce(
      (best, h) => (h.revenue > best.revenue ? h : best),
      hourlyProfiles[0] ?? {
        hour: 0,
        revenue: 0,
        transactionCount: 0,
        avgTicket: 0,
        avgItemsPerBasket: 0,
        isPeak: false,
      },
    ).hour;

    const offPeakEntries = hourlyProfiles.filter((h) => !h.isPeak && h.transactionCount > 0);
    const offPeakHour =
      offPeakEntries.length > 0
        ? offPeakEntries.reduce(
            (best, h) => (h.revenue < best.revenue ? h : best),
            offPeakEntries[0]!,
          ).hour
        : 0;

    const peakRevenue = hourMap.get(peakHour)?.revenue ?? 0;
    const offPeakRevenue = hourMap.get(offPeakHour)?.revenue ?? 1;
    const peakToOffPeakRatio = offPeakRevenue > 0 ? peakRevenue / offPeakRevenue : 0;

    // Cashier correlations
    const cashierMap = new Map<
      string,
      { count: number; revenue: number; items: number; discounts: number }
    >();
    for (const inv of valid) {
      const itemCount = basketItemCounts.get(inv.invoice_no) ?? 1;
      const existing = cashierMap.get(inv.cashier_name);
      if (existing) {
        existing.count++;
        existing.revenue += inv.bill_amount;
        existing.items += itemCount;
        existing.discounts += inv.discount_amount;
      } else {
        cashierMap.set(inv.cashier_name, {
          count: 1,
          revenue: inv.bill_amount,
          items: itemCount,
          discounts: inv.discount_amount,
        });
      }
    }

    const cashierCorrelations: CashierCorrelation[] = [...cashierMap.entries()]
      .map(([name, d]) => {
        const cashierAvgTicket = d.count > 0 ? d.revenue / d.count : 0;
        return {
          cashierName: name,
          transactionCount: d.count,
          avgTicket: cashierAvgTicket,
          avgItemsPerBasket: d.count > 0 ? d.items / d.count : 0,
          discountRate: d.revenue > 0 ? (d.discounts / d.revenue) * 100 : 0,
          ticketDeviation: avgTicket > 0 ? ((cashierAvgTicket - avgTicket) / avgTicket) * 100 : 0,
        };
      })
      .sort((a, b) => b.transactionCount - a.transactionCount);

    const data: TransactionProfilerData = {
      basketSizeDistribution,
      paymentProfiles,
      hourlyProfiles,
      cashierCorrelations,
      overallMetrics: {
        totalTransactions: totalTxns,
        totalRevenue,
        avgTicket,
        medianTicket,
        avgItemsPerBasket,
        peakHour,
        offPeakHour,
        peakToOffPeakRatio,
      },
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Flag cashiers with significantly different avg tickets
    for (const c of cashierCorrelations) {
      if (Math.abs(c.ticketDeviation) > 20 && c.transactionCount >= 10) {
        alerts.push({
          severity: 'info',
          message: `${c.cashierName}: avg ticket $${c.avgTicket.toFixed(2)} is ${c.ticketDeviation > 0 ? '+' : ''}${c.ticketDeviation.toFixed(0)}% vs store avg — ${c.ticketDeviation > 0 ? 'upselling well' : 'may need upsell training'}`,
          code: 'CASHIER_TICKET_DEVIATION',
          entity: c.cashierName,
          value: c.ticketDeviation,
        });
      }
    }

    // Staffing optimization
    if (peakToOffPeakRatio > 3) {
      actions.push({
        description: `Peak-to-off-peak ratio is ${peakToOffPeakRatio.toFixed(1)}x — consider shifting staff from ${offPeakHour}:00 to ${peakHour}:00`,
        priority: 3,
        automatable: false,
      });
    }

    // Single-item basket opportunity
    const singleItem = basketSizeDistribution.find((b) => b.itemCount === 1);
    if (singleItem && singleItem.pctOfBaskets > 40) {
      actions.push({
        description: `${singleItem.pctOfBaskets.toFixed(0)}% of baskets are single-item — implement cashier upsell prompts to increase basket size`,
        priority: 3,
        automatable: false,
      });
    }

    const summary = `${totalTxns} transactions, $${totalRevenue.toFixed(2)} revenue. Avg ticket: $${avgTicket.toFixed(2)}, median: $${medianTicket.toFixed(2)}, avg ${avgItemsPerBasket.toFixed(1)} items/basket. Peak at ${peakHour}:00 (${peakToOffPeakRatio.toFixed(1)}x off-peak).`;

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
