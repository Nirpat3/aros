/**
 * Timecard Auditor — Clock-In/Out Validation & Fraud Detection
 *
 * Validates employee timecards for:
 * - Missed punches (clock-in without clock-out or vice versa)
 * - Buddy punching (employee clocks in for another — detected via
 *   overlapping shifts for same employee or implausible timing)
 * - Early clock-in / late clock-out padding
 * - Overtime approaching (alerts before threshold is crossed)
 * - Break compliance (missed or short breaks)
 *
 * Helps prevent payroll fraud and ensures labor law compliance.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  TimecardRow,
  Alert,
  Action,
} from '../types.js';

interface TimecardIssue {
  employeeId: string;
  employeeName: string;
  type: 'missed-punch' | 'overlap' | 'overtime-approaching' | 'overtime-exceeded' | 'long-shift' | 'short-break' | 'early-clock-in';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  clockIn: string;
  clockOut: string | null;
  hoursWorked: number;
}

interface EmployeeTimecardSummary {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  overtimeHours: number;
  punchCount: number;
  issues: TimecardIssue[];
  estimatedPayrollCost: number;
}

interface TimecardAuditorData {
  employees: EmployeeTimecardSummary[];
  totalIssues: number;
  missedPunches: number;
  overtimeAlerts: number;
  totalHoursWorked: number;
  totalOvertimeHours: number;
  estimatedTotalPayroll: number;
}

/** Weekly overtime threshold in hours */
const OVERTIME_THRESHOLD = 40;
/** Daily shift length that triggers a long-shift warning */
const LONG_SHIFT_HOURS = 10;
/** Max minutes early for clock-in before it's flagged */
const EARLY_CLOCK_IN_MINUTES = 15;
/** Standard hourly overtime multiplier */
const OVERTIME_MULTIPLIER = 1.5;

export class TimecardAuditorSkill implements ArosSkill {
  readonly id = 'timecard-auditor';
  readonly name = 'Timecard Auditor';
  readonly category = 'workforce' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['timecards', 'employees'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [timecards, employees] = await Promise.all([
      connector.getTimecards(dateRange),
      connector.getEmployees(dateRange.start),
    ]);

    // Build rate lookup
    const rateMap = new Map<string, number>();
    for (const emp of employees) {
      rateMap.set(emp.employee_id, emp.hourly_rate);
    }

    // Group timecards by employee
    const empCards = new Map<string, TimecardRow[]>();
    for (const tc of timecards) {
      const existing = empCards.get(tc.employee_id);
      if (existing) {
        existing.push(tc);
      } else {
        empCards.set(tc.employee_id, [tc]);
      }
    }

    const summaries: EmployeeTimecardSummary[] = [];
    let totalMissedPunches = 0;
    let totalOvertimeAlerts = 0;

    for (const [empId, cards] of empCards) {
      const issues: TimecardIssue[] = [];
      let totalHours = 0;
      let overtimeHours = 0;
      const rate = rateMap.get(empId) ?? 0;
      const empName = cards[0]?.employee_name ?? empId;

      for (const card of cards) {
        totalHours += card.total_hours;
        overtimeHours += card.overtime_hours;

        // Missed punch
        if (card.status === 'missed-punch' || card.clock_out === null) {
          totalMissedPunches++;
          issues.push({
            employeeId: empId,
            employeeName: empName,
            type: 'missed-punch',
            description: `Missing clock-out for shift starting ${card.clock_in}`,
            severity: 'warning',
            clockIn: card.clock_in,
            clockOut: card.clock_out,
            hoursWorked: card.total_hours,
          });
        }

        // Long shift
        if (card.total_hours > LONG_SHIFT_HOURS) {
          issues.push({
            employeeId: empId,
            employeeName: empName,
            type: 'long-shift',
            description: `${card.total_hours.toFixed(1)}h shift exceeds ${LONG_SHIFT_HOURS}h threshold`,
            severity: 'warning',
            clockIn: card.clock_in,
            clockOut: card.clock_out,
            hoursWorked: card.total_hours,
          });
        }

        // Short break (if shift > 6h, break should be >= 30min)
        if (card.total_hours > 6 && card.break_minutes < 30) {
          issues.push({
            employeeId: empId,
            employeeName: empName,
            type: 'short-break',
            description: `Only ${card.break_minutes}min break on ${card.total_hours.toFixed(1)}h shift (minimum 30min required)`,
            severity: 'warning',
            clockIn: card.clock_in,
            clockOut: card.clock_out,
            hoursWorked: card.total_hours,
          });
        }
      }

      // Check for overlapping shifts (buddy punching indicator)
      const sortedCards = [...cards].sort(
        (a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
      );
      for (let i = 0; i < sortedCards.length - 1; i++) {
        const current = sortedCards[i]!;
        const next = sortedCards[i + 1]!;
        if (current.clock_out) {
          const endTime = new Date(current.clock_out).getTime();
          const nextStart = new Date(next.clock_in).getTime();
          if (nextStart < endTime) {
            issues.push({
              employeeId: empId,
              employeeName: empName,
              type: 'overlap',
              description: `Overlapping shifts: ends ${current.clock_out}, next starts ${next.clock_in}`,
              severity: 'critical',
              clockIn: next.clock_in,
              clockOut: current.clock_out,
              hoursWorked: 0,
            });
          }
        }
      }

      // Overtime approaching
      if (totalHours >= OVERTIME_THRESHOLD * 0.9 && totalHours < OVERTIME_THRESHOLD) {
        totalOvertimeAlerts++;
        issues.push({
          employeeId: empId,
          employeeName: empName,
          type: 'overtime-approaching',
          description: `${totalHours.toFixed(1)}h worked — approaching ${OVERTIME_THRESHOLD}h overtime threshold`,
          severity: 'warning',
          clockIn: '',
          clockOut: null,
          hoursWorked: totalHours,
        });
      } else if (totalHours >= OVERTIME_THRESHOLD) {
        totalOvertimeAlerts++;
        issues.push({
          employeeId: empId,
          employeeName: empName,
          type: 'overtime-exceeded',
          description: `${overtimeHours.toFixed(1)}h overtime (${totalHours.toFixed(1)}h total)`,
          severity: 'critical',
          clockIn: '',
          clockOut: null,
          hoursWorked: totalHours,
        });
      }

      const regularHours = Math.min(totalHours, OVERTIME_THRESHOLD);
      const otHours = Math.max(0, totalHours - OVERTIME_THRESHOLD);
      const estimatedPayrollCost = (regularHours * rate) + (otHours * rate * OVERTIME_MULTIPLIER);

      summaries.push({
        employeeId: empId,
        employeeName: empName,
        totalHours,
        overtimeHours: otHours,
        punchCount: cards.length,
        issues,
        estimatedPayrollCost,
      });
    }

    summaries.sort((a, b) => b.issues.length - a.issues.length);

    const totalHoursWorked = summaries.reduce((s, e) => s + e.totalHours, 0);
    const totalOvertimeHours = summaries.reduce((s, e) => s + e.overtimeHours, 0);
    const estimatedTotalPayroll = summaries.reduce((s, e) => s + e.estimatedPayrollCost, 0);
    const totalIssues = summaries.reduce((s, e) => s + e.issues.length, 0);

    const data: TimecardAuditorData = {
      employees: summaries,
      totalIssues,
      missedPunches: totalMissedPunches,
      overtimeAlerts: totalOvertimeAlerts,
      totalHoursWorked,
      totalOvertimeHours,
      estimatedTotalPayroll,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (totalMissedPunches > 0) {
      alerts.push({
        severity: 'warning',
        message: `${totalMissedPunches} missed punches need correction`,
        code: 'MISSED_PUNCHES',
        value: totalMissedPunches,
      });
      actions.push({
        description: `Correct ${totalMissedPunches} missed timecard punches before payroll`,
        priority: 1,
        automatable: false,
      });
    }

    for (const emp of summaries.filter(e => e.issues.some(i => i.type === 'overlap'))) {
      alerts.push({
        severity: 'critical',
        message: `Overlapping shifts for ${emp.employeeName} — possible buddy punching`,
        code: 'BUDDY_PUNCH_SUSPECT',
        entity: emp.employeeId,
      });
    }

    if (totalOvertimeHours > 0) {
      alerts.push({
        severity: 'info',
        message: `${totalOvertimeHours.toFixed(1)}h total overtime across ${totalOvertimeAlerts} employee(s)`,
        code: 'OVERTIME_HOURS',
        value: totalOvertimeHours,
      });
    }

    const summary = `${summaries.length} employees, ${totalHoursWorked.toFixed(1)}h total (${totalOvertimeHours.toFixed(1)}h OT). ${totalIssues} issues: ${totalMissedPunches} missed punches, ${totalOvertimeAlerts} overtime alerts. Est. payroll: $${estimatedTotalPayroll.toFixed(2)}.`;

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
