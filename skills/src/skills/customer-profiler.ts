/**
 * Customer Profiler — Transaction-Based Customer Intelligence
 *
 * Builds customer profiles from POS transaction data:
 * - Visit frequency (daily, weekly, occasional, one-time)
 * - Average spend per visit
 * - Preferred items / categories
 * - Time-of-day patterns (morning person, evening shopper)
 * - Day-of-week patterns
 * - Spend trend (increasing, decreasing, stable)
 *
 * Note: Most c-stores don't have loyalty programs, so we profile
 * by payment method fingerprint + time patterns. Phase 2 will
 * add receipt phone number / loyalty card matching.
 *
 * For Phase 1, we aggregate at the store level to identify
 * customer segments and shopping patterns.
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

interface CustomerSegment {
  name: string;
  description: string;
  transactionCount: number;
  avgTicket: number;
  totalRevenue: number;
  pctOfTransactions: number;
  pctOfRevenue: number;
  peakHour: string;
  topCategories: string[];
}

interface TimePattern {
  hour: number;
  transactionCount: number;
  avgTicket: number;
  totalRevenue: number;
}

interface DayPattern {
  day: string;
  transactionCount: number;
  avgTicket: number;
  totalRevenue: number;
}

interface CustomerProfilerData {
  segments: CustomerSegment[];
  timePatterns: TimePattern[];
  dayPatterns: DayPattern[];
  totalCustomers: number;
  avgVisitValue: number;
  repeatIndicator: number;
  peakHour: number;
  peakDay: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class CustomerProfilerSkill implements ArosSkill {
  readonly id = 'customer-profiler';
  readonly name = 'Customer Profiler';
  readonly category = 'marketing' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['invoices', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [invoices, items] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getInvoiceItems(dateRange),
    ]);

    const valid = invoices.filter(inv => !inv.is_void);

    // Time-of-day patterns
    const hourMap = new Map<number, { count: number; revenue: number }>();
    for (const inv of valid) {
      const hour = new Date(inv.invoice_date).getHours();
      const existing = hourMap.get(hour);
      if (existing) {
        existing.count++;
        existing.revenue += inv.bill_amount;
      } else {
        hourMap.set(hour, { count: 1, revenue: inv.bill_amount });
      }
    }

    const timePatterns: TimePattern[] = [...hourMap.entries()]
      .map(([hour, d]) => ({
        hour,
        transactionCount: d.count,
        avgTicket: d.count > 0 ? d.revenue / d.count : 0,
        totalRevenue: d.revenue,
      }))
      .sort((a, b) => a.hour - b.hour);

    // Day-of-week patterns
    const dayMap = new Map<number, { count: number; revenue: number }>();
    for (const inv of valid) {
      const day = new Date(inv.invoice_date).getDay();
      const existing = dayMap.get(day);
      if (existing) {
        existing.count++;
        existing.revenue += inv.bill_amount;
      } else {
        dayMap.set(day, { count: 1, revenue: inv.bill_amount });
      }
    }

    const dayPatterns: DayPattern[] = [...dayMap.entries()]
      .map(([day, d]) => ({
        day: DAY_NAMES[day] ?? `Day${day}`,
        transactionCount: d.count,
        avgTicket: d.count > 0 ? d.revenue / d.count : 0,
        totalRevenue: d.revenue,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Ticket-size based segmentation
    const tickets = valid.map(inv => inv.bill_amount).sort((a, b) => a - b);
    const totalRevenue = valid.reduce((s, inv) => s + inv.bill_amount, 0);
    const totalTxns = valid.length;

    // Build item category map for each invoice
    const invoiceCategories = new Map<string, Set<string>>();
    for (const item of items) {
      if (item.is_void) continue;
      const cats = invoiceCategories.get(item.invoice_no);
      if (cats) {
        cats.add(item.category);
      } else {
        invoiceCategories.set(item.invoice_no, new Set([item.category]));
      }
    }

    // Segment by ticket size
    const segments: CustomerSegment[] = [];
    const segmentDefs = [
      { name: 'Quick Stop', desc: 'Single item, low ticket', min: 0, max: 5 },
      { name: 'Regular', desc: 'Standard basket, moderate spend', min: 5, max: 20 },
      { name: 'Stock Up', desc: 'Larger basket, high spend', min: 20, max: 50 },
      { name: 'Big Basket', desc: 'Large purchase, bulk buyer', min: 50, max: Infinity },
    ];

    for (const seg of segmentDefs) {
      const segInvoices = valid.filter(
        inv => inv.bill_amount >= seg.min && inv.bill_amount < seg.max
      );
      if (segInvoices.length === 0) continue;

      const segRevenue = segInvoices.reduce((s, inv) => s + inv.bill_amount, 0);

      // Find peak hour for this segment
      const segHourMap = new Map<number, number>();
      for (const inv of segInvoices) {
        const h = new Date(inv.invoice_date).getHours();
        segHourMap.set(h, (segHourMap.get(h) ?? 0) + 1);
      }
      let peakHour = 0;
      let peakCount = 0;
      for (const [h, c] of segHourMap) {
        if (c > peakCount) { peakHour = h; peakCount = c; }
      }

      // Top categories
      const catCounts = new Map<string, number>();
      for (const inv of segInvoices) {
        const cats = invoiceCategories.get(inv.invoice_no);
        if (cats) {
          for (const cat of cats) {
            catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
          }
        }
      }
      const topCategories = [...catCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat]) => cat);

      segments.push({
        name: seg.name,
        description: seg.desc,
        transactionCount: segInvoices.length,
        avgTicket: segRevenue / segInvoices.length,
        totalRevenue: segRevenue,
        pctOfTransactions: (segInvoices.length / totalTxns) * 100,
        pctOfRevenue: totalRevenue > 0 ? (segRevenue / totalRevenue) * 100 : 0,
        peakHour: `${peakHour}:00`,
        topCategories,
      });
    }

    // Peak hour and day
    const peakHourEntry = timePatterns.reduce(
      (best, tp) => tp.totalRevenue > best.totalRevenue ? tp : best,
      timePatterns[0] ?? { hour: 0, transactionCount: 0, avgTicket: 0, totalRevenue: 0 }
    );
    const peakDayEntry = dayPatterns[0];

    const totalCustomers = valid.reduce((s, inv) => s + inv.customer_count, 0);
    const avgVisitValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Repeat indicator: ratio of customers to transactions
    // Lower = more repeat visits (one customer, multiple transactions)
    const repeatIndicator = totalTxns > 0 ? totalCustomers / totalTxns : 1;

    const data: CustomerProfilerData = {
      segments,
      timePatterns,
      dayPatterns,
      totalCustomers,
      avgVisitValue,
      repeatIndicator,
      peakHour: peakHourEntry.hour,
      peakDay: peakDayEntry?.day ?? 'N/A',
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Action: optimize for peak patterns
    if (segments.length > 0) {
      const biggestSegment = segments.reduce(
        (best, s) => s.pctOfRevenue > best.pctOfRevenue ? s : best,
        segments[0]!
      );
      actions.push({
        description: `"${biggestSegment.name}" segment drives ${biggestSegment.pctOfRevenue.toFixed(0)}% of revenue — optimize store layout and promotions for this group`,
        priority: 3,
        automatable: false,
      });
    }

    if (peakDayEntry) {
      actions.push({
        description: `${peakDayEntry.day} is your best day ($${peakDayEntry.totalRevenue.toFixed(2)}) — ensure full staffing and stocked shelves`,
        priority: 4,
        automatable: false,
      });
    }

    const summary = `${totalCustomers} customers, ${totalTxns} transactions, avg $${avgVisitValue.toFixed(2)}/visit. ${segments.length} segments identified. Peak: ${peakHourEntry.hour}:00 on ${peakDayEntry?.day ?? 'N/A'}.`;

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
