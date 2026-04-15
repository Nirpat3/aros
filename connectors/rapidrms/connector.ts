// ── RapidRMS POS Connector ───────────────────────────────────────
// Thin wrapper exposing authentication and data fetch.
// Credentials are retrieved from vault at auth time — never stored or logged.

import type { RapidRMSConfig, RapidRMSSyncOptions } from './types.js';
import { retrieveCredential } from '../vault-ref.js';

const DEFAULT_BASE_URL = 'https://rapidrmsapi.azurewebsites.net';

export class RapidRMSConnector {
  private config: RapidRMSConfig;
  private sessionCookie: string | null = null;
  private sessionExpiry: number = 0;

  constructor(config: RapidRMSConfig) {
    this.config = config;
    if (!this.config.baseUrl) {
      this.config = { ...config, baseUrl: DEFAULT_BASE_URL };
    }
  }

  // ── Authentication ─────────────────────────────────────────────

  /**
   * Authenticate with RapidRMS.
   * email and password fields on config are treated as vaultRefs in production.
   * Returns true if session is valid (cached or freshly authenticated).
   */
  async authenticate(): Promise<boolean> {
    if (this.sessionCookie && Date.now() < this.sessionExpiry) return true;

    // In production, config.email and config.password are vaultRefs.
    // Retrieve real values from vault — never log or store them.
    let email: string;
    let password: string;
    try {
      email = await retrieveCredential(this.config.email);
      password = await retrieveCredential(this.config.password);
    } catch {
      // Fall back to raw values if not vault refs (dev/test only)
      email = this.config.email;
      password = this.config.password;
    }

    const res = await fetch(`${this.config.baseUrl}/api/Login/Auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ClientId: this.config.clientId,
        Email: email,
        Password: password,
        RememberMe: true,
      }),
    });

    if (!res.ok) return false;

    const cookie = res.headers.get('set-cookie') || '';
    this.sessionCookie = cookie;
    this.sessionExpiry = Date.now() + 7 * 60 * 60 * 1000; // 7h
    return true;
  }

  // ── Data Fetch ─────────────────────────────────────────────────

  /** Fetch sales detail for a date range from RapidRMS API. */
  async fetchSalesDetail(opts: RapidRMSSyncOptions): Promise<unknown> {
    if (!(await this.authenticate())) throw new Error('RapidRMS auth failed');

    const dbName = opts.storeDbName ?? this.config.storeDbName;
    const url =
      `${this.config.baseUrl}/api/SalesDetail/GetByDate` +
      `?dbName=${encodeURIComponent(dbName)}` +
      `&fromDate=${encodeURIComponent(opts.fromDate)}` +
      `&toDate=${encodeURIComponent(opts.toDate)}`;

    const res = await fetch(url, {
      headers: { Cookie: this.sessionCookie! },
    });

    if (!res.ok) throw new Error(`RapidRMS API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  /** Fetch inventory snapshot from RapidRMS API. */
  async fetchInventory(storeDbName?: string): Promise<unknown> {
    if (!(await this.authenticate())) throw new Error('RapidRMS auth failed');

    const dbName = storeDbName ?? this.config.storeDbName;
    const res = await fetch(`${this.config.baseUrl}/api/Inventory/Get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.sessionCookie!,
      },
      body: JSON.stringify({ DbName: dbName }),
    });

    if (!res.ok) throw new Error(`RapidRMS Inventory error: ${res.status}`);
    return res.json();
  }

  // ── Health ─────────────────────────────────────────────────────

  /** Test connection. Must return within 10s. */
  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const ok = await this.authenticate();
      return { ok, latencyMs: Date.now() - start };
    } catch (err: unknown) {
      return { ok: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }
}
