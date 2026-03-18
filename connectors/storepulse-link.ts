// ── StorePulse Connector Link ───────────────────────────────────
// Links Azure DB + RapidRMS connectors to the StorePulse node.

import { getConnector } from './manager.js';
import type { ConnectorConfig } from './types.js';

// ── Storage ─────────────────────────────────────────────────────

interface StorePulseLinks {
  azureConnectorId?: string;
  rapidRmsConnectorId?: string;
}

const links = new Map<string, StorePulseLinks>();

// ── Public API ──────────────────────────────────────────────────

/** Link Azure DB and/or RapidRMS connectors to StorePulse for a tenant. */
export function linkToStorePulse(
  tenantId: string,
  azureConnectorId?: string,
  rapidRmsConnectorId?: string,
): void {
  const existing = links.get(tenantId) ?? {};
  links.set(tenantId, {
    azureConnectorId: azureConnectorId ?? existing.azureConnectorId,
    rapidRmsConnectorId: rapidRmsConnectorId ?? existing.rapidRmsConnectorId,
  });
}

/** Get the connectors linked to StorePulse for a tenant. */
export function getStorePulseConnectors(
  tenantId: string,
): { azureDb?: ConnectorConfig; rapidRms?: ConnectorConfig } {
  const linked = links.get(tenantId);
  if (!linked) return {};

  return {
    azureDb: linked.azureConnectorId
      ? getConnector(tenantId, linked.azureConnectorId) ?? undefined
      : undefined,
    rapidRms: linked.rapidRmsConnectorId
      ? getConnector(tenantId, linked.rapidRmsConnectorId) ?? undefined
      : undefined,
  };
}
