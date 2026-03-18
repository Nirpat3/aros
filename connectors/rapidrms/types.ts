// ── RapidRMS Connector Types ─────────────────────────────────────

export interface RapidRMSConfig {
  baseUrl: string;          // default: https://rapidrmsapi.azurewebsites.net
  clientId: string;         // RapidRMS client ID
  email: string;            // vaultRef in production
  password: string;         // vaultRef in production
  storeDbName: string;      // e.g. RapidRMS2
  syncIntervalMs?: number;  // default 900000 (15 min)
}

export interface POSTransaction {
  invoiceId: string;
  storeId: string;
  cashier?: string;
  timestamp: string;        // ISO 8601
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  voidAmount: number;
  tenderType: string;
  lineItems: POSLineItem[];
}

export interface POSLineItem {
  itemId: string;
  itemName: string;
  department?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discounted: boolean;
  taxExempt: boolean;
  manualDiscount: boolean;
}

export interface POSInventoryItem {
  itemId: string;
  itemName: string;
  department?: string;
  currentStock: number;
  reorderPoint?: number;
  costPrice?: number;
  retailPrice: number;
  lastUpdated: string;
}

export interface RapidRMSSyncOptions {
  fromDate: string;     // YYYY-MM-DD
  toDate: string;       // YYYY-MM-DD
  storeDbName?: string;
}

export interface POSSyncResult {
  invoicesUpserted: number;
  lineItemsUpserted: number;
  syncedAt: string;
  durationMs: number;
}
