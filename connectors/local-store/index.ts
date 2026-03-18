/**
 * AROS Local Agent Data Store
 * Pulls data from Azure SQL / AWS RDS connectors, normalizes it to
 * Conexxus-compatible schemas where applicable, and stores locally
 * for agent context injection.
 */
export { LocalAgentStore } from './store.js';
export type { LocalStoreConfig, AgentDataset, ConexxusDataRecord } from './types.js';
