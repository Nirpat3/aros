# AROS Connector Specification

A connector is a package that pulls data from an external system (POS, database, API) into AROS, normalizes it, and makes it available for agent context injection.

---

## 1. manifest.json Schema

Every connector must include a `manifest.json` at the package root.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Reverse-domain unique identifier: `com.yourorg.connector-name` |
| `name` | string | Display name shown in the marketplace |
| `version` | string | Semver: `1.0.0` |
| `description` | string | 1–2 sentences describing what it connects and what data it provides |
| `category` | NodeCategory | One of the categories listed below |
| `author` | string | Your name or organization |
| `packageName` | string | npm package name: `@yourorg/connector-name` |
| `capabilities` | string[] | What the connector can do (see below) |
| `pricing` | NodePricing | `{ "model": "free" }` or `{ "model": "subscription", "price": 9.99 }` |
| `requiredPlatformVersion` | string | Minimum AROS version: `0.2.0` |
| `configSchema` | object | Fields the user fills in when installing (see below) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `registry` | string | Registry URL if different from default |
| `icon` | string | URL or relative path to connector icon |
| `screenshots` | string[] | URLs to marketplace screenshots |

### configSchema

Each key is a config field the user fills in at install time. AROS renders this as a form.

```json
{
  "configSchema": {
    "apiKey": {
      "type": "string",
      "required": true,
      "label": "API Key",
      "secret": true
    },
    "baseUrl": {
      "type": "string",
      "required": false,
      "label": "Base URL",
      "default": "https://api.example.com"
    },
    "engine": {
      "type": "select",
      "options": ["mysql", "postgres"],
      "required": true
    },
    "syncInterval": {
      "type": "number",
      "required": false,
      "label": "Sync interval (ms)",
      "default": 900000
    },
    "enabled": {
      "type": "boolean",
      "default": true
    }
  }
}
```

**Field types:** `string`, `number`, `boolean`, `select`

**`secret: true`** — AROS encrypts this field with AES-256-GCM and stores only a vaultRef. The plain-text value is never persisted to disk.

### Full manifest.json Example

```json
{
  "id": "com.acmecorp.my-connector",
  "name": "Acme POS Connector",
  "version": "1.0.0",
  "description": "Connect AROS to Acme POS. Sync sales and inventory data.",
  "category": "pos",
  "author": "Acme Corp",
  "packageName": "@acmecorp/connector-acme-pos",
  "capabilities": ["sales-sync", "inventory-sync", "conexxus-compatible"],
  "pricing": { "model": "free" },
  "requiredPlatformVersion": "0.2.0",
  "configSchema": {
    "apiKey": { "type": "string", "required": true, "label": "API Key", "secret": true },
    "storeId": { "type": "string", "required": true, "label": "Store ID" }
  }
}
```

---

## 2. AROSConnector Interface

Every connector must implement this TypeScript interface:

```typescript
export interface AROSConnector {
  /**
   * Test the connection. Must return in < 10 seconds.
   * Called by AROS when the user clicks "Test Connection" in settings.
   */
  testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;

  /**
   * Fetch data for agent context. Called by AROS on schedule or on-demand.
   * Must return normalized data the agent can read.
   */
  fetchData(options: ConnectorFetchOptions): Promise<ConnectorDataResult>;

  /**
   * Optional: return a normalized dataset using Conexxus standards.
   * Implement this if your connector pulls POS/fuel/retail transaction data.
   * See shre-conexxus/ for full schema definitions.
   */
  toConexxus?(data: unknown): ConexxusDataRecord[];

  /**
   * Optional: sync data to local agent store.
   * Called automatically if the connector has `local-sync` capability.
   */
  syncToLocal?(localStorePath: string): Promise<void>;
}

export interface ConnectorFetchOptions {
  fromDate?: string;   // YYYY-MM-DD
  toDate?: string;     // YYYY-MM-DD
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

export interface ConnectorDataResult {
  records: unknown[];
  schema: 'raw' | 'conexxus' | 'aros-standard';
  fetchedAt: string;
  connectorId: string;
}
```

---

## 3. Credential Security Rules

⚠️ **Non-negotiable. AROS rejects connectors that violate these rules.**

### What AROS does with secrets

1. User fills in a `secret: true` field (e.g. password, API key)
2. AROS encrypts it with AES-256-GCM using a per-tenant key
3. Only the **vaultRef** (a lookup key) is stored — never the plain-text value
4. At runtime, your connector calls `retrieveCredential(vaultRef)` to get the plain-text value
5. The value is used in memory only and never logged

### Rules for connector authors

- **Never** store, log, or print any secret value
- **Never** include secrets in error messages
- **Never** pass secrets as URL query parameters
- **Always** mark sensitive config fields with `secret: true`
- **Always** use `retrieveCredential()` from `@aros/vault-ref` to retrieve values at runtime

### Vault pattern example

```typescript
import { retrieveCredential } from '@aros/vault-ref';

export class MyConnector {
  async connect(config: MyConfig): Promise<void> {
    // config.passwordRef is a vaultRef string like "vault:password:abc123"
    const password = await retrieveCredential(config.passwordRef);
    // Use password in-memory only — never log it
    await this.db.connect({ password });
    // password goes out of scope here
  }
}
```

---

## 4. Conexxus Standards

[Conexxus](https://conexxus.org) is the industry standards body for convenience retail technology. AROS supports Conexxus NAXML and POS standards for transaction data.

### When to implement `toConexxus()`

Implement it if your connector pulls any of:
- POS transaction data
- Fuel dispensing data
- Retail inventory data
- Loyalty/rewards transactions

### Conexxus schemas (defined in `shre-conexxus/`)

| Schema | Description |
|--------|-------------|
| `ConexxusDataRecord` | Normalized POS transaction |
| `ConexxusLineItem` | Individual line item with PLU support |
| `ConexxusTender` | Payment method normalization |
| `ForecourtTransaction` | Fuel dispensing (see `shre-conexxus/standards/forecourt/`) |

### Example

```typescript
toConexxus(data: POSTransaction[]): ConexxusDataRecord[] {
  return data.map(tx => ({
    transactionId: tx.invoiceId,
    siteId: tx.storeId,
    timestamp: tx.timestamp,
    totalAmount: tx.totalAmount,
    items: tx.lineItems.map(item => ({
      plu: item.itemId,
      description: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      departmentCode: item.department,
      taxExempt: item.taxExempt,
    })),
    tender: {
      type: 'cash', // normalize to: cash | credit | debit | gift | loyalty | other
      amount: tx.totalAmount,
    },
  }));
}
```

---

## 5. Data Normalization — AROS Standard Schemas

When `toConexxus()` is not applicable, use these AROS standard schemas:

```typescript
// AROS standard POS transaction (from connectors/rapidrms/types.ts)
interface POSTransaction {
  invoiceId: string;
  storeId: string;
  cashier?: string;
  timestamp: string;       // ISO 8601
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  voidAmount: number;
  tenderType: string;
  lineItems: POSLineItem[];
}

interface POSLineItem {
  itemId: string;
  itemName: string;
  department?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discounted: boolean;
  taxExempt: boolean;
  manualDiscount: boolean;
}

interface POSInventoryItem {
  itemId: string;
  itemName: string;
  department?: string;
  currentStock: number;
  reorderPoint?: number;
  costPrice?: number;
  retailPrice: number;
  lastUpdated: string;
}
```

---

## 6. Agent Context Injection

Your connector's data is automatically available in agent conversations.

### How it works

1. Connector fetches data on schedule (based on `syncIntervalMs` config)
2. Data is stored in `.aros-data/agent-datasets/<connectorId>.json`
3. At conversation start, AROS injects dataset summaries into the agent's context
4. Agent can query specific records by asking for details

### Best practices for agent-readable data

- **Use flat records** — deeply nested objects are harder for agents to reason about
- **Include IDs** — always include `invoiceId`, `itemId`, etc. for reference
- **Normalize dates** — always ISO 8601 (`2024-01-15T10:30:00Z`)
- **Include summaries** — if your dataset is large, pre-compute totals/averages
- **Limit size** — aim for < 10,000 records per sync; use date ranges for large datasets

---

## 7. Categories

| Category | Description | Examples |
|----------|-------------|---------|
| `pos` | Point-of-sale systems | RapidRMS, Square, Clover |
| `pos-connector` | POS API wrappers | Custom POS adapters |
| `inventory` | Inventory management | Shopify inventory, WMS systems |
| `analytics` | Analytics/BI platforms | Looker, Tableau, custom analytics |
| `loyalty` | Loyalty/rewards programs | Points systems, punch cards |
| `marketing` | Marketing platforms | Email, SMS, push notifications |
| `payments` | Payment processors | Stripe, Square Payments |
| `shipping` | Shipping/logistics | FedEx, UPS, USPS |
| `crm` | Customer relationship mgmt | Salesforce, HubSpot |
| `reporting` | Reporting/dashboards | Custom report builders |
| `database` | Direct database connectors | Azure SQL, AWS RDS, PostgreSQL |
| `integration` | General integrations | REST APIs, webhooks, ETL |
| `utility` | Utility connectors | CSV reader, file watcher |

---

## 8. Marketplace Submission Checklist

Before running `aros publish`:

- [ ] `manifest.json` is valid and complete
- [ ] All `secret: true` fields use vaultRef pattern — no plain-text secrets in code
- [ ] `testConnection()` returns within 10 seconds
- [ ] TypeScript compiles cleanly (`tsc --noEmit`)
- [ ] README.md explains: what it connects, how to configure, what data it provides
- [ ] Tested locally with `aros dev --plugin ./my-connector`
- [ ] If POS/retail data: `toConexxus()` is implemented
- [ ] Error messages never include secret values
- [ ] `package.json` peer deps are listed (e.g. `mysql2`, `pg`, `mssql`)
- [ ] Version follows semver (`1.0.0`)
