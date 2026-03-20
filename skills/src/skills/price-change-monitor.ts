/**
 * Price Change Monitor — Retail Price Change Detection & Audit Trail
 *
 * Detects any retail price changes in the POS by comparing the same SKU's
 * selling price across transactions. Logs who changed it, when, and the
 * margin impact. Flags unauthorized or suspicious changes.
 *
 * Also tracks vendor cost increases over time by comparing invoice costs
 * across deliveries to detect cost creep.
 *
 * Detection method:
 * 1. Group invoice_items by item_code
 * 2. Sort by transaction date
 * 3. Detect unit_price changes between consecutive sales
 * 4. Cross-reference cashier on duty at time of change
 * 5. Calculate margin impact (old margin vs new margin)
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceItemRow,
  InvoiceRow,
  Alert,
  Action,
} from '../types.js';

interface PriceChangeEvent {
  itemCode: string;
  itemDesc: string;
  category: string;
  /** When the change was first observed */
  detectedAt: string;
  /** Invoice where new price first appeared */
  invoiceNo: string;
  /** Cashier on duty when change appeared */
  cashierOnDuty: string;
  oldPrice: number;
  newPrice: number;
  changePct: number;
  oldCost: number;
  newCost: number;
  oldMarginPct: number;
  newMarginPct: number;
  marginImpactPct: number;
  /** Direction of the change */
  direction: 'increase' | 'decrease';
  /** Suspicious if large or unauthorized */
  suspicious: boolean;
  suspiciousReason: string | null;
}

interface CostCreepEvent {
  itemCode: string;
  itemDesc: string;
  firstCost: number;
  latestCost: number;
  costChangePct: number;
  firstSeenDate: string;
  latestSeenDate: string;
  /** Whether retail price was adjusted to compensate */
  retailAdjusted: boolean;
  marginErosion: number;
}

interface PriceChangeMonitorData {
  priceChanges: PriceChangeEvent[];
  costCreep: CostCreepEvent[];
  totalPriceChanges: number;
  suspiciousChanges: number;
  priceIncreases: number;
  priceDecreases: number;
  avgMarginImpact: number;
}

/** Price change > this % is flagged as suspicious */
const SUSPICIOUS_CHANGE_PCT = 15;
/** Price decrease > this amount is flagged */
const SUSPICIOUS_DECREASE_AMOUNT = 5;

export class PriceChangeMonitorSkill implements ArosSkill {
  readonly id = 'price-change-monitor';
  readonly name = 'Price Change Monitor';
  readonly category = 'loss-prevention' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['invoices', 'invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;

    const [invoices, items] = await Promise.all([
      connector.getInvoices(dateRange),
      connector.getInvoiceItems(dateRange),
    ]);

    // Build invoice lookup for cashier info
    const invoiceMap = new Map<string, InvoiceRow>();
    for (const inv of invoices) {
      invoiceMap.set(inv.invoice_no, inv);
    }

    // Group items by SKU, sorted by transaction date
    const skuItems = new Map<string, InvoiceItemRow[]>();
    for (const item of items) {
      if (item.is_void) continue;
      const existing = skuItems.get(item.item_code);
      if (existing) {
        existing.push(item);
      } else {
        skuItems.set(item.item_code, [item]);
      }
    }

    const priceChanges: PriceChangeEvent[] = [];
    const costCreep: CostCreepEvent[] = [];

    for (const [itemCode, skuTxns] of skuItems) {
      // Sort by invoice date
      const sorted = skuTxns.sort((a, b) => {
        const invA = invoiceMap.get(a.invoice_no);
        const invB = invoiceMap.get(b.invoice_no);
        if (!invA || !invB) return 0;
        return invA.invoice_date.localeCompare(invB.invoice_date);
      });

      if (sorted.length < 2) continue;

      // Detect retail price changes
      let lastPrice = sorted[0]!.unit_price;
      let lastCost = sorted[0]!.cost_price;

      for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i]!;
        if (current.unit_price !== lastPrice) {
          const inv = invoiceMap.get(current.invoice_no);
          const changePct = lastPrice > 0
            ? ((current.unit_price - lastPrice) / lastPrice) * 100
            : 0;
          const oldMarginPct = lastPrice > 0
            ? ((lastPrice - lastCost) / lastPrice) * 100
            : 0;
          const newMarginPct = current.unit_price > 0
            ? ((current.unit_price - current.cost_price) / current.unit_price) * 100
            : 0;

          const direction = current.unit_price > lastPrice ? 'increase' as const : 'decrease' as const;

          let suspicious = false;
          let suspiciousReason: string | null = null;

          if (Math.abs(changePct) > SUSPICIOUS_CHANGE_PCT) {
            suspicious = true;
            suspiciousReason = `Large price change: ${changePct.toFixed(1)}% exceeds ${SUSPICIOUS_CHANGE_PCT}% threshold`;
          }
          if (direction === 'decrease' && (lastPrice - current.unit_price) > SUSPICIOUS_DECREASE_AMOUNT) {
            suspicious = true;
            suspiciousReason = `Significant price decrease of $${(lastPrice - current.unit_price).toFixed(2)}`;
          }

          priceChanges.push({
            itemCode,
            itemDesc: current.item_desc,
            category: current.category,
            detectedAt: inv?.invoice_date ?? '',
            invoiceNo: current.invoice_no,
            cashierOnDuty: inv?.cashier_name ?? 'Unknown',
            oldPrice: lastPrice,
            newPrice: current.unit_price,
            changePct,
            oldCost: lastCost,
            newCost: current.cost_price,
            oldMarginPct,
            newMarginPct,
            marginImpactPct: newMarginPct - oldMarginPct,
            direction,
            suspicious,
            suspiciousReason,
          });

          lastPrice = current.unit_price;
          lastCost = current.cost_price;
        }
      }

      // Detect vendor cost creep
      const firstItem = sorted[0]!;
      const lastItem = sorted[sorted.length - 1]!;
      if (firstItem.cost_price !== lastItem.cost_price && firstItem.cost_price > 0) {
        const costChangePct = ((lastItem.cost_price - firstItem.cost_price) / firstItem.cost_price) * 100;
        const retailAdjusted = firstItem.unit_price !== lastItem.unit_price;
        const oldMargin = firstItem.unit_price > 0
          ? ((firstItem.unit_price - firstItem.cost_price) / firstItem.unit_price) * 100
          : 0;
        const newMargin = lastItem.unit_price > 0
          ? ((lastItem.unit_price - lastItem.cost_price) / lastItem.unit_price) * 100
          : 0;

        if (Math.abs(costChangePct) >= 2) {
          costCreep.push({
            itemCode,
            itemDesc: firstItem.item_desc,
            firstCost: firstItem.cost_price,
            latestCost: lastItem.cost_price,
            costChangePct,
            firstSeenDate: invoiceMap.get(firstItem.invoice_no)?.invoice_date ?? '',
            latestSeenDate: invoiceMap.get(lastItem.invoice_no)?.invoice_date ?? '',
            retailAdjusted,
            marginErosion: retailAdjusted ? 0 : oldMargin - newMargin,
          });
        }
      }
    }

    // Sort: suspicious first, then by magnitude
    priceChanges.sort((a, b) => {
      if (a.suspicious !== b.suspicious) return a.suspicious ? -1 : 1;
      return Math.abs(b.changePct) - Math.abs(a.changePct);
    });
    costCreep.sort((a, b) => b.marginErosion - a.marginErosion);

    const suspiciousChanges = priceChanges.filter(c => c.suspicious);
    const priceIncreases = priceChanges.filter(c => c.direction === 'increase').length;
    const priceDecreases = priceChanges.filter(c => c.direction === 'decrease').length;
    const avgMarginImpact = priceChanges.length > 0
      ? priceChanges.reduce((s, c) => s + c.marginImpactPct, 0) / priceChanges.length
      : 0;

    const data: PriceChangeMonitorData = {
      priceChanges,
      costCreep,
      totalPriceChanges: priceChanges.length,
      suspiciousChanges: suspiciousChanges.length,
      priceIncreases,
      priceDecreases,
      avgMarginImpact,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    for (const change of suspiciousChanges.slice(0, 10)) {
      alerts.push({
        severity: 'critical',
        message: `Suspicious price change: ${change.itemDesc} ${change.direction} ${Math.abs(change.changePct).toFixed(1)}% ($${change.oldPrice.toFixed(2)} → $${change.newPrice.toFixed(2)}) by ${change.cashierOnDuty}`,
        code: 'SUSPICIOUS_PRICE_CHANGE',
        entity: change.itemCode,
        value: change.changePct,
        threshold: SUSPICIOUS_CHANGE_PCT,
      });
      actions.push({
        description: `Investigate price change on ${change.itemDesc} — ${change.cashierOnDuty} on duty at ${change.detectedAt}`,
        priority: 1,
        automatable: false,
        payload: {
          itemCode: change.itemCode,
          invoiceNo: change.invoiceNo,
          cashier: change.cashierOnDuty,
        },
      });
    }

    // Cost creep without retail adjustment
    const unadjusted = costCreep.filter(c => !c.retailAdjusted && c.marginErosion > 1);
    for (const cc of unadjusted.slice(0, 5)) {
      alerts.push({
        severity: 'warning',
        message: `Cost creep: ${cc.itemDesc} cost up ${cc.costChangePct.toFixed(1)}% but retail unchanged — margin eroded ${cc.marginErosion.toFixed(1)}pp`,
        code: 'COST_CREEP_UNADJUSTED',
        entity: cc.itemCode,
        value: cc.costChangePct,
      });
      actions.push({
        description: `Adjust retail price for ${cc.itemDesc} — vendor cost increased ${cc.costChangePct.toFixed(1)}%`,
        priority: 2,
        automatable: false,
      });
    }

    const summary = `${priceChanges.length} price changes detected (${priceIncreases} increases, ${priceDecreases} decreases). ${suspiciousChanges.length} suspicious. ${costCreep.length} SKUs with vendor cost changes, ${unadjusted.length} need retail price adjustment.`;

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
