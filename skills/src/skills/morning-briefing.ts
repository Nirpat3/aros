/**
 * Morning Briefing — Daily 6 AM Owner Intelligence Report
 *
 * The "front page" of AROS. Composes data from multiple skills into
 * a single actionable morning report for the store owner:
 *
 * 1. Yesterday's sales snapshot (from daily-flash)
 * 2. Cash position (from cash-reconciler)
 * 3. Inventory alerts (from stock-pulse)
 * 4. Today's schedule / staffing
 * 5. Weather impact (placeholder for weather API)
 * 6. Action items requiring attention
 *
 * This skill demonstrates composition: it calls sub-skills and
 * aggregates their outputs into a unified briefing.
 */

import type { ArosSkill, SkillContext, SkillOutput, EmployeeRow, Alert, Action } from '../types.js';

import { DailyFlashSkill } from './daily-flash.js';
import { StockPulseSkill } from './stock-pulse.js';
import { CashReconcilerSkill } from './cash-reconciler.js';

interface MorningBriefingData {
  salesSnapshot: Record<string, unknown>;
  cashPosition: Record<string, unknown>;
  inventoryAlerts: Record<string, unknown>;
  todaySchedule: EmployeeRow[];
  scheduledHours: number;
  estimatedLaborCost: number;
  actionItemCount: number;
}

export class MorningBriefingSkill implements ArosSkill {
  readonly id = 'morning-briefing';
  readonly name = 'Morning Briefing';
  readonly category = 'owner-intelligence' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = [
    'invoices',
    'invoice_items',
    'inventory',
    'register_readings',
    'employees',
  ];

  private dailyFlash = new DailyFlashSkill();
  private stockPulse = new StockPulseSkill();
  private cashReconciler = new CashReconcilerSkill();

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, today } = context;

    // Run sub-skills in parallel
    const [flashOutput, stockOutput, cashOutput, todaySchedule] = await Promise.all([
      this.dailyFlash.execute(context),
      this.stockPulse.execute(context),
      this.cashReconciler.execute(context),
      connector.getEmployees(today),
    ]);

    // Aggregate staffing info
    const scheduledHours = todaySchedule.reduce((s, e) => s + e.scheduled_hours, 0);
    const estimatedLaborCost = todaySchedule.reduce(
      (s, e) => s + e.hourly_rate * e.scheduled_hours,
      0,
    );

    // Merge all alerts, sorted by severity
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const allAlerts: Alert[] = [
      ...flashOutput.alerts,
      ...stockOutput.alerts,
      ...cashOutput.alerts,
    ].sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    // Merge all actions, sorted by priority
    const allActions: Action[] = [
      ...flashOutput.actions,
      ...stockOutput.actions,
      ...cashOutput.actions,
    ].sort((a, b) => a.priority - b.priority);

    // Add schedule-related info
    if (todaySchedule.length === 0) {
      allAlerts.push({
        severity: 'warning',
        message: 'No employees scheduled for today',
        code: 'NO_SCHEDULE',
      });
    }

    const data: MorningBriefingData = {
      salesSnapshot: flashOutput.data,
      cashPosition: cashOutput.data,
      inventoryAlerts: stockOutput.data,
      todaySchedule,
      scheduledHours,
      estimatedLaborCost,
      actionItemCount: allActions.length,
    };

    const criticalCount = allAlerts.filter((a) => a.severity === 'critical').length;
    const warningCount = allAlerts.filter((a) => a.severity === 'warning').length;

    // Build summary from sub-skill summaries
    const lines = [
      `📊 Sales: ${flashOutput.summary}`,
      `💰 Cash: ${cashOutput.summary}`,
      `📦 Inventory: ${stockOutput.summary}`,
      `👥 Staff: ${todaySchedule.length} employees, ${scheduledHours}h scheduled ($${estimatedLaborCost.toFixed(2)} est. labor)`,
    ];

    if (criticalCount > 0 || warningCount > 0) {
      lines.push(
        `⚠️ ${criticalCount} critical, ${warningCount} warnings. ${allActions.length} action items.`,
      );
    }

    return {
      skillId: this.id,
      timestamp: new Date().toISOString(),
      summary: lines.join(' | '),
      alerts: allAlerts,
      actions: allActions,
      data: data as unknown as Record<string, unknown>,
    };
  }
}
