// ── AROS Local Agent Data Store Types ───────────────────────────

export interface LocalStoreConfig {
  storePath: string;        // local path to write agent datasets
  conexxusEnabled: boolean; // normalize to Conexxus schema where applicable
  maxAgeMs: number;         // data TTL before re-fetch (default 900000 = 15min)
}

export interface AgentDataset {
  connectorId: string;
  schema: 'raw' | 'conexxus' | 'aros-standard';
  recordCount: number;
  fetchedAt: string;
  data: ConexxusDataRecord[] | Record<string, unknown>[];
}

/**
 * Conexxus-normalized transaction record.
 * Maps to Conexxus NAXML / Conexxus POS standards where applicable.
 * See shre-conexxus/ for full standard definitions.
 */
export interface ConexxusDataRecord {
  transactionId: string;
  siteId?: string;
  timestamp: string;        // ISO 8601
  totalAmount: number;
  items: ConexxusLineItem[];
  tender?: ConexxusTender;
}

export interface ConexxusLineItem {
  plu?: string;             // Conexxus product lookup unit
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  departmentCode?: string;
  taxExempt: boolean;
}

export interface ConexxusTender {
  type: 'cash' | 'credit' | 'debit' | 'gift' | 'loyalty' | 'other';
  amount: number;
}
