// ── AWS RDS / Aurora Connector Types ────────────────────────────

export interface AwsDbConfig {
  engine: 'mysql' | 'postgres' | 'aurora-mysql' | 'aurora-postgres';
  host: string;          // RDS endpoint (e.g. mydb.abc123.us-east-1.rds.amazonaws.com)
  port: number;          // 3306 for MySQL/Aurora-MySQL, 5432 for Postgres/Aurora-Postgres
  database: string;
  username: string;
  // password: NEVER stored here — vaultRef only
  ssl: boolean;          // always true for RDS
  region?: string;       // AWS region (e.g. us-east-1)
}

export interface AwsDbConnection {
  config: AwsDbConfig;
  client: unknown;       // mysql2 Pool or pg Client (peer dep)
  connected: boolean;
  engine: AwsDbConfig['engine'];
}

export interface AwsConnectorTestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
  testedAt: string;
  engine: AwsDbConfig['engine'];
}
