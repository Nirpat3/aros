/**
 * AWS RDS / Aurora Connector for AROS
 * Connects to AWS RDS or Aurora databases (MySQL, PostgreSQL).
 * Credentials use vault-ref pattern — no plain-text secrets.
 */
export { connect, disconnect, query, testConnection, downloadData } from './connector.js';
export type { AwsDbConfig, AwsDbConnection, AwsConnectorTestResult } from './types.js';
