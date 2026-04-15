/**
 * Cash Reconciler — Register Cash Variance Detection
 *
 * Compares expected cash (from POS transactions) against actual
 * register readings. Flags overages and shortages by cashier and shift.
 *
 * Business logic:
 * - Expected cash = cash sales - cash refunds (from POS)
 * - Variance = actual cash - expected cash
 * - Positive variance = overage (could indicate pricing errors)
 * - Negative variance = shortage (could indicate theft or errors)
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  RegisterReadingRow,
  Alert,
  Action,
} from '../types.js';

interface CashVariance {
  registerId: string;
  shift: string;
  cashierName: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  variancePct: number;
  cardTotal: number;
  otherTenderTotal: number;
}

interface CashReconcilerData {
  readings: CashVariance[];
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  overages: CashVariance[];
  shortages: CashVariance[];
  withinTolerance: CashVariance[];
}

export class CashReconcilerSkill implements ArosSkill {
  readonly id = 'cash-reconciler';
  readonly name = 'Cash Reconciler';
  readonly category = 'cash-financial' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['register_readings'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, today, store } = context;
    const readings = await connector.getRegisterReadings(today);
    const threshold = store.cashVarianceThreshold;

    const variances: CashVariance[] = readings.map((r: RegisterReadingRow) => {
      const variance = r.actual_cash - r.expected_cash;
      const variancePct = r.expected_cash > 0 ? (variance / r.expected_cash) * 100 : 0;
      return {
        registerId: r.register_id,
        shift: r.shift,
        cashierName: r.cashier_name,
        expectedCash: r.expected_cash,
        actualCash: r.actual_cash,
        variance,
        variancePct,
        cardTotal: r.card_total,
        otherTenderTotal: r.other_tender_total,
      };
    });

    const overages = variances.filter((v) => v.variance > threshold);
    const shortages = variances.filter((v) => v.variance < -threshold);
    const withinTolerance = variances.filter((v) => Math.abs(v.variance) <= threshold);

    const totalExpected = variances.reduce((s, v) => s + v.expectedCash, 0);
    const totalActual = variances.reduce((s, v) => s + v.actualCash, 0);
    const totalVariance = totalActual - totalExpected;

    const data: CashReconcilerData = {
      readings: variances,
      totalExpected,
      totalActual,
      totalVariance,
      overages,
      shortages,
      withinTolerance,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Flag significant shortages
    for (const s of shortages) {
      const severity =
        Math.abs(s.variance) > threshold * 3 ? ('critical' as const) : ('warning' as const);
      alerts.push({
        severity,
        message: `Cash SHORT $${Math.abs(s.variance).toFixed(2)} — Register ${s.registerId}, ${s.cashierName} (${s.shift} shift)`,
        code: 'CASH_SHORTAGE',
        entity: s.cashierName,
        value: s.variance,
        threshold: -threshold,
      });
    }

    // Flag significant overages
    for (const o of overages) {
      alerts.push({
        severity: 'info',
        message: `Cash OVER $${o.variance.toFixed(2)} — Register ${o.registerId}, ${o.cashierName} (${o.shift} shift)`,
        code: 'CASH_OVERAGE',
        entity: o.cashierName,
        value: o.variance,
        threshold,
      });
    }

    // Action for repeated issues
    if (shortages.length > 1) {
      actions.push({
        description: `Multiple cash shortages detected (${shortages.length} registers). Review camera footage and transaction logs.`,
        priority: 2,
        automatable: false,
      });
    }

    const summary =
      variances.length > 0
        ? `Cash reconciliation: $${totalActual.toFixed(2)} actual vs $${totalExpected.toFixed(2)} expected (${totalVariance >= 0 ? '+' : ''}$${totalVariance.toFixed(2)}). ${shortages.length} shortage(s), ${overages.length} overage(s), ${withinTolerance.length} within tolerance.`
        : 'No register readings available for reconciliation.';

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
