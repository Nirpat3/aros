/**
 * Bank Reconciler — POS Settlement to Bank Deposit Matching
 *
 * Matches POS settlement totals against actual bank deposits,
 * broken down by payment type (cash, credit, debit, EBT).
 * Flags discrepancies that could indicate:
 * - Missing deposits
 * - Processing fees not accounted for
 * - Chargebacks
 * - Data entry errors
 *
 * Compares expected amounts (from POS) vs actual bank records.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceRow,
  BankDepositRow,
  Alert,
  Action,
} from '../types.js';

interface PaymentTypeReconciliation {
  paymentType: string;
  posExpected: number;
  bankActual: number;
  variance: number;
  variancePct: number;
  status: 'matched' | 'discrepancy' | 'missing-deposit';
  transactionCount: number;
}

interface DailyReconciliation {
  date: string;
  totalPosExpected: number;
  totalBankActual: number;
  totalVariance: number;
  paymentTypes: PaymentTypeReconciliation[];
  hasDiscrepancy: boolean;
}

interface BankReconcilerData {
  dailyReconciliations: DailyReconciliation[];
  overallPosExpected: number;
  overallBankActual: number;
  overallVariance: number;
  discrepancyCount: number;
  missingDepositCount: number;
  matchedCount: number;
  largestDiscrepancy: PaymentTypeReconciliation | null;
}

/** Variance above this $ amount is flagged */
const VARIANCE_THRESHOLD = 5;
/** Variance above this % is flagged */
const VARIANCE_PCT_THRESHOLD = 1;

export class BankReconcilerSkill implements ArosSkill {
  readonly id = 'bank-reconciler';
  readonly name = 'Bank Reconciler';
  readonly category = 'cash-financial' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoices', 'bank_deposits'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [invoices, deposits] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getBankDeposits(dateRange),
    ]);

    // POS expected by date and payment method
    const posMap = new Map<string, Map<string, { amount: number; count: number }>>();
    for (const inv of invoices) {
      if (inv.is_void) continue;
      const date = inv.invoice_date.substring(0, 10);
      let dateMap = posMap.get(date);
      if (!dateMap) {
        dateMap = new Map();
        posMap.set(date, dateMap);
      }
      const method = inv.payment_method.toLowerCase();
      const existing = dateMap.get(method);
      if (existing) {
        existing.amount += inv.bill_amount;
        existing.count++;
      } else {
        dateMap.set(method, { amount: inv.bill_amount, count: 1 });
      }
    }

    // Bank deposits by date and type
    const bankMap = new Map<string, Map<string, number>>();
    for (const dep of deposits) {
      const date = dep.deposit_date.substring(0, 10);
      let dateMap = bankMap.get(date);
      if (!dateMap) {
        dateMap = new Map();
        bankMap.set(date, dateMap);
      }
      const type = dep.deposit_type.toLowerCase();
      dateMap.set(type, (dateMap.get(type) ?? 0) + dep.actual_amount);
    }

    // Reconcile
    const allDates = new Set([...posMap.keys(), ...bankMap.keys()]);
    const dailyReconciliations: DailyReconciliation[] = [];
    let overallPosExpected = 0;
    let overallBankActual = 0;
    let discrepancyCount = 0;
    let missingDepositCount = 0;
    let matchedCount = 0;
    let largestDiscrepancy: PaymentTypeReconciliation | null = null;

    for (const date of [...allDates].sort()) {
      const posDay = posMap.get(date) ?? new Map();
      const bankDay = bankMap.get(date) ?? new Map();
      const allTypes = new Set([...posDay.keys(), ...bankDay.keys()]);

      const paymentTypes: PaymentTypeReconciliation[] = [];
      let dayPosTotal = 0;
      let dayBankTotal = 0;
      let dayHasDiscrepancy = false;

      for (const type of allTypes) {
        const posData = posDay.get(type);
        const posExpected = posData?.amount ?? 0;
        const bankActual = bankDay.get(type) ?? 0;
        const variance = bankActual - posExpected;
        const variancePct = posExpected > 0 ? (variance / posExpected) * 100 : (bankActual > 0 ? 100 : 0);

        dayPosTotal += posExpected;
        dayBankTotal += bankActual;

        let status: PaymentTypeReconciliation['status'];
        if (posExpected > 0 && bankActual === 0) {
          status = 'missing-deposit';
          missingDepositCount++;
          dayHasDiscrepancy = true;
        } else if (Math.abs(variance) > VARIANCE_THRESHOLD || Math.abs(variancePct) > VARIANCE_PCT_THRESHOLD) {
          status = 'discrepancy';
          discrepancyCount++;
          dayHasDiscrepancy = true;
        } else {
          status = 'matched';
          matchedCount++;
        }

        const rec: PaymentTypeReconciliation = {
          paymentType: type,
          posExpected,
          bankActual,
          variance,
          variancePct,
          status,
          transactionCount: posData?.count ?? 0,
        };

        paymentTypes.push(rec);

        if (!largestDiscrepancy || Math.abs(variance) > Math.abs(largestDiscrepancy.variance)) {
          if (status !== 'matched') {
            largestDiscrepancy = rec;
          }
        }
      }

      overallPosExpected += dayPosTotal;
      overallBankActual += dayBankTotal;

      dailyReconciliations.push({
        date,
        totalPosExpected: dayPosTotal,
        totalBankActual: dayBankTotal,
        totalVariance: dayBankTotal - dayPosTotal,
        paymentTypes,
        hasDiscrepancy: dayHasDiscrepancy,
      });
    }

    const overallVariance = overallBankActual - overallPosExpected;

    const data: BankReconcilerData = {
      dailyReconciliations,
      overallPosExpected,
      overallBankActual,
      overallVariance,
      discrepancyCount,
      missingDepositCount,
      matchedCount,
      largestDiscrepancy,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Missing deposits
    if (missingDepositCount > 0) {
      alerts.push({
        severity: 'critical',
        message: `${missingDepositCount} missing bank deposit(s) — POS shows sales but no matching deposit`,
        code: 'MISSING_BANK_DEPOSIT',
        value: missingDepositCount,
      });
      actions.push({
        description: `Investigate ${missingDepositCount} missing bank deposits — verify deposits were made`,
        priority: 1,
        automatable: false,
      });
    }

    // Discrepancies
    if (discrepancyCount > 0) {
      alerts.push({
        severity: 'warning',
        message: `${discrepancyCount} payment type discrepancies between POS and bank (total variance: ${overallVariance >= 0 ? '+' : ''}$${overallVariance.toFixed(2)})`,
        code: 'BANK_DISCREPANCY',
        value: Math.abs(overallVariance),
        threshold: VARIANCE_THRESHOLD,
      });
    }

    if (largestDiscrepancy && largestDiscrepancy.status !== 'matched') {
      actions.push({
        description: `Largest discrepancy: ${largestDiscrepancy.paymentType} — $${Math.abs(largestDiscrepancy.variance).toFixed(2)} (POS: $${largestDiscrepancy.posExpected.toFixed(2)}, Bank: $${largestDiscrepancy.bankActual.toFixed(2)})`,
        priority: 2,
        automatable: false,
      });
    }

    const summary = `Bank reconciliation: POS $${overallPosExpected.toFixed(2)} vs Bank $${overallBankActual.toFixed(2)} (${overallVariance >= 0 ? '+' : ''}$${overallVariance.toFixed(2)}). ${matchedCount} matched, ${discrepancyCount} discrepancies, ${missingDepositCount} missing deposits.`;

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
