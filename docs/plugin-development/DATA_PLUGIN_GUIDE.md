# AROS Data Plugin & Connector Developer Guide

> Version 1.0 — March 2026

## Vision

AROS is an agentic intelligence platform for retail. Every store, every system, every database can connect — and when they do, AROS agents learn from that data and turn it into intelligence.

**The model:**
- You bring your application or database
- You build an AROS Connector Plugin
- Your data flows into the AROS Agent Platform
- Agents learn, grow, and provide insights — specific to your data
- You (or your customers) get an AI-powered retail brain, not a generic chatbot

This is the same POS-agnostic abstraction model described in the bp POS Agnostic background document: a standardized REST/schema layer sits between proprietary systems (POS, back office, forecourt) and the intelligence layer above it. AROS is that intelligence layer.

## Two Types of Integrations

### 1. Data Connector Plugins
Connect external databases and applications as data sources for AROS agents.

```
Your App/DB → AROS Connector Plugin → Agent Context → AI Insights
```

**Use when:** You have retail data (POS, inventory, loyalty, ERP, CRM) and want AROS agents to learn from it.

### 2. UI Extension Plugins
Add custom pages, panels, or tools to the AROS interface.

```
Your Feature → AROS Plugin → Appears in AROS Dashboard
```

**Use when:** You want to extend what AROS users can see and do.

---

## Quick Start — Build a Data Connector

### 1. Create your manifest (`manifest.json`)

```json
{
  "id": "com.yourcompany.your-connector",
  "name": "Your Connector",
  "version": "1.0.0",
  "category": "pos",
  "description": "Connects YourApp to AROS agents",
  "author": {
    "name": "Your Company",
    "url": "https://yourcompany.com"
  },
  "capabilities": ["data-sync", "real-time-events", "agent-context"],
  "configSchema": {
    "apiKey": { "type": "string", "label": "API Key", "secret": true },
    "endpoint": { "type": "string", "label": "API Endpoint" }
  },
  "pricing": { "model": "free" }
}
```

**Category options:** `pos`, `forecourt`, `loyalty`, `inventory`, `fleet`, `back-office`, `compliance`, `other`

### 2. Implement the AROSConnector interface

```typescript
import type { AROSConnector, ConnectorConfig, AgentContext, SyncOptions, SyncResult } from '@aros/connector-types';

export class YourConnector implements AROSConnector {
  id = 'com.yourcompany.your-connector';

  async connect(config: ConnectorConfig): Promise<void> {
    // Initialize connection using vault-ref credentials
    // Credentials are retrieved at runtime via config.credentials.vaultRef
    // NEVER hardcode credentials — use config.credentials.vaultRef
    const apiKey = await config.credentials.resolve(config.credentials.vaultRef);
    // initialize your client...
  }

  async testConnection(): Promise<boolean> {
    // Return true if connection is healthy
    // Called by AROS health checks and the connector validation tool
    try {
      // ping your API or DB
      return true;
    } catch {
      return false;
    }
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    // Fetch data from your source
    // Normalize to Conexxus schemas where applicable (see below)
    // Return structured data for agent consumption
    return {
      recordsProcessed: 0,
      lastSyncedAt: new Date().toISOString(),
      errors: [],
    };
  }

  async getAgentContext(): Promise<AgentContext> {
    // Return current data snapshot for agent context injection
    // This is what the AI agent knows about your data right now
    return {
      summary: 'Your store has 1,247 items in inventory...',
      metrics: {
        /* key performance metrics */
      },
      alerts: [
        /* any active alerts — low stock, anomalies, etc. */
      ],
      data: {
        /* structured data payload */
      },
    };
  }
}
```

### 3. Security rules (NON-NEGOTIABLE)

| Rule | Requirement |
|------|-------------|
| **Vault-ref only** | Credentials must come from `config.credentials.vaultRef` — never hardcoded, never in env vars |
| **No data exfiltration** | Your connector may only write to the AROS local CortexDB store. Writing to external APIs requires explicit user consent and approved capabilities in your manifest |
| **BYOM** | AROS never provides AI model keys. Agents use the user's configured model. Don't assume model access |
| **Scoped access** | Only request data your connector genuinely needs. Overly broad data access will fail security review |
| **No PAN storage** | Never store raw cardholder data. Map payment events to Conexxus EPS types (masked PAN only) |

---

## How Agents Learn From Your Data

When your connector syncs data, AROS does the following:

1. **Normalizes** the data to Conexxus schemas where applicable (forecourt, merchandise, mobile payments, etc.)
2. **Stores** in the local CortexDB agent store (PostgreSQL, on-device, fully private)
3. **Indexes** for semantic search (Qdrant vector store — embeddings generated locally)
4. **Injects context** into every agent conversation that's relevant to your data domain
5. **Builds patterns** as data accumulates — agents learn what's normal vs. anomalous for this specific business

The more data you provide, the smarter the agents get — and it's specific to *that* business, not generic retail advice.

### Context Injection Flow

```
Your Connector → CortexDB (relational) → Qdrant (vector)
                      ↓
               Agent Context Builder
                      ↓
         Every conversation: "Here's what I know about your store..."
```

---

## Conexxus Standards

AROS uses [Conexxus](https://conexxus.org) retail industry standards for data normalization. Conexxus is the Registration Authority for X9.104 payment product codes and maintains interoperability specs for the petroleum/convenience industry.

When your connector maps to a Conexxus schema, it **automatically works with every AROS agent** that understands that standard — no extra wiring needed.

### Key Schemas

| Standard | Interface | When to use |
|----------|-----------|-------------|
| `ForecourtTransaction` | `shre-conexxus` | Fuel pump transactions (EPS v2.11) |
| `POSBOJournalEntry` | `shre-conexxus` | POS sales journal (POSBO v1.6) |
| `POSBOMerchandiseItem` | `shre-conexxus` | Merchandise catalog + pricing |
| `POSBOFuelConfig` | `shre-conexxus` | Fuel grade configuration |
| `MobilePaymentSession` | `shre-conexxus` | Mobile payment events (Conexxus Mobile Payments v2.0) |
| `DigitalOffer` | `shre-conexxus` | Loyalty and discount offers |
| `TankReading` | `shre-conexxus` | Fuel tank telemetry (ATG data) |
| `FleetTransaction` | `shre-conexxus` | Fleet card transactions (EMV fleet) |
| `AgeVerificationRequest` | `shre-conexxus` | Age-restricted item sales |
| `CarWashSession` | `shre-conexxus` | Car wash events |
| `PaymentProductCode` | `shre-conexxus` | X9.104 v3.7 product code lookup |

### Import Example

```typescript
import type {
  ForecourtTransaction,
  POSBOJournalEntry,
  POSBOMerchandiseItem,
  PaymentProductCode,
} from 'shre-conexxus';

import { lookupProductCode, getProductsByCategory } from 'shre-conexxus';

// Example: normalizing a POS sale line item
function normalizeSaleLine(rawLine: YourLineItem): POSBOJournalLineItem {
  const productCode = lookupProductCode(rawLine.productCode);
  return {
    sequence: rawLine.seq,
    itemCode: rawLine.sku,
    description: productCode?.description ?? rawLine.name,
    quantity: rawLine.qty,
    unitPrice: rawLine.price,
    extendedPrice: rawLine.qty * rawLine.price,
    taxAmount: rawLine.tax,
  };
}
```

---

## First-Party Applications by Nirlab

Nirlab builds premium applications on the same connector infrastructure. These are upsell products available through the AROS Marketplace — and they demonstrate exactly what's possible with the connector framework.

| App | What it does | Type |
|-----|-------------|------|
| **StorePulse** | Real-time POS dashboard with AI-generated insights and anomaly detection | Paid |
| **FuelOps** | Forecourt monitoring, tank telemetry, compliance dashboard, ATG integration | Paid |
| **LoyaltyIQ** | AI-powered loyalty engine + digital offers, redemption analytics | Paid |
| **FleetDesk** | Fleet card management, EMV fleet compliance, utilization reporting | Paid |
| **ComplianceGuard** | P2PE compliance tracking, age verification audit trail, regulatory reporting | Paid |

Every one of these is a standard AROS plugin — same APIs, same connector types, same `shre-conexxus` schemas. They prove the platform. Third-party connectors work exactly the same way.

---

## Testing Your Connector

### Local validation

```bash
# Install the AROS connector CLI (once available)
npm install -g @aros/connector-cli

# Validate manifest and type compliance
aros connector validate ./your-connector/

# Run connection test against your live system
aros connector test --config ./test-config.json

# Simulate a sync cycle
aros connector sync --dry-run --config ./test-config.json
```

### Manual checklist before submission

- [ ] `manifest.json` is valid JSON with all required fields
- [ ] Connector implements all required `AROSConnector` methods
- [ ] `testConnection()` returns `false` on failure (not throws)
- [ ] No credentials hardcoded anywhere
- [ ] No raw PAN data stored or logged
- [ ] Data maps to Conexxus schemas where applicable
- [ ] Sync is idempotent (can run twice without duplicates)
- [ ] `getAgentContext()` returns meaningful summary, metrics, and alerts

---

## Marketplace Submission

When your connector is ready:

1. Run `aros connector validate` — fix any errors
2. Submit manifest and connector bundle to `marketplace.aros.nirlab.com`
3. Nirlab security + standards review: **3–5 business days**
   - Security audit (credential handling, data scope, exfiltration checks)
   - Conexxus standards compliance check (schema conformance)
   - Functional test against AROS dev environment
4. Approved connectors are listed in the AROS Marketplace under your category
5. Updates follow the same review flow (major version bumps require full re-review)

**Developer support:** developers@nirlab.com *(placeholder — not yet monitored)*

---

## Architecture Reference

### Where your data lives

```
Your System
    │
    ▼ (AROS Connector Plugin)
CortexDB (PostgreSQL)     ← relational store, per-site, fully local
    │
    ├──► conexxus.* tables (normalized Conexxus schemas)
    └──► raw data tables (connector-specific)
         │
         ▼
Qdrant Vector Store       ← semantic search index (local embeddings)
         │
         ▼
Agent Context Builder     ← assembles relevant context for each conversation
         │
         ▼
AROS Agent (LLM)          ← runs on user's own model (BYOM)
         │
         ▼
Insights & Answers        ← specific to this business's data
```

### Data stays local

AROS is designed for **on-premise intelligence**. Your store's data does not leave the local network unless you explicitly enable cloud features (which require separate user consent and are clearly labeled). The CortexDB store is local PostgreSQL. The vector index is local Qdrant. The AI model is the user's own.

This is by design — retail operators are cautious about sensitive transaction data leaving their premises. AROS respects that.

---

## Versioning & Compatibility

- Connector manifests use semantic versioning (`MAJOR.MINOR.PATCH`)
- Breaking schema changes → bump MAJOR
- New optional fields → bump MINOR
- Bugfixes → bump PATCH
- `shre-conexxus` follows the same convention (currently `0.3.0`)
- AROS platform maintains backward compatibility for all connector APIs within a major version

---

*Built on Conexxus retail standards. Designed for the petroleum/convenience industry and beyond.*
