// ── RapidRMS Data Sync ───────────────────────────────────────────
// Syncs POS data from RapidRMS API to local agent-accessible store.
// Normalizes raw API responses to AROS POSTransaction schema.

import type {
  RapidRMSConfig,
  RapidRMSSyncOptions,
  POSSyncResult,
  POSTransaction,
  POSLineItem,
} from './types.js';
import { RapidRMSConnector } from './connector.js';

// ── Raw API shapes (internal) ──────────────────────────────────

interface RawInvoice {
  InvoiceId?: string | number;
  StoreId?: string | number;
  CashierName?: string;
  TransactionDate?: string;
  TotalAmount?: number;
  TaxAmount?: number;
  DiscountAmount?: number;
  VoidAmount?: number;
  TenderType?: string;
  Items?: RawLineItem[];
}

interface RawLineItem {
  ItemId?: string | number;
  ItemName?: string;
  Department?: string;
  Qty?: number;
  UnitPrice?: number;
  LineTotal?: number;
  IsDiscounted?: boolean;
  IsTaxExempt?: boolean;
  IsManualDiscount?: boolean;
}

interface RawSalesResponse {
  Invoices?: RawInvoice[];
  Items?: RawLineItem[];
  invoices?: RawInvoice[];
  lineItems?: RawLineItem[];
}

export class RapidRMSDataSync {
  private connector: RapidRMSConnector;

  constructor(config: RapidRMSConfig) {
    this.connector = new RapidRMSConnector(config);
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Sync sales data for a date range.
   * Returns normalized POSTransaction[] ready for agent context injection.
   */
  async syncSales(opts: RapidRMSSyncOptions): Promise<POSSyncResult> {
    const start = Date.now();
    const raw = (await this.connector.fetchSalesDetail(opts)) as RawSalesResponse;

    // Support both casing conventions the API may return
    const invoices = raw.Invoices ?? raw.invoices ?? [];
    const topLevelItems = raw.Items ?? raw.lineItems ?? [];

    const normalized = invoices.map((inv) => this.normalizeInvoice(inv, topLevelItems));

    const invoicesUpserted = normalized.length;
    const lineItemsUpserted = normalized.reduce((sum, t) => sum + t.lineItems.length, 0);

    return {
      invoicesUpserted,
      lineItemsUpserted,
      syncedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  /**
   * Fetch normalized transactions as a plain array.
   * Suitable for direct agent context injection.
   */
  async fetchTransactions(opts: RapidRMSSyncOptions): Promise<POSTransaction[]> {
    const raw = (await this.connector.fetchSalesDetail(opts)) as RawSalesResponse;
    const invoices = raw.Invoices ?? raw.invoices ?? [];
    const topLevelItems = raw.Items ?? raw.lineItems ?? [];
    return invoices.map((inv) => this.normalizeInvoice(inv, topLevelItems));
  }

  /** Test connectivity. */
  async testConnection() {
    return this.connector.testConnection();
  }

  // ── Normalization ──────────────────────────────────────────────

  private normalizeInvoice(inv: RawInvoice, fallbackItems: RawLineItem[]): POSTransaction {
    const items = inv.Items ?? fallbackItems;
    return {
      invoiceId: String(inv.InvoiceId ?? ''),
      storeId: String(inv.StoreId ?? ''),
      cashier: inv.CashierName,
      timestamp: inv.TransactionDate ?? new Date().toISOString(),
      totalAmount: inv.TotalAmount ?? 0,
      taxAmount: inv.TaxAmount ?? 0,
      discountAmount: inv.DiscountAmount ?? 0,
      voidAmount: inv.VoidAmount ?? 0,
      tenderType: inv.TenderType ?? 'unknown',
      lineItems: items.map((item) => this.normalizeLineItem(item)),
    };
  }

  private normalizeLineItem(item: RawLineItem): POSLineItem {
    return {
      itemId: String(item.ItemId ?? ''),
      itemName: item.ItemName ?? '',
      department: item.Department,
      quantity: item.Qty ?? 0,
      unitPrice: item.UnitPrice ?? 0,
      lineTotal: item.LineTotal ?? 0,
      discounted: item.IsDiscounted ?? false,
      taxExempt: item.IsTaxExempt ?? false,
      manualDiscount: item.IsManualDiscount ?? false,
    };
  }
}
