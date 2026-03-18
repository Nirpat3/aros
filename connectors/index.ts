// ── Connectors ──────────────────────────────────────────────────

export type {
  ConnectorConfig,
  ConnectorCredentials,
  AzureDbConfig,
  RapidRmsApiConfig,
  ConnectorTestResult,
  AzureDbConnection,
  RapidRmsSession,
} from './types.js';

export * as vault from './vault-ref.js';
export * as azureDb from './azure-db.js';
export * as rapidRms from './rapidrms-api.js';
export * as manager from './manager.js';
export { linkToStorePulse, getStorePulseConnectors } from './storepulse-link.js';

// ── Connector Packages ───────────────────────────────────────────

export * as rapidRmsConnector from './rapidrms/index.js';
export * as awsDb from './aws-db/index.js';
export * as localStore from './local-store/index.js';
