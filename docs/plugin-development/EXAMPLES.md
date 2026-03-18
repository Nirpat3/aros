# AROS Connector & Plugin Examples

Three worked examples showing connector patterns from simple to complex.

---

## Example 1 — Simple Connector: CSV File Reader

The simplest possible connector. Reads a local CSV file and makes it available for agent context.

### File structure

```
csv-reader/
├── manifest.json
├── index.ts
├── connector.ts
├── types.ts
└── README.md
```

### `manifest.json`

```json
{
  "id": "com.example.csv-reader",
  "name": "CSV File Reader",
  "version": "1.0.0",
  "description": "Read a local CSV file and make its data available for agent context.",
  "category": "utility",
  "author": "Example Corp",
  "packageName": "@example/connector-csv",
  "capabilities": ["data-fetch", "local-sync"],
  "pricing": { "model": "free" },
  "requiredPlatformVersion": "0.2.0",
  "configSchema": {
    "filePath": {
      "type": "string",
      "required": true,
      "label": "Path to CSV file"
    },
    "hasHeader": {
      "type": "boolean",
      "default": true,
      "label": "First row is header"
    }
  }
}
```

### `types.ts`

```typescript
export interface CsvConfig {
  filePath: string;
  hasHeader: boolean;
}

export interface CsvRow {
  [key: string]: string;
}
```

### `connector.ts`

```typescript
import { readFileSync } from 'node:fs';
import type { CsvConfig, CsvRow } from './types.js';

export class CsvConnector {
  private config: CsvConfig;

  constructor(config: CsvConfig) {
    this.config = config;
  }

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      readFileSync(this.config.filePath); // just check it exists and is readable
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  async fetchData(): Promise<CsvRow[]> {
    const content = readFileSync(this.config.filePath, 'utf8');
    const lines = content.trim().split('\n');

    if (lines.length === 0) return [];

    if (!this.config.hasHeader) {
      return lines.map((line, i) => ({ row: String(i), data: line }));
    }

    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
    });
  }
}
```

### `index.ts`

```typescript
export { CsvConnector } from './connector.js';
export type { CsvConfig, CsvRow } from './types.js';
```

---

## Example 2 — API Connector: Weather API (BYOK)

An external HTTP connector with a user-supplied API key. Shows the vault-ref pattern for secrets.

### File structure

```
weather-connector/
├── manifest.json
├── index.ts
├── connector.ts
├── types.ts
└── README.md
```

### `manifest.json`

```json
{
  "id": "com.example.weather",
  "name": "Weather API Connector",
  "version": "1.0.0",
  "description": "Connect AROS to a weather API. Provides current conditions and forecasts for agent context.",
  "category": "integration",
  "author": "Example Corp",
  "packageName": "@example/connector-weather",
  "capabilities": ["data-fetch", "agent-context", "outbound-http"],
  "pricing": { "model": "free" },
  "requiredPlatformVersion": "0.2.0",
  "configSchema": {
    "apiKey": {
      "type": "string",
      "required": true,
      "label": "OpenWeatherMap API Key",
      "secret": true
    },
    "location": {
      "type": "string",
      "required": true,
      "label": "Default location (city name or lat,lon)"
    },
    "units": {
      "type": "select",
      "options": ["metric", "imperial"],
      "required": false,
      "default": "imperial"
    }
  }
}
```

### `types.ts`

```typescript
export interface WeatherConfig {
  apiKeyRef: string;   // vaultRef — real key retrieved at runtime
  location: string;
  units: 'metric' | 'imperial';
}

export interface WeatherData {
  location: string;
  temperature: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  fetchedAt: string;
}
```

### `connector.ts`

```typescript
import type { WeatherConfig, WeatherData } from './types.js';
import { retrieveCredential } from '@aros/vault-ref';

const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export class WeatherConnector {
  private config: WeatherConfig;

  constructor(config: WeatherConfig) {
    this.config = config;
  }

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.fetchCurrent();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  async fetchCurrent(): Promise<WeatherData> {
    // Retrieve API key from vault — never log or store this value
    const apiKey = await retrieveCredential(this.config.apiKeyRef);

    const url = `${BASE_URL}/weather?q=${encodeURIComponent(this.config.location)}&units=${this.config.units}&appid=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Weather API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as Record<string, unknown>;

    return {
      location: String((data.name as string) ?? this.config.location),
      temperature: Number((data.main as any)?.temp ?? 0),
      feelsLike: Number((data.main as any)?.feels_like ?? 0),
      description: String((data.weather as any)?.[0]?.description ?? ''),
      humidity: Number((data.main as any)?.humidity ?? 0),
      windSpeed: Number((data.wind as any)?.speed ?? 0),
      fetchedAt: new Date().toISOString(),
    };
  }

  async fetchData() {
    const current = await this.fetchCurrent();
    return [current];
  }
}
```

**Key pattern:** `apiKey` is retrieved via `retrieveCredential(this.config.apiKeyRef)` — the config stores only the vault reference, never the real key.

---

## Example 3 — Database Connector: Azure SQL (vault-ref credential pattern)

The full vault-ref pattern for database connectors, mirroring the built-in `connectors/azure-db.ts`.

### File structure

```
azure-sql-connector/
├── manifest.json
├── index.ts
├── connector.ts
├── types.ts
└── README.md
```

### `manifest.json`

```json
{
  "id": "com.example.azure-sql",
  "name": "Azure SQL Connector",
  "version": "1.0.0",
  "description": "Connect AROS to Azure SQL Database. Sync analytics data for agent context.",
  "category": "database",
  "author": "Example Corp",
  "packageName": "@example/connector-azure-sql",
  "capabilities": ["data-fetch", "local-sync", "agent-context"],
  "pricing": { "model": "free" },
  "requiredPlatformVersion": "0.2.0",
  "configSchema": {
    "server": {
      "type": "string",
      "required": true,
      "label": "Azure SQL Server (e.g. myserver.database.windows.net)"
    },
    "database": {
      "type": "string",
      "required": true,
      "label": "Database Name"
    },
    "username": {
      "type": "string",
      "required": true,
      "label": "Username"
    },
    "password": {
      "type": "string",
      "required": true,
      "label": "Password",
      "secret": true
    }
  }
}
```

### `types.ts`

```typescript
export interface AzureSqlConfig {
  server: string;
  database: string;
  username: string;
  // password: NEVER stored here — vaultRef only
  port?: number;
}
```

### `connector.ts`

```typescript
import type { AzureSqlConfig } from './types.js';
import { retrieveCredential } from '@aros/vault-ref';

export class AzureSqlConnector {
  private config: AzureSqlConfig;
  private pool: unknown = null;

  constructor(config: AzureSqlConfig) {
    this.config = config;
  }

  /**
   * Connect using vault-ref password pattern.
   * passwordRef is a vaultRef string — real password retrieved at runtime only.
   */
  async connect(passwordRef: string): Promise<void> {
    // Retrieve password from vault — never log or store the returned value
    const password = await retrieveCredential(passwordRef);

    const mssql = await import('mssql');
    this.pool = new mssql.default.ConnectionPool({
      server: this.config.server,
      database: this.config.database,
      user: this.config.username,
      password,  // used in-memory only, goes out of scope after connection
      port: this.config.port ?? 1433,
      options: {
        encrypt: true,                  // always true for Azure SQL
        trustServerCertificate: false,  // never skip cert validation in production
      },
    });

    await (this.pool as any).connect();
  }

  async testConnection(passwordRef: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.connect(passwordRef);
      await this.disconnect();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  async query(sql: string, params?: Record<string, unknown>): Promise<unknown[]> {
    if (!this.pool) throw new Error('Not connected — call connect() first');
    const request = (this.pool as any).request();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
      }
    }
    const result = await request.query(sql);
    return result.recordset ?? [];
  }

  async disconnect(): Promise<void> {
    if (this.pool && typeof (this.pool as any).close === 'function') {
      await (this.pool as any).close();
    }
    this.pool = null;
  }
}
```

### Key patterns demonstrated

1. **`passwordRef` parameter** — the config stores a vaultRef, not the password
2. **`retrieveCredential(passwordRef)`** — retrieves the real password at connect time
3. **`encrypt: true`, `trustServerCertificate: false`** — always use SSL for Azure
4. **`password` goes out of scope** — never stored on `this`, never logged
5. **Parameterized queries** — use `request.input()` to prevent SQL injection

### How the vaultRef gets there

When the user installs the connector:
1. User fills in the password field (marked `secret: true`)
2. AROS encrypts it with AES-256-GCM
3. AROS stores a vaultRef (`vault:password:abc123xyz`) in the connector's config
4. Your connector receives `config.password = "vault:password:abc123xyz"`
5. At connect time, call `retrieveCredential(config.password)` to get the real password
