# AROS — Developer Onboarding Guide

Build plugins and connectors for the AROS platform. This guide covers everything you need to go from a GitHub repo to a published app in the AROS Marketplace.

---

## Overview

AROS supports two types of integrations:

| Type | Purpose | Examples |
|------|---------|---------|
| **Connector** | Pull data from external systems into AROS | POS adapter, database sync, API bridge |
| **Plugin** | Extend AROS with new UI pages, agent tools, or hooks | Loyalty program, SMS alerts, custom dashboards |

Both follow the same lifecycle: **Build → Test → Submit → Review → Publish**.

---

## Prerequisites

- Node.js 20+
- TypeScript (recommended)
- Your app's source code on GitHub
- An AROS developer account (sign up at your portal's `/developers` page)

---

## Part 1: Deciding What to Build

### Build a Connector if:
- Your app is a **data source** (POS, ERP, CRM, database, API)
- You want AROS agents to **read data** from your system
- You want to normalize data into AROS's standard format

### Build a Plugin if:
- Your app adds **new functionality** to AROS (UI pages, dashboards)
- You want to register **new tools** that agents can use
- You want to **hook into** agent conversations (pre/post processing)
- You want to combine multiple capabilities (UI + tools + hooks)

---

## Part 2: Building a Connector

### Quick Start

```bash
npx @aros/create-plugin my-connector --type=connector
cd my-connector
npm install
```

### Project Structure

```
my-connector/
├── manifest.json        # Metadata, config schema, pricing
├── connector.ts         # Implements AROSConnector interface
├── types.ts             # Your TypeScript types
├── index.ts             # Exports
├── package.json
└── README.md
```

### The Connector Interface

Your connector must implement these methods:

```typescript
export interface AROSConnector {
  /**
   * Verify the connection works. Must complete within 10 seconds.
   */
  testConnection(): Promise<{
    ok: boolean;
    latencyMs: number;
    error?: string;
  }>;

  /**
   * Fetch data from your system.
   */
  fetchData(options: ConnectorFetchOptions): Promise<ConnectorDataResult>;

  /**
   * Optional: Convert data to Conexxus standard format (required for POS connectors).
   */
  toConexxus?(data: unknown): ConexxusDataRecord[];

  /**
   * Optional: Sync data to local storage for offline access.
   */
  syncToLocal?(path: string): Promise<void>;
}

interface ConnectorFetchOptions {
  query?: string;
  filters?: Record<string, unknown>;
  pagination?: { page: number; limit: number };
  dateRange?: { start: string; end: string };
}

interface ConnectorDataResult {
  records: Record<string, unknown>[];
  total: number;
  hasMore: boolean;
  metadata?: Record<string, unknown>;
}
```

### manifest.json

```json
{
  "id": "com.yourcompany.my-connector",
  "name": "My Connector",
  "version": "1.0.0",
  "type": "connector",
  "description": "Connects AROS to My System for real-time data sync.",
  "category": "integration",
  "author": "Your Company",
  "packageName": "@yourcompany/my-connector",
  "capabilities": ["data-fetch"],
  "pricing": {
    "model": "free"
  },
  "requiredPlatformVersion": "0.2.0",
  "configSchema": {
    "apiUrl": {
      "type": "string",
      "required": true,
      "label": "API URL",
      "placeholder": "https://api.example.com"
    },
    "apiKey": {
      "type": "string",
      "required": true,
      "label": "API Key",
      "secret": true
    }
  }
}
```

### Credential Security (Non-Negotiable)

All sensitive config fields **must** be marked `"secret": true`. AROS encrypts these with AES-256-GCM and returns a vault reference. At runtime, retrieve the real value:

```typescript
import { retrieveCredential } from '@aros/vault-ref';

async function connect(config: MyConfig): Promise<void> {
  // config.apiKey contains a vaultRef, not the actual key
  const realKey = await retrieveCredential(config.apiKey);

  // Use the real key in-memory only — never log or persist it
  const client = new MyApiClient({ apiKey: realKey });
}
```

**Rules:**
- Never log secrets, even partially
- Never include secrets in error messages
- Never pass secrets as URL parameters
- Secrets exist only in-memory during execution

### Example: Weather API Connector

```typescript
import { retrieveCredential } from '@aros/vault-ref';

export class WeatherConnector implements AROSConnector {
  private apiKey: string | null = null;

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const key = await retrieveCredential(this.config.apiKeyRef);
      const res = await fetch(`https://api.weather.com/health?key=${key}`);
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - start, error: e.message };
    }
  }

  async fetchData(options: ConnectorFetchOptions): Promise<ConnectorDataResult> {
    const key = await retrieveCredential(this.config.apiKeyRef);
    const city = options.query || 'Austin';
    const res = await fetch(`https://api.weather.com/v1/forecast?city=${city}&key=${key}`);
    const data = await res.json();

    return {
      records: [data],
      total: 1,
      hasMore: false,
      metadata: { source: 'weather-api', fetchedAt: new Date().toISOString() }
    };
  }
}
```

---

## Part 3: Building a Plugin

### Quick Start

```bash
npx @aros/create-plugin my-plugin --type=plugin
cd my-plugin
npm install
```

### Project Structure

```
my-plugin/
├── manifest.json         # Metadata, capabilities, config schema
├── plugin.ts             # Implements AROSPlugin interface
├── pages/                # UI components (if adding pages)
│   └── MyDashboard.tsx
├── types.ts
├── index.ts
├── package.json
└── README.md
```

### The Plugin Interface

```typescript
export interface AROSPlugin {
  readonly meta: PluginMeta;

  /**
   * Called when the plugin is activated. Register tools, pages, and hooks here.
   */
  install(context: PluginContext): Promise<void>;

  /**
   * Called when the plugin is deactivated. Clean up everything you registered.
   */
  uninstall(context: PluginContext): Promise<void>;

  /**
   * Optional: Render UI into designated slots.
   */
  render?(slot: PluginSlot): PluginRenderResult;

  /**
   * Optional: Intercept messages before they reach agents.
   */
  onAgentMessage?(msg: AgentMessage, ctx: PluginContext): Promise<AgentMessage | null>;

  /**
   * Optional: Process agent responses before they reach the user.
   */
  onAgentResponse?(res: AgentResponse, ctx: PluginContext): Promise<void>;
}
```

### Registering Tools

Tools are operations that AROS agents can invoke on behalf of users:

```typescript
async install(context: PluginContext): Promise<void> {
  context.registerTool({
    name: 'check_loyalty_points',
    description: 'Look up a customer\'s loyalty points balance by phone number',
    parameters: {
      phoneNumber: { type: 'string', required: true, description: 'Customer phone number' }
    },
    execute: async (params) => {
      const points = await this.api.getPoints(params.phoneNumber);
      return {
        phoneNumber: params.phoneNumber,
        points: points.balance,
        tier: points.tier,
        expiringNext30Days: points.expiring
      };
    }
  });
}
```

Once registered, any AROS agent with the right permissions can use your tool. A user asking "How many loyalty points does 555-1234 have?" will trigger your tool automatically.

### Adding UI Pages

```typescript
async install(context: PluginContext): Promise<void> {
  context.registerPage({
    id: 'loyalty-dashboard',
    label: 'Loyalty',
    icon: 'heart',
    path: '/plugins/my-loyalty/dashboard',
    component: './pages/LoyaltyDashboard.tsx'
  });
}
```

The page appears in the AROS sidebar and is accessible to all workspace users.

### Hooking into Agent Messages

Intercept and modify messages flowing between users and agents:

```typescript
async onAgentMessage(msg: AgentMessage, ctx: PluginContext): Promise<AgentMessage | null> {
  // Enrich messages about customers with loyalty data
  if (msg.content.includes('customer') && msg.content.match(/\d{10}/)) {
    const phone = msg.content.match(/\d{10}/)[0];
    const points = await this.api.getPoints(phone);
    msg.context = {
      ...msg.context,
      loyaltyPoints: points.balance,
      loyaltyTier: points.tier
    };
  }
  return msg;  // Return null to block the message
}
```

### manifest.json for Plugins

```json
{
  "id": "com.yourcompany.loyalty-plugin",
  "name": "Loyalty Program",
  "version": "1.0.0",
  "type": "plugin",
  "description": "Adds loyalty points tracking, customer tiers, and a loyalty dashboard to AROS.",
  "category": "loyalty",
  "author": "Your Company",
  "capabilities": ["agent-tools", "ui-pages", "agent-hooks", "outbound-http"],
  "pricing": {
    "model": "subscription",
    "price": 9.99,
    "interval": "monthly"
  },
  "requiredPlatformVersion": "0.2.0",
  "configSchema": {
    "loyaltyApiUrl": {
      "type": "string",
      "required": true,
      "label": "Loyalty API Endpoint"
    },
    "apiKey": {
      "type": "string",
      "required": true,
      "label": "API Key",
      "secret": true
    }
  }
}
```

### Capability Reference

Declare only the capabilities your plugin needs:

| Capability | What It Grants |
|-----------|---------------|
| `agent-tools` | Register tools that agents can call |
| `ui-pages` | Add pages to the AROS sidebar |
| `agent-hooks` | Intercept agent messages and responses |
| `outbound-http` | Make HTTP requests to external services |
| `local-storage` | Read/write plugin-scoped storage |

Undeclared capabilities are blocked at runtime.

---

## Part 4: Testing Locally

Start a local AROS dev server with your plugin loaded:

```bash
aros dev --plugin ./my-plugin
```

This launches AROS at `http://localhost:8000` with hot-reload enabled.

### Test Checklist

- [ ] `testConnection()` completes within 10 seconds (connectors)
- [ ] `fetchData()` returns properly structured records (connectors)
- [ ] `install()` registers all tools and pages without errors (plugins)
- [ ] `uninstall()` removes everything cleanly (plugins)
- [ ] Config form renders correctly with all fields
- [ ] Secret fields show masked input (not plain text)
- [ ] No secrets appear in console logs or error messages
- [ ] TypeScript compiles cleanly: `npx tsc --noEmit`
- [ ] README explains what it does, how to configure, and what data flows

---

## Part 5: Submitting to the Marketplace

### Option A: Via the Developer Portal UI

1. Go to `/developers` in your AROS portal
2. Fill in the 5-step submission form:

| Step | What You Provide |
|------|-----------------|
| **Overview** | Read the marketplace guidelines |
| **Plugin Info** | Name, version, description, category, changelog |
| **Integration** | Package name, GitHub URL, entry point, config fields, required permissions |
| **Demo & Testing** | Demo URL, test credentials, sandbox/staging/production, testing instructions |
| **Review & Submit** | Agree to terms, submit |

### Option B: Via CLI

```bash
aros publish
```

This packages your plugin and submits it to the marketplace registry.

### What Happens After Submission

1. **Pending Review** — your submission enters the review queue
2. **In Review** — an AROS admin evaluates security, functionality, and quality
3. **Approved** or **Revision Requested** — you may be asked to make changes
4. **Published** — your plugin appears in the marketplace for all AROS customers

You can track your submission status at `/developers` in the portal.

---

## Part 6: How Your Plugin Gets Used

Once published, here's what happens when a customer installs your plugin:

### The 4-Gate Permission Model

AROS enforces 4 gates before an agent can use your plugin's tools:

```
1. App Gate     →  Is your plugin activated in the customer's workspace?
2. Node Gate    →  Has the customer provided required credentials/config?
3. Permission Gate  →  Is the agent granted access to your tool?
4. Project Gate →  If project-scoped, is this the right project?
```

All 4 gates must pass. This means:
- Customers explicitly choose to install your plugin
- Credentials are provided by the customer (you never see them — vault-ref handles it)
- Workspace admins control which agents can use your tools
- Data access is scoped and auditable

### Revenue

If your plugin has a subscription price, AROS handles billing. Revenue is shared per the marketplace agreement (see Terms of Service).

---

## Reference: Built-in Connector Example

The RapidRMS connector at `aros-platform/connectors/rapidrms/` is a production reference implementation. It demonstrates:

- Full `AROSConnector` interface implementation
- Credential handling with vault-ref
- Multi-site discovery and selection
- Conexxus data normalization (for POS data)
- Incremental sync with date ranges

---

## Reference: Full Spec Documents

For complete interface specifications, schemas, and edge cases:

| Document | Contents |
|----------|---------|
| [CONNECTOR_SPEC.md](./plugin-development/CONNECTOR_SPEC.md) | Full connector interface, manifest schema, data normalization, credential security |
| [PLUGIN_SPEC.md](./plugin-development/PLUGIN_SPEC.md) | Full plugin interface, lifecycle, rendering slots, agent hooks, isolation model |
| [EXAMPLES.md](./plugin-development/EXAMPLES.md) | 3 complete worked examples: CSV Reader, Weather API, Azure SQL |
| [DATA_PLUGIN_GUIDE.md](./plugin-development/DATA_PLUGIN_GUIDE.md) | Data connector design patterns and best practices |

---

## FAQ

**Q: Can I build both a connector and a plugin?**
Yes. Many integrations are both — a connector for data sync and a plugin for UI/tools. Use separate manifests or combine into one with `"type": "plugin"` and `"capabilities": ["data-fetch", "agent-tools", "ui-pages"]`.

**Q: Do I need to handle authentication/login?**
No. AROS handles user auth. Your plugin receives a `PluginContext` with the authenticated workspace and user info.

**Q: Can my plugin access other plugins' data?**
No. Plugins are isolated. Use the AROS agent tool system to interact with data from other sources.

**Q: What languages are supported?**
TypeScript/JavaScript (Node.js 20+). The scaffold generates TypeScript by default.

**Q: How do I update a published plugin?**
Bump the version in `manifest.json` and `package.json`, then run `aros publish` again. Updates go through the same review process.

**Q: Is there a sandbox for testing?**
Yes. Use `aros dev --plugin ./my-plugin` for local testing. For marketplace testing, submit with `environment: "sandbox"` in the demo step.

**Q: What's the review timeline?**
Typically 2–5 business days. You'll be notified by email when the review is complete.

---

## Quick Start Summary

```bash
# 1. Scaffold
npx @aros/create-plugin my-plugin --type=connector  # or --type=plugin

# 2. Build
cd my-plugin
# Implement the interface in connector.ts or plugin.ts

# 3. Test
aros dev --plugin ./my-plugin

# 4. Publish
aros publish
```

---

*Build once, reach every AROS customer. Welcome to the marketplace.*
