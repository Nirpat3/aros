# Connectors

Data connectors for AROS Platform. Currently supports Azure SQL Database and RapidRMS API.

## Connector Types

### Azure SQL Database
Connects to Azure-hosted SQL databases for direct data access.

- **Driver:** `mssql` (peer dependency)
- **Config:** server, database, username, port (default 1433)
- **Security:** Password stored via vault reference only. SSL + encrypt always enabled for Azure.
- **Features:** Query execution, parameterized queries, bulk data download (tables → JSON)

### RapidRMS API
Connects to the RapidRMS retail management API.

- **Base URL:** `https://rapidrmsapi.azurewebsites.net`
- **Auth:** POST `/api/Login/Auth` with ClientId + Email + Password → session cookie
- **Session:** 7-hour timeout, remember-me enabled
- **Pre-mapped endpoints:** Sales Detail, Inventory, Pricing, Employees, Promotions

## Credential Handling

**Credentials are NEVER stored in plain text.**

1. User enters credential with `*` prefix (e.g. `*MyP@ssw0rd`)
2. Value is encrypted with AES-256-GCM
3. Encrypted value stored in vault, keyed by vault reference
4. Connector config stores only the `vaultRef` string — not the credential
5. At connect time, vault ref is resolved → credential decrypted in-memory only
6. Plain text is never logged, never persisted, never displayed

Each tenant has an isolated vault with key derivation from their tenant secret.

## New User — Blank Slate

New tenants start with **zero connectors and zero credentials**. No demo data, no pre-loaded keys. Users must:
1. Add their own Azure DB and/or RapidRMS connector
2. Enter credentials using the `*` secure prefix
3. Test the connection
4. Link connectors to StorePulse (or other nodes)

## Linking to StorePulse

```typescript
import { linkToStorePulse, getStorePulseConnectors } from './connectors/index.js';

// Link both connectors
linkToStorePulse(tenantId, azureConnectorId, rapidRmsConnectorId);

// Retrieve linked connectors
const { azureDb, rapidRms } = getStorePulseConnectors(tenantId);
```

StorePulse uses whichever connectors are linked and have `status: "connected"`.

## Test Connection Flow

```typescript
import { manager } from './connectors/index.js';

const result = await manager.testConnector(tenantId, connectorId);
// { success: true, latencyMs: 142, testedAt: '2026-03-18T...' }
```

## Data Download (Azure DB)

```typescript
import { azureDb } from './connectors/index.js';

const conn = await azureDb.connect(config, passwordRef);
await azureDb.downloadData(conn, ['Sales', 'Inventory', 'Products'], './data');
await azureDb.disconnect(conn);
```

Downloads each table as a JSON file to the output directory.
