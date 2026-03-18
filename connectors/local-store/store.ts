// ── AROS Local Agent Store ───────────────────────────────────────
// Pulls data from Azure SQL / AWS RDS connectors, normalizes it to
// Conexxus-compatible schemas where applicable, and stores locally
// for agent context injection.

import type {
  LocalStoreConfig,
  AgentDataset,
  ConexxusDataRecord,
  ConexxusLineItem,
  ConexxusTender,
} from './types.js';
import type { POSTransaction } from '../rapidrms/types.js';

const DEFAULT_CONFIG: Partial<LocalStoreConfig> = {
  conexxusEnabled: true,
  maxAgeMs: 15 * 60 * 1000, // 15 min
};

export class LocalAgentStore {
  private config: LocalStoreConfig;
  private datasets = new Map<string, AgentDataset>();

  constructor(config: LocalStoreConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Write ──────────────────────────────────────────────────────

  /**
   * Store a raw dataset from any connector.
   * If conexxusEnabled and the data is POS transactions, normalizes to Conexxus schema.
   */
  async store(
    connectorId: string,
    data: unknown[],
    schema: AgentDataset['schema'] = 'raw',
  ): Promise<AgentDataset> {
    const resolved = this.config.conexxusEnabled && schema === 'aros-standard'
      ? {
          schema: 'conexxus' as const,
          data: this.toConexxus(data as POSTransaction[]),
        }
      : { schema, data: data as Record<string, unknown>[] };

    const dataset: AgentDataset = {
      connectorId,
      schema: resolved.schema,
      recordCount: resolved.data.length,
      fetchedAt: new Date().toISOString(),
      data: resolved.data,
    };

    this.datasets.set(connectorId, dataset);
    await this.persist(connectorId, dataset);
    return dataset;
  }

  // ── Read ───────────────────────────────────────────────────────

  /** Read a stored dataset by connector ID. Returns null if expired or not found. */
  async read(connectorId: string): Promise<AgentDataset | null> {
    const cached = this.datasets.get(connectorId);
    if (cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < this.config.maxAgeMs) return cached;
    }

    return this.loadFromDisk(connectorId);
  }

  /** List all stored dataset IDs. */
  async list(): Promise<string[]> {
    const { readdirSync } = await import('node:fs');
    try {
      return readdirSync(this.config.storePath)
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => f.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }

  // ── Conexxus Normalization ─────────────────────────────────────

  /**
   * Convert AROS POSTransaction[] to Conexxus-normalized records.
   * Implements the toConexxus() interface for marketplace connectors.
   * Full Conexxus standard definitions live in shre-conexxus/.
   */
  toConexxus(transactions: POSTransaction[]): ConexxusDataRecord[] {
    return transactions.map(tx => {
      const items: ConexxusLineItem[] = tx.lineItems.map(item => ({
        description: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        departmentCode: item.department,
        taxExempt: item.taxExempt,
      }));

      const tender: ConexxusTender = {
        type: this.normalizeTenderType(tx.tenderType),
        amount: tx.totalAmount,
      };

      return {
        transactionId: tx.invoiceId,
        siteId: tx.storeId,
        timestamp: tx.timestamp,
        totalAmount: tx.totalAmount,
        items,
        tender,
      };
    });
  }

  // ── Persistence ────────────────────────────────────────────────

  private async persist(connectorId: string, dataset: AgentDataset): Promise<void> {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');

    mkdirSync(this.config.storePath, { recursive: true });
    const path = join(this.config.storePath, `${connectorId}.json`);
    writeFileSync(path, JSON.stringify(dataset, null, 2));
  }

  private async loadFromDisk(connectorId: string): Promise<AgentDataset | null> {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');

    try {
      const path = join(this.config.storePath, `${connectorId}.json`);
      const raw = readFileSync(path, 'utf8');
      const dataset = JSON.parse(raw) as AgentDataset;

      const age = Date.now() - new Date(dataset.fetchedAt).getTime();
      if (age >= this.config.maxAgeMs) return null; // expired

      this.datasets.set(connectorId, dataset);
      return dataset;
    } catch {
      return null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private normalizeTenderType(raw: string): ConexxusTender['type'] {
    const t = raw.toLowerCase();
    if (t.includes('cash')) return 'cash';
    if (t.includes('credit') || t.includes('visa') || t.includes('mc') || t.includes('amex')) return 'credit';
    if (t.includes('debit')) return 'debit';
    if (t.includes('gift')) return 'gift';
    if (t.includes('loyalty') || t.includes('reward')) return 'loyalty';
    return 'other';
  }
}
