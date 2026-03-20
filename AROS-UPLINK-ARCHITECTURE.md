# AROS Uplink Architecture — Data Flow from Store to Shre

*How AROS agents in the field report back to the mothership without triggering corporate firewalls.*

## The Problem

AROS runs inside a retailer's network. That network:
- Has corporate firewalls blocking unknown inbound/outbound connections
- May have DPI (Deep Packet Inspection) flagging non-standard traffic
- Has IT policies that block unknown ports, protocols, and domains
- May use proxy servers that intercept HTTPS
- Has security teams that investigate unusual outbound traffic patterns

**We need data to flow from AROS → Shre without raising flags.**

## Design Principles

1. **AROS always initiates** — outbound only, never inbound. No open ports on the store network.
2. **Standard protocols only** — HTTPS (443), WSS (443). Nothing exotic.
3. **Known-good domains** — Traffic goes to `api.AROS_DOMAIN` or `sync.AROS_DOMAIN` — looks like any SaaS product.
4. **Small, frequent payloads** — Not bulk data dumps. Small JSON payloads that look like normal API calls.
5. **Graceful degradation** — If uplink is blocked, AROS continues operating locally. It's not dependent on the mothership.
6. **Customer consent** — Data sharing is opt-in, transparent, and clearly documented in EULA.
7. **Zero PII by default** — Aggregated metrics only. No customer names, no employee SSNs, no raw transaction data unless explicitly enabled.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    STORE NETWORK                          │
│                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │  POS/RapidRMS│───→│ AROS Runtime │───→│ Local DB   │  │
│  │  Clover/Sqr  │    │ (skills run  │    │ (SQLite/   │  │
│  └─────────────┘    │  locally)     │    │  LevelDB)  │  │
│                      └──────┬───────┘    └────────────┘  │
│                             │                             │
│                    ┌────────┴────────┐                    │
│                    │  AROS Uplink    │                    │
│                    │  Agent          │                    │
│                    └────────┬────────┘                    │
│                             │                             │
│  ═══════════════════════════╪═════════ FIREWALL ════════  │
│                             │ HTTPS/443 outbound only     │
└─────────────────────────────┼────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  api.AROS_DOMAIN  │  (or sync.AROS_DOMAIN)
                    │  (Cloudflare)    │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │  Shre Ingestion  │
                    │  Gateway         │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
     ┌──────┴──────┐  ┌─────┴─────┐  ┌──────┴──────┐
     │ CortexDB    │  │ Shre      │  │ Learning    │
     │ (aggregate  │  │ Router    │  │ Pipeline    │
     │  analytics) │  │ (routing) │  │ (skills     │
     └─────────────┘  └───────────┘  │  refinement)│
                                      └─────────────┘
```

---

## Firewall-Friendly Communication Patterns

### Pattern 1: HTTPS REST Polling (Most Compatible)
```
AROS → POST https://api.AROS_DOMAIN/v1/uplink/heartbeat
AROS → POST https://api.AROS_DOMAIN/v1/uplink/metrics
AROS → GET  https://api.AROS_DOMAIN/v1/downlink/commands
```
- **Why it works:** Looks like any SaaS product phoning home. Same pattern as Slack, Zoom, Salesforce.
- **Frequency:** Every 15 minutes (heartbeat), hourly (metrics), on-demand (commands).
- **Firewall perspective:** Normal HTTPS to a known domain. No red flags.

### Pattern 2: WebSocket over TLS (Real-time)
```
AROS → WSS wss://stream.shreai.com/v1/uplink
```
- **Why it works:** Same port 443, TLS encrypted. Firewalls see it as HTTPS.
- **When to use:** When store needs real-time alerts or commands from Shre.
- **Fallback:** If WSS is blocked (some proxies strip upgrade headers), falls back to Pattern 1.

### Pattern 3: Webhook Callbacks (Zero Outbound)
```
Shre → POST https://store-callback-url.com/aros/webhook
```
- **When to use:** When store has a public endpoint (Cloudflare tunnel, ngrok, etc.)
- **Least common:** Most stores don't have public endpoints.

### Pattern 4: Email Transport (Nuclear Fallback)
```
AROS → SMTP → metrics@ingest.shreai.com
```
- **Why it works:** Email is NEVER blocked. Every corporate network allows SMTP/IMAP.
- **When to use:** Only when HTTPS is completely blocked (rare but possible in ultra-locked networks).
- **Payload:** JSON metrics encoded in email body. Ingest service parses and routes.

---

## What Data Flows Up (Uplink)

### Tier 1: Anonymous Aggregate Metrics (Default — always on)
```json
{
  "storeId": "aros-xxxx",
  "period": "2026-03-18",
  "type": "daily_aggregate",
  "metrics": {
    "transactionCount": 342,
    "revenue": 8450.00,
    "avgTicket": 24.71,
    "topCategories": ["beer", "tobacco", "snacks"],
    "inventoryTurnRate": 12.4,
    "shrinkRate": 0.8,
    "laborCostPct": 14.2,
    "voidRate": 1.2,
    "customerCount": 298
  }
}
```
- **No PII.** No customer names, no employee names, no raw transactions.
- **Purpose:** Benchmarking, skill improvement, industry insights.
- **Size:** ~500 bytes per daily upload. Invisible to any DPI system.

### Tier 2: Skill Performance Data (Opt-in)
```json
{
  "storeId": "aros-xxxx",
  "skillId": "auto-reorder",
  "accuracy": 0.94,
  "falsePositives": 3,
  "missedAlerts": 1,
  "executionTimeMs": 1200,
  "feedbackScore": 4
}
```
- **Purpose:** Skill learning loop — Shre learns which skills work best, refines algorithms.
- **Benefits back to store:** Better predictions, fewer false alarms, improved recommendations.

### Tier 3: Full Transaction Data (Explicit Consent + Encryption)
- Only for stores that want cloud analytics/backup
- End-to-end encrypted (store key + Shre key — Shre can't read without store's consent)
- Used for: advanced analytics, cross-store benchmarking, custom reports
- **Must be explicitly enabled in AROS settings with owner PIN confirmation**

---

## What Data Flows Down (Downlink)

### Always Available
- Skill updates (new versions, bug fixes, improved algorithms)
- Industry benchmarks (anonymous aggregate data from all AROS stores)
- Pricing intelligence (competitor prices, vendor deals — where available)
- Regulatory updates (tax rate changes, compliance requirements)

### Per-Store Commands (via downlink queue)
- Owner-initiated reports from mobile app
- Scheduled skill executions
- Configuration changes pushed from Shre admin panel

---

## Wiring into Shre-Router

### Uplink Ingestion Route
```
POST /v1/aros/uplink
  Headers: Authorization: Bearer <store-api-key>
           X-AROS-Store-Id: aros-xxxx
           X-AROS-Version: 0.1.0
  Body: { type, metrics, skills, ... }
```

Shre-Router receives → validates store key → routes to:
1. **CortexDB** — stores aggregate metrics in `aros_analytics` schema
2. **Event Bus** — publishes `aros:metrics:received` event
3. **Learning Pipeline** — skill performance data feeds into skill refinement
4. **Ellie/Compass** — alerts on anomalies (store revenue drops 30%, shrink spikes, etc.)

### Downlink Command Route
```
GET /v1/aros/downlink?storeId=aros-xxxx
  Headers: Authorization: Bearer <store-api-key>
  Response: { commands: [...pending commands...] }
```

### Event Flow
```
Store POS → AROS Skills (local) → Skill Output → Uplink Agent
                                                      │
                                                      ├─→ Owner (morning-briefing, alerts)
                                                      └─→ Shre (metrics, learning, benchmarks)
                                                              │
                                                              ├─→ CortexDB (aros_analytics)
                                                              ├─→ Compass (data analysis)
                                                              ├─→ Learning Pipeline (skill refinement)
                                                              └─→ Ellie (owner alerts, escalations)
```

---

## Firewall Evasion — Detailed Strategies

### Strategy 1: Domain Reputation (Primary)
- `api.AROS_DOMAIN` registered on Cloudflare — Category: "Business/SaaS"
- SSL certificate from trusted CA (Let's Encrypt or Cloudflare)
- Domain age > 6 months before deploying to enterprise customers
- Listed in security vendor whitelists (submit to Palo Alto, Fortinet, Zscaler URL category)

### Strategy 2: Standard TLS on 443 (Mandatory)
- HTTPS only. Never HTTP. Never custom ports.
- TLS 1.3 with standard cipher suites
- Certificate pinning optional (some corporate proxies do SSL inspection — pinning breaks this)
- If SSL inspection detected: gracefully downgrade to certificate-agnostic mode

### Strategy 3: Small Payloads, Normal Patterns
- Max payload: 10KB per request (fits in a single TCP window)
- Request frequency: mimic normal SaaS polling (every 5-15 min)
- No bulk transfers. No sustained connections. No unusual packet sizes.
- DPI sees: normal HTTPS API calls to a SaaS domain. Nothing to flag.

### Strategy 4: Proxy-Aware HTTP Client
- Auto-detect corporate proxy settings (PAC file, WPAD, env vars)
- Support HTTP CONNECT proxy for HTTPS tunneling
- Support NTLM/Kerberos proxy authentication if required
- Fallback chain: direct → system proxy → configured proxy → email transport

### Strategy 5: DNS Considerations
- Use standard DNS (respect corporate DNS servers, don't bypass to 8.8.8.8)
- Avoid DNS-over-HTTPS (DoH) — some firewalls flag this as evasion
- If DNS is blocked for our domain: provide IP-based fallback with SNI

### Strategy 6: What We NEVER Do
- ❌ Never use non-standard ports
- ❌ Never use VPN/tunnel protocols (WireGuard, OpenVPN)
- ❌ Never use DNS tunneling or ICMP tunneling
- ❌ Never use steganography or encoding tricks
- ❌ Never bypass corporate proxy settings
- ❌ Never send data without customer consent
- **The goal is to be LEGITIMATE, not stealthy.** We're a SaaS product, not malware.

---

## Security & Privacy

### Data Sovereignty
- Store data stays on-premises by default
- Only aggregated, anonymized metrics leave the network (Tier 1)
- Full data export requires explicit owner consent + encryption
- Stores can disable uplink entirely — AROS works 100% offline

### Encryption
- TLS 1.3 in transit
- AES-256-GCM at rest (local DB)
- Tier 3 data: envelope encryption (store key wraps data key)
- Store API keys: rotated every 90 days automatically

### Compliance
- AROS EULA covers data collection transparency
- Opt-out available at any time
- Data deletion request honored within 30 days
- SOC 2 Type II target (when revenue justifies)

---

## AROS as Core Agents

The skills ARE the agents. Each skill category maps to a department:

| Skill Category | AROS Agent Role | Reports To |
|---------------|----------------|------------|
| Inventory Intelligence | Inventory Manager | Store Owner + Compass |
| Sales & Revenue | Sales Analyst | Store Owner + Compass |
| Cash & Financial | Bookkeeper | Store Owner + Ledger |
| Workforce & Ops | Shift Supervisor | Store Owner |
| Fuel Operations | Fuel Manager | Store Owner + Pulse |
| Food Service | Kitchen Manager | Store Owner |
| Customer & Marketing | Marketing Manager | Store Owner + Herald |
| Owner Intelligence | COO / GM | Store Owner |
| Loss Prevention | LP Officer | Store Owner + Guardian |
| Procurement | Purchasing Agent | Store Owner + Ledger |
| Marketing | Marketing Director | Store Owner + Herald |
| Payroll & HR | HR Manager | Store Owner + Ledger |
| Customer Loyalty | CRM Manager | Store Owner + Herald |
| Data Analyst | Business Analyst | Store Owner + Compass |
| Bank & Reconciliation | Controller | Store Owner + Ledger |
| Waste & Spoilage | Waste Manager | Store Owner |
| Change Monitoring | Audit Agent | Store Owner + Guardian |
| Regulatory | Compliance Officer | Store Owner + Guardian |

**Every agent reports to two bosses:**
1. **Store Owner** — direct alerts, reports, actionable intelligence
2. **Shre C-Suite** — aggregated learning, benchmarking, skill improvement

---

*"The king who knows the power of all six forms of policy— peace, war, marching, halting, seeking shelter, and duplicity — conquers the earth." — Arthashastra 7.1*

*For AROS: Know your inventory, money, people, customers, competitors, and data — and the business runs itself.*
