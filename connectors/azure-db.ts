// ── Azure SQL Connector ─────────────────────────────────────────
// Connects to Azure SQL via mssql (peer dependency).
// Passwords are NEVER stored or logged — retrieved from vault at connect time.

import type { AzureDbConfig, AzureDbConnection, ConnectorTestResult } from './types.js';
import { retrieveCredential } from './vault-ref.js';

// ── Connect ─────────────────────────────────────────────────────

/** Connect to Azure SQL. Password is retrieved from vault via passwordRef. */
export async function connect(
  config: AzureDbConfig,
  passwordRef: string,
): Promise<AzureDbConnection> {
  const mssql = await import('mssql');
  const password = await retrieveCredential(passwordRef);

  const pool = new mssql.default.ConnectionPool({
    server: config.server,
    database: config.database,
    user: config.username,
    password,
    port: config.port || 1433,
    options: {
      encrypt: config.encrypt ?? true,
      trustServerCertificate: false,
    },
  });

  await pool.connect();

  return { config, pool, connected: true };
}

// ── Test ────────────────────────────────────────────────────────

/** Test connection without keeping it open. */
export async function testConnection(
  config: AzureDbConfig,
  passwordRef: string,
): Promise<ConnectorTestResult> {
  const start = Date.now();
  try {
    const conn = await connect(config, passwordRef);
    await disconnect(conn);
    return {
      success: true,
      latencyMs: Date.now() - start,
      testedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      testedAt: new Date().toISOString(),
    };
  }
}

// ── Disconnect ──────────────────────────────────────────────────

export async function disconnect(conn: AzureDbConnection): Promise<void> {
  if (conn.pool && typeof (conn.pool as any).close === 'function') {
    await (conn.pool as any).close();
  }
  conn.connected = false;
}

// ── Query ───────────────────────────────────────────────────────

/** Execute parameterized query. */
export async function query(
  conn: AzureDbConnection,
  sql: string,
  params?: Record<string, unknown>,
): Promise<unknown[]> {
  if (!conn.connected) throw new Error('Not connected');

  const request = (conn.pool as any).request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query(sql);
  return result.recordset ?? [];
}

// ── Data Download ───────────────────────────────────────────────

/** Download table data as JSON files for initial sync to AROS local store. */
export async function downloadData(
  conn: AzureDbConnection,
  tables: string[],
  outputPath: string,
): Promise<void> {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');

  mkdirSync(outputPath, { recursive: true });

  for (const table of tables) {
    // Sanitize table name — allow only alphanumeric, underscore, dot
    if (!/^[\w.]+$/.test(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }
    const rows = await query(conn, `SELECT * FROM [${table}]`);
    writeFileSync(join(outputPath, `${table}.json`), JSON.stringify(rows, null, 2));
  }
}
