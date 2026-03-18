/**
 * RapidRMS POS Connector for AROS
 * Connects to RapidRMS retail management API for sales, inventory, and analytics data.
 * Data is normalized to AROS standard schemas and optionally to Conexxus standards.
 */
export { RapidRMSConnector } from './connector.js';
export { RapidRMSDataSync } from './sync.js';
export type {
  RapidRMSConfig,
  RapidRMSSyncOptions,
  POSTransaction,
  POSLineItem,
  POSInventoryItem,
  POSSyncResult,
} from './types.js';
