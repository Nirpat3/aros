// ── AWS RDS / Aurora Connector ───────────────────────────────────
// Connects to AWS RDS or Aurora databases (MySQL/PostgreSQL).
// Passwords are NEVER stored or logged — retrieved from vault at connect time.
// Follows the same vault-ref credential pattern as azure-db.ts.

import type { AwsDbConfig, AwsDbConnection, AwsConnectorTestResult } from './types.js';
import { retrieveCredential } from '../vault-ref.js';

// ── Connect ──────────────────────────────────────────────────────

/**
 * Connect to AWS RDS or Aurora.
 * Password is retrieved from vault via passwordRef — never passed in plain text.
 */
export async function connect(
  config: AwsDbConfig,
  passwordRef: string,
): Promise<AwsDbConnection> {
  const password = await retrieveCredential(passwordRef);

  if (config.engine === 'mysql' || config.engine === 'aurora-mysql') {
    return connectMySQL(config, password);
  }
  return connectPostgres(config, password);
}

async function connectMySQL(config: AwsDbConfig, password: string): Promise<AwsDbConnection> {
  const mysql2 = await import('mysql2/promise');

  const pool = await mysql2.createPool({
    host: config.host,
    port: config.port || 3306,
    database: config.database,
    user: config.username,
    password,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // Verify connectivity
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();

  return { config, client: pool, connected: true, engine: config.engine };
}

async function connectPostgres(config: AwsDbConfig, password: string): Promise<AwsDbConnection> {
  const pg = await import('pg');

  const pool = new pg.default.Pool({
    host: config.host,
    port: config.port || 5432,
    database: config.database,
    user: config.username,
    password,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    max: 10,
  });

  // Verify connectivity
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();

  return { config, client: pool, connected: true, engine: config.engine };
}

// ── Test ─────────────────────────────────────────────────────────

/** Test connection without keeping it open. */
export async function testConnection(
  config: AwsDbConfig,
  passwordRef: string,
): Promise<AwsConnectorTestResult> {
  const start = Date.now();
  try {
    const conn = await connect(config, passwordRef);
    await disconnect(conn);
    return {
      success: true,
      latencyMs: Date.now() - start,
      testedAt: new Date().toISOString(),
      engine: config.engine,
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      testedAt: new Date().toISOString(),
      engine: config.engine,
    };
  }
}

// ── Disconnect ───────────────────────────────────────────────────

export async function disconnect(conn: AwsDbConnection): Promise<void> {
  if (conn.client && typeof (conn.client as any).end === 'function') {
    await (conn.client as any).end();
  } else if (conn.client && typeof (conn.client as any).pool?.end === 'function') {
    await (conn.client as any).pool.end();
  }
  conn.connected = false;
}

// ── Query ────────────────────────────────────────────────────────

/** Execute parameterized query. Returns rows as plain objects. */
export async function query(
  conn: AwsDbConnection,
  sql: string,
  params?: unknown[],
): Promise<unknown[]> {
  if (!conn.connected) throw new Error('Not connected');

  if (conn.engine === 'mysql' || conn.engine === 'aurora-mysql') {
    const [rows] = await (conn.client as any).execute(sql, params ?? []);
    return rows as unknown[];
  }

  // PostgreSQL: use $1, $2 placeholders
  const result = await (conn.client as any).query(sql, params ?? []);
  return result.rows as unknown[];
}

// ── Data Download ────────────────────────────────────────────────

/**
 * Download table data as JSON files for initial sync to AROS local store.
 * Same pattern as azure-db.ts downloadData.
 */
export async function downloadData(
  conn: AwsDbConnection,
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

    const sql = conn.engine === 'mysql' || conn.engine === 'aurora-mysql'
      ? `SELECT * FROM \`${table}\``
      : `SELECT * FROM "${table}"`;

    const rows = await query(conn, sql);
    writeFileSync(join(outputPath, `${table}.json`), JSON.stringify(rows, null, 2));
  }
}
