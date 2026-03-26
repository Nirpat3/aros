// ── Connector Manager ───────────────────────────────────────────
// Registry for all tenant connectors. Config refs only — credentials in vault.

import type { ConnectorConfig, ConnectorTestResult } from './types.js';
import * as azureDb from './azure-db.js';
import * as rapidRms from './rapidrms-api.js';
import * as verifone from './verifone/connector.js';

// ── Storage (per-tenant) ────────────────────────────────────────

const store = new Map<string, Map<string, ConnectorConfig>>();

function tenantStore(tenantId: string): Map<string, ConnectorConfig> {
  if (!store.has(tenantId)) store.set(tenantId, new Map());
  return store.get(tenantId)!;
}

// ── Public API ──────────────────────────────────────────────────

/** Register a new connector for a tenant. */
export async function registerConnector(
  tenantId: string,
  config: ConnectorConfig,
): Promise<void> {
  const ts = tenantStore(tenantId);
  ts.set(config.id, { ...config, status: 'pending' });
}

/** Get a specific connector. */
export function getConnector(
  tenantId: string,
  connectorId: string,
): ConnectorConfig | null {
  return tenantStore(tenantId).get(connectorId) ?? null;
}

/** List all connectors for a tenant. */
export function listConnectors(tenantId: string): ConnectorConfig[] {
  return [...tenantStore(tenantId).values()];
}

/** Test a connector's connectivity. */
export async function testConnector(
  tenantId: string,
  connectorId: string,
): Promise<ConnectorTestResult> {
  const config = getConnector(tenantId, connectorId);
  if (!config) {
    return { success: false, error: 'Connector not found', testedAt: new Date().toISOString() };
  }

  let result: ConnectorTestResult;

  if (config.type === 'azure-db') {
    const meta = config as any;
    result = await azureDb.testConnection(meta.azureConfig, config.credentials.vaultRef);
  } else if (config.type === 'rapidrms-api') {
    const meta = config as any;
    result = await rapidRms.testConnection(meta.rapidRmsConfig, meta.emailRef, config.credentials.vaultRef);
  } else if (config.type === 'verifone-commander') {
    const meta = config as any;
    result = await verifone.testConnection(meta.verifoneConfig, config.credentials.vaultRef);
  } else {
    result = { success: false, error: `Unknown connector type: ${config.type}`, testedAt: new Date().toISOString() };
  }

  // Update status
  const ts = tenantStore(tenantId);
  ts.set(connectorId, {
    ...config,
    status: result.success ? 'connected' : 'error',
    lastTested: result.testedAt,
  });

  return result;
}

/** Remove a connector. */
export async function removeConnector(
  tenantId: string,
  connectorId: string,
): Promise<void> {
  tenantStore(tenantId).delete(connectorId);
}
