/**
 * Waste Logger — Spoilage, Damage & Waste Tracking
 *
 * Tracks all waste/spoilage/damage events with reason codes.
 * Calculates dollar value at cost and identifies trends:
 * - Which categories waste the most
 * - Which reason codes are most common
 * - Day-of-week waste patterns (e.g., Monday morning after weekend)
 * - Employee patterns (who logs the most waste)
 *
 * Helps operators reduce shrink by identifying systemic waste issues.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  WasteLogRow,
  Alert,
  Action,
} from '../types.js';

interface WasteByCategoryData {
  category: string;
  totalCost: number;
  totalQty: number;
  entryCount: number;
  pctOfTotalWaste: number;
  topReasons: Array<{ reason: string; count: number; cost: number }>;
}

interface WasteByReasonData {
  reasonCode: string;
  reasonDesc: string;
  totalCost: number;
  totalQty: number;
  entryCount: number;
  pctOfTotalWaste: number;
}

interface WasteByEmployeeData {
  employee: string;
  totalCost: number;
  entryCount: number;
  topCategories: string[];
}

interface WasteLoggerData {
  totalWasteCost: number;
  totalWasteQty: number;
  totalEntries: number;
  byCategory: WasteByCategoryData[];
  byReason: WasteByReasonData[];
  byEmployee: WasteByEmployeeData[];
  dailyTrend: Array<{ date: string; cost: number; entries: number }>;
  wasteAsRevenuePercent: number;
}

export class WasteLoggerSkill implements ArosSkill {
  readonly id = 'waste-logger';
  readonly name = 'Waste Logger';
  readonly category = 'inventory' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['waste_logs', 'invoices'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [wasteLogs, invoices] = await Promise.all([
      connector.getWasteLogs(dateRange),
      connector.getInvoices(dateRange),
    ]);

    const totalRevenue = invoices
      .filter(inv => !inv.is_void)
      .reduce((s, inv) => s + inv.bill_amount, 0);

    const totalWasteCost = wasteLogs.reduce((s, w) => s + w.total_cost, 0);
    const totalWasteQty = wasteLogs.reduce((s, w) => s + w.qty_wasted, 0);

    // By category
    const catMap = new Map<string, {
      cost: number; qty: number; count: number;
      reasons: Map<string, { count: number; cost: number }>;
    }>();
    for (const w of wasteLogs) {
      let cat = catMap.get(w.category);
      if (!cat) {
        cat = { cost: 0, qty: 0, count: 0, reasons: new Map() };
        catMap.set(w.category, cat);
      }
      cat.cost += w.total_cost;
      cat.qty += w.qty_wasted;
      cat.count++;
      const reason = cat.reasons.get(w.reason_code);
      if (reason) {
        reason.count++;
        reason.cost += w.total_cost;
      } else {
        cat.reasons.set(w.reason_code, { count: 1, cost: w.total_cost });
      }
    }

    const byCategory: WasteByCategoryData[] = [...catMap.entries()]
      .map(([category, d]) => ({
        category,
        totalCost: d.cost,
        totalQty: d.qty,
        entryCount: d.count,
        pctOfTotalWaste: totalWasteCost > 0 ? (d.cost / totalWasteCost) * 100 : 0,
        topReasons: [...d.reasons.entries()]
          .map(([reason, rd]) => ({ reason, count: rd.count, cost: rd.cost }))
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 5),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // By reason
    const reasonMap = new Map<string, { desc: string; cost: number; qty: number; count: number }>();
    for (const w of wasteLogs) {
      const existing = reasonMap.get(w.reason_code);
      if (existing) {
        existing.cost += w.total_cost;
        existing.qty += w.qty_wasted;
        existing.count++;
      } else {
        reasonMap.set(w.reason_code, {
          desc: w.reason_desc,
          cost: w.total_cost,
          qty: w.qty_wasted,
          count: 1,
        });
      }
    }
    const byReason: WasteByReasonData[] = [...reasonMap.entries()]
      .map(([code, d]) => ({
        reasonCode: code,
        reasonDesc: d.desc,
        totalCost: d.cost,
        totalQty: d.qty,
        entryCount: d.count,
        pctOfTotalWaste: totalWasteCost > 0 ? (d.cost / totalWasteCost) * 100 : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // By employee
    const empMap = new Map<string, { cost: number; count: number; cats: Map<string, number> }>();
    for (const w of wasteLogs) {
      let emp = empMap.get(w.logged_by);
      if (!emp) {
        emp = { cost: 0, count: 0, cats: new Map() };
        empMap.set(w.logged_by, emp);
      }
      emp.cost += w.total_cost;
      emp.count++;
      emp.cats.set(w.category, (emp.cats.get(w.category) ?? 0) + 1);
    }
    const byEmployee: WasteByEmployeeData[] = [...empMap.entries()]
      .map(([employee, d]) => ({
        employee,
        totalCost: d.cost,
        entryCount: d.count,
        topCategories: [...d.cats.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat]) => cat),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Daily trend
    const dayMap = new Map<string, { cost: number; entries: number }>();
    for (const w of wasteLogs) {
      const date = w.logged_at.substring(0, 10);
      const existing = dayMap.get(date);
      if (existing) {
        existing.cost += w.total_cost;
        existing.entries++;
      } else {
        dayMap.set(date, { cost: w.total_cost, entries: 1 });
      }
    }
    const dailyTrend = [...dayMap.entries()]
      .map(([date, d]) => ({ date, cost: d.cost, entries: d.entries }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const wasteAsRevenuePercent = totalRevenue > 0
      ? (totalWasteCost / totalRevenue) * 100
      : 0;

    const data: WasteLoggerData = {
      totalWasteCost,
      totalWasteQty,
      totalEntries: wasteLogs.length,
      byCategory,
      byReason,
      byEmployee,
      dailyTrend,
      wasteAsRevenuePercent,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (wasteAsRevenuePercent > 2) {
      alerts.push({
        severity: 'critical',
        message: `Waste at ${wasteAsRevenuePercent.toFixed(1)}% of revenue ($${totalWasteCost.toFixed(2)}) — exceeds 2% threshold`,
        code: 'HIGH_WASTE_RATE',
        value: wasteAsRevenuePercent,
        threshold: 2,
      });
    } else if (wasteAsRevenuePercent > 1) {
      alerts.push({
        severity: 'warning',
        message: `Waste at ${wasteAsRevenuePercent.toFixed(1)}% of revenue ($${totalWasteCost.toFixed(2)})`,
        code: 'ELEVATED_WASTE_RATE',
        value: wasteAsRevenuePercent,
        threshold: 1,
      });
    }

    // Top waste category action
    if (byCategory.length > 0) {
      const top = byCategory[0]!;
      actions.push({
        description: `Review ${top.category} waste — $${top.totalCost.toFixed(2)} (${top.pctOfTotalWaste.toFixed(0)}% of all waste). Top reason: ${top.topReasons[0]?.reason ?? 'unknown'}`,
        priority: 2,
        automatable: false,
      });
    }

    // Top reason action
    if (byReason.length > 0 && byReason[0]!.reasonCode === 'expired') {
      actions.push({
        description: `Expired products are #1 waste reason ($${byReason[0]!.totalCost.toFixed(2)}) — review ordering quantities and FIFO rotation`,
        priority: 2,
        automatable: false,
      });
    }

    const summary = `Waste: $${totalWasteCost.toFixed(2)} (${wasteAsRevenuePercent.toFixed(1)}% of revenue), ${wasteLogs.length} entries. Top category: ${byCategory[0]?.category ?? 'N/A'}. Top reason: ${byReason[0]?.reasonCode ?? 'N/A'}.`;

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
