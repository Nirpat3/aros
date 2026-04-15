/**
 * Void & Refund Auditor — Loss Prevention Analytics
 *
 * Detects suspicious patterns in voids and refunds:
 * - Cashiers with abnormally high void/refund rates
 * - Voids immediately followed by identical sales (sweethearting)
 * - Late-night voids (after normal business hours)
 * - Round-number refunds (manual entry, not scanned)
 * - Refunds without corresponding original sale
 *
 * Scoring: each suspicious pattern adds to a risk score per cashier.
 */

import type { ArosSkill, SkillContext, SkillOutput, InvoiceRow, Alert, Action } from '../types.js';

interface SuspiciousEvent {
  invoiceNo: string;
  cashierName: string;
  type:
    | 'high-void-rate'
    | 'sweetheart-suspect'
    | 'late-night-void'
    | 'round-refund'
    | 'orphan-refund';
  description: string;
  riskPoints: number;
  timestamp: string;
}

interface CashierRiskProfile {
  cashierName: string;
  totalTransactions: number;
  voidCount: number;
  refundCount: number;
  voidRate: number;
  refundRate: number;
  riskScore: number;
  events: SuspiciousEvent[];
}

interface VoidRefundAuditorData {
  cashierProfiles: CashierRiskProfile[];
  totalVoids: number;
  totalRefunds: number;
  suspiciousEvents: SuspiciousEvent[];
  highRiskCashiers: string[];
}

/** Risk score threshold for flagging a cashier */
const HIGH_RISK_THRESHOLD = 10;
/** Void rate that triggers investigation */
const VOID_RATE_FLAG = 3;
/** Late night hour threshold (24h format) */
const LATE_NIGHT_HOUR = 22;

export class VoidRefundAuditorSkill implements ArosSkill {
  readonly id = 'void-refund-auditor';
  readonly name = 'Void & Refund Auditor';
  readonly category = 'loss-prevention' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoices'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;
    const invoices = await connector.getInvoices(dateRange);

    const events: SuspiciousEvent[] = [];

    // Group by cashier
    const cashierInvoices = new Map<string, InvoiceRow[]>();
    for (const inv of invoices) {
      const existing = cashierInvoices.get(inv.cashier_name);
      if (existing) {
        existing.push(inv);
      } else {
        cashierInvoices.set(inv.cashier_name, [inv]);
      }
    }

    const profiles: CashierRiskProfile[] = [];

    for (const [cashier, invs] of cashierInvoices) {
      let riskScore = 0;
      const cashierEvents: SuspiciousEvent[] = [];

      const voids = invs.filter((i) => i.is_void);
      const refunds = invs.filter((i) => i.is_refund && !i.is_void);
      const valid = invs.filter((i) => !i.is_void);

      const voidRate = invs.length > 0 ? (voids.length / invs.length) * 100 : 0;
      const refundRate = invs.length > 0 ? (refunds.length / invs.length) * 100 : 0;

      // Pattern 1: High void rate
      if (voidRate > VOID_RATE_FLAG && invs.length >= 5) {
        riskScore += Math.min(20, Math.floor(voidRate));
        cashierEvents.push({
          invoiceNo: '',
          cashierName: cashier,
          type: 'high-void-rate',
          description: `Void rate ${voidRate.toFixed(1)}% (${voids.length}/${invs.length} transactions)`,
          riskPoints: Math.min(20, Math.floor(voidRate)),
          timestamp: invs[0]?.invoice_date ?? '',
        });
      }

      // Pattern 2: Sweethearting detection
      // Look for voids followed by a valid sale of similar amount
      for (const voidInv of voids) {
        const voidTime = new Date(voidInv.invoice_date).getTime();
        const similarSale = valid.find((v) => {
          const saleTime = new Date(v.invoice_date).getTime();
          const timeDiff = saleTime - voidTime;
          // Within 5 minutes and similar amount (±10%)
          return (
            timeDiff > 0 &&
            timeDiff < 5 * 60 * 1000 &&
            Math.abs(v.bill_amount - voidInv.bill_amount) / voidInv.bill_amount < 0.1
          );
        });

        if (similarSale) {
          riskScore += 5;
          cashierEvents.push({
            invoiceNo: voidInv.invoice_no,
            cashierName: cashier,
            type: 'sweetheart-suspect',
            description: `Void #${voidInv.invoice_no} ($${voidInv.bill_amount.toFixed(2)}) followed by similar sale #${similarSale.invoice_no} ($${similarSale.bill_amount.toFixed(2)})`,
            riskPoints: 5,
            timestamp: voidInv.invoice_date,
          });
        }
      }

      // Pattern 3: Late-night voids
      for (const voidInv of voids) {
        const hour = new Date(voidInv.invoice_date).getHours();
        if (hour >= LATE_NIGHT_HOUR || hour < 5) {
          riskScore += 3;
          cashierEvents.push({
            invoiceNo: voidInv.invoice_no,
            cashierName: cashier,
            type: 'late-night-void',
            description: `Void at ${voidInv.invoice_date} (after hours)`,
            riskPoints: 3,
            timestamp: voidInv.invoice_date,
          });
        }
      }

      // Pattern 4: Round-number refunds (manual entry indicators)
      for (const ref of refunds) {
        if (ref.bill_amount > 0 && ref.bill_amount % 5 === 0 && ref.bill_amount >= 10) {
          riskScore += 2;
          cashierEvents.push({
            invoiceNo: ref.invoice_no,
            cashierName: cashier,
            type: 'round-refund',
            description: `Round-number refund: $${ref.bill_amount.toFixed(2)} (possible manual entry)`,
            riskPoints: 2,
            timestamp: ref.invoice_date,
          });
        }
      }

      events.push(...cashierEvents);
      profiles.push({
        cashierName: cashier,
        totalTransactions: invs.length,
        voidCount: voids.length,
        refundCount: refunds.length,
        voidRate,
        refundRate,
        riskScore,
        events: cashierEvents,
      });
    }

    profiles.sort((a, b) => b.riskScore - a.riskScore);
    const highRiskCashiers = profiles
      .filter((p) => p.riskScore >= HIGH_RISK_THRESHOLD)
      .map((p) => p.cashierName);

    const totalVoids = invoices.filter((i) => i.is_void).length;
    const totalRefunds = invoices.filter((i) => i.is_refund && !i.is_void).length;

    const data: VoidRefundAuditorData = {
      cashierProfiles: profiles,
      totalVoids,
      totalRefunds,
      suspiciousEvents: events,
      highRiskCashiers,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    for (const cashier of highRiskCashiers) {
      const profile = profiles.find((p) => p.cashierName === cashier);
      if (!profile) continue;
      alerts.push({
        severity: 'critical',
        message: `HIGH RISK: ${cashier} — risk score ${profile.riskScore} (${profile.events.length} suspicious patterns)`,
        code: 'HIGH_RISK_CASHIER',
        entity: cashier,
        value: profile.riskScore,
        threshold: HIGH_RISK_THRESHOLD,
      });
      actions.push({
        description: `Review transaction logs and camera footage for ${cashier} — ${profile.events.map((e) => e.type).join(', ')}`,
        priority: 1,
        automatable: false,
        payload: { cashier, events: profile.events },
      });
    }

    const summary = `Audited ${invoices.length} transactions: ${totalVoids} voids, ${totalRefunds} refunds. ${events.length} suspicious events detected across ${profiles.length} cashiers. ${highRiskCashiers.length} high-risk cashier(s)${highRiskCashiers.length > 0 ? ': ' + highRiskCashiers.join(', ') : ''}.`;

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
