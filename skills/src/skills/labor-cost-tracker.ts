/**
 * Labor Cost Tracker — Labor % of Revenue by Shift & Day
 *
 * Monitors labor cost as a percentage of sales revenue, broken down
 * by shift (morning/afternoon/evening) and day of week. Alerts when
 * labor exceeds the store's target percentage.
 *
 * Key insight: a store can be profitable on revenue but unprofitable
 * on labor if scheduling doesn't match traffic patterns.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceRow,
  EmployeeRow,
  Alert,
  Action,
} from '../types.js';

interface ShiftLaborMetrics {
  shift: string;
  laborCost: number;
  revenue: number;
  laborPct: number;
  employeeCount: number;
  overTarget: boolean;
}

interface DayLaborMetrics {
  date: string;
  laborCost: number;
  revenue: number;
  laborPct: number;
  shifts: ShiftLaborMetrics[];
  overTarget: boolean;
}

interface LaborCostTrackerData {
  dailyMetrics: DayLaborMetrics[];
  overallLaborCost: number;
  overallRevenue: number;
  overallLaborPct: number;
  overTargetDays: number;
  overTargetShifts: number;
  busiestShift: string | null;
  mostExpensiveShift: string | null;
}

export class LaborCostTrackerSkill implements ArosSkill {
  readonly id = 'labor-cost-tracker';
  readonly name = 'Labor Cost Tracker';
  readonly category = 'workforce' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoices', 'employees'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, store } = context;

    const [invoices, employees] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getEmployees(dateRange.start),
    ]);

    const target = store.targetLaborPct;

    // Group invoices by date and shift
    const dateShiftRevenue = new Map<string, Map<string, number>>();
    for (const inv of invoices) {
      if (inv.is_void) continue;
      const date = inv.invoice_date.substring(0, 10);
      let dateMap = dateShiftRevenue.get(date);
      if (!dateMap) {
        dateMap = new Map<string, number>();
        dateShiftRevenue.set(date, dateMap);
      }
      dateMap.set(inv.shift, (dateMap.get(inv.shift) ?? 0) + inv.bill_amount);
    }

    // Group employees by shift
    const shiftLabor = new Map<string, { cost: number; count: number }>();
    for (const emp of employees) {
      const cost = emp.hourly_rate * emp.actual_hours;
      const existing = shiftLabor.get(emp.shift);
      if (existing) {
        existing.cost += cost;
        existing.count++;
      } else {
        shiftLabor.set(emp.shift, { cost, count: 1 });
      }
    }

    const dailyMetrics: DayLaborMetrics[] = [];
    let overTargetDays = 0;
    let overTargetShifts = 0;
    let overallLaborCost = 0;
    let overallRevenue = 0;

    // Shift-level totals for finding busiest/most expensive
    const shiftTotals = new Map<string, { revenue: number; labor: number }>();

    for (const [date, shiftRevMap] of dateShiftRevenue) {
      let dayLaborCost = 0;
      let dayRevenue = 0;
      const shifts: ShiftLaborMetrics[] = [];

      for (const [shift, revenue] of shiftRevMap) {
        const labor = shiftLabor.get(shift);
        const laborCost = labor?.cost ?? 0;
        const laborPct = revenue > 0 ? (laborCost / revenue) * 100 : 0;
        const overTarget = laborPct > target;

        if (overTarget) overTargetShifts++;
        dayLaborCost += laborCost;
        dayRevenue += revenue;

        shifts.push({
          shift,
          laborCost,
          revenue,
          laborPct,
          employeeCount: labor?.count ?? 0,
          overTarget,
        });

        // Accumulate shift totals
        const st = shiftTotals.get(shift);
        if (st) {
          st.revenue += revenue;
          st.labor += laborCost;
        } else {
          shiftTotals.set(shift, { revenue, labor: laborCost });
        }
      }

      const dayLaborPct = dayRevenue > 0 ? (dayLaborCost / dayRevenue) * 100 : 0;
      const dayOverTarget = dayLaborPct > target;
      if (dayOverTarget) overTargetDays++;

      overallLaborCost += dayLaborCost;
      overallRevenue += dayRevenue;

      dailyMetrics.push({
        date,
        laborCost: dayLaborCost,
        revenue: dayRevenue,
        laborPct: dayLaborPct,
        shifts,
        overTarget: dayOverTarget,
      });
    }

    dailyMetrics.sort((a, b) => a.date.localeCompare(b.date));

    const overallLaborPct = overallRevenue > 0
      ? (overallLaborCost / overallRevenue) * 100
      : 0;

    // Find busiest and most expensive shifts
    let busiestShift: string | null = null;
    let mostExpensiveShift: string | null = null;
    let maxRevenue = 0;
    let maxLaborPct = 0;

    for (const [shift, totals] of shiftTotals) {
      if (totals.revenue > maxRevenue) {
        maxRevenue = totals.revenue;
        busiestShift = shift;
      }
      const pct = totals.revenue > 0 ? (totals.labor / totals.revenue) * 100 : 0;
      if (pct > maxLaborPct) {
        maxLaborPct = pct;
        mostExpensiveShift = shift;
      }
    }

    const data: LaborCostTrackerData = {
      dailyMetrics,
      overallLaborCost,
      overallRevenue,
      overallLaborPct,
      overTargetDays,
      overTargetShifts,
      busiestShift,
      mostExpensiveShift,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (overallLaborPct > target) {
      alerts.push({
        severity: 'warning',
        message: `Labor cost ${overallLaborPct.toFixed(1)}% exceeds ${target}% target ($${overallLaborCost.toFixed(2)} on $${overallRevenue.toFixed(2)} revenue)`,
        code: 'LABOR_OVER_TARGET',
        value: overallLaborPct,
        threshold: target,
      });
      actions.push({
        description: `Review scheduling — labor at ${overallLaborPct.toFixed(1)}% vs ${target}% target. Consider reducing hours on slow shifts.`,
        priority: 2,
        automatable: false,
      });
    }

    if (mostExpensiveShift && maxLaborPct > target * 1.5) {
      alerts.push({
        severity: 'warning',
        message: `${mostExpensiveShift} shift labor at ${maxLaborPct.toFixed(1)}% — significantly over target`,
        code: 'SHIFT_LABOR_HIGH',
        entity: mostExpensiveShift,
        value: maxLaborPct,
        threshold: target,
      });
    }

    const summary = `Labor: $${overallLaborCost.toFixed(2)} (${overallLaborPct.toFixed(1)}% of $${overallRevenue.toFixed(2)} revenue, target ${target}%). ${overTargetDays} day(s) over target. Busiest: ${busiestShift ?? 'N/A'}, most expensive: ${mostExpensiveShift ?? 'N/A'}.`;

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
