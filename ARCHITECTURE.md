# AROS Platform Architecture

> For investors, acquirers, and technical leadership.

## Executive Summary

AROS (Agentic Retail Operating System) is a whitelabelable AI retail platform built on proven internal technology. It decouples the sellable product surface from the proprietary core engine (MIB007), enabling licensing, white-labeling, and standalone deployment without exposing source IP.

## System Overview

```
┌─────────────────────────────────────────────────┐
│                   AROS Platform                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ AROS AI  │  │ Web UI   │  │  Whitelabel   │ │
│  │ (Agent)  │──│ (React)  │──│  (Theme/Brand)│ │
│  └────┬─────┘  └──────────┘  └───────────────┘ │
│       │                                          │
│  ┌────┴─────────────────────────────────────┐   │
│  │              @aros/core                   │   │
│  │     (thin wrapper around @mib007/core)    │   │
│  └────┬──────────────┬──────────────┬───────┘   │
│       │              │              │            │
│  ┌────┴────┐  ┌──────┴─────┐  ┌────┴────┐      │
│  │ Updater │  │ Marketplace│  │ Plugins │      │
│  │         │  │            │  │ (Shre)  │      │
│  └────┬────┘  └──────┬─────┘  └────┬────┘      │
└───────┼──────────────┼──────────────┼───────────┘
        │              │              │
   ┌────┴──────────────┴──────────────┴────┐
   │          MIB007 Registry               │
   │   (packages, nodes, update feeds)      │
   └────────────────────────────────────────┘
```

## Core Relationships

### MIB007 → AROS

MIB007 is the internal core engine. It is never deployed directly to customers. Instead:

1. MIB007 publishes **versioned packages** to a private registry (`@mib007/core`, `@mib007/nodes/*`)
2. AROS consumes these packages as dependencies — version-pinned with controlled updates
3. The `@aros/core` wrapper adds AROS-specific overrides, configuration injection, and whitelabel hooks
4. MIB007 source code never leaves the internal repository

This architecture means AROS can be sold, licensed, or transferred without transferring MIB007 IP.

### AROS AI — The Platform Driver

AROS AI is not a chatbot bolted onto a dashboard. She **is** the platform. The conversational interface and the control plane are the same system.

Capabilities:
- **Marketplace management**: Browse, install, update, and remove Nodes
- **Configuration**: Modify platform settings, toggle plugins, manage whitelabel
- **Monitoring**: Surface health, usage metrics, and alerts to operators
- **Identity**: When Shre is not present, AROS manages auth directly via LocalProvider
- **Updates**: Check, stage, apply, and roll back core updates from MIB007 registry
- **Conversation**: Natural language interface for all of the above

In whitelabeled deployments, AROS AI takes whatever name the customer gives her. She carries no ego about her name — she is the platform, whatever it's called.

### Shre Plugin Model

Shre is MIB007's identity and vault layer. In AROS, it's an optional plugin:

| Mode | Auth | Vault | Dependencies |
|------|------|-------|-------------|
| Shre enabled | ShreProvider → Shre endpoint | Shre vault | Requires Shre service running |
| Shre disabled | LocalProvider → local JWT | Local encrypted storage | Zero external dependencies |

The provider interface is identical in both modes. Application code never knows which provider is active.

## Whitelabel System

Every visual and textual element of AROS is customizable per deployment:

- **Brand**: Name, logo, tagline, domain, email sender identity
- **Theme**: Colors (primary, secondary, accent, backgrounds, text), fonts, spacing, border radius, shadows
- **Agent**: Name, avatar, personality modifiers
- **Feature surface**: Which marketplace categories are visible, which tools are exposed
- **Layout**: Sidebar position, navigation style, density

Whitelabel configs are loaded at build time and injected via React context. Runtime switching is supported for multi-tenant deployments.

## Node Marketplace

Nodes are modular capabilities published to the MIB007 registry:

```
Node lifecycle:
  Registry → Install → Configure → Activate → Update → Deactivate → Uninstall
```

Examples:
- **StorePulse** — RapidRMS POS integration, real-time sales data
- **InventorySync** — Multi-location inventory management
- **CustomerInsights** — AI-driven customer behavior analytics
- **LoyaltyEngine** — Points, tiers, rewards program management

Nodes declare their own UI components, API routes, and AROS AI tools. When installed, they extend the platform seamlessly.

## Update Mechanism

AROS tracks MIB007 releases via a secure update feed:

1. **Check**: Poll `registry.mib007.io/releases` for new versions on the configured channel (stable/beta/canary)
2. **Stage**: Download the update package, verify signatures, run compatibility checks
3. **Apply**: Install the new `@mib007/core` version, run migrations if needed
4. **Verify**: Health checks confirm the update succeeded
5. **Rollback**: If verification fails, automatically revert to the previous pinned version

Operators can configure auto-update or manual approval via `aros.config.json`.

## Deployment Models

### Self-hosted (Docker Compose)

Single-machine deployment for small retailers. `docker compose up` runs the full stack.

### Cloud (Kubernetes)

Multi-tenant deployment for SaaS or managed service. Helm charts and K8s manifests provided.

### Embedded

AROS core can be embedded into existing retail systems as a library, with the AI agent exposed via API.

## Revenue Model

| Stream | Description |
|--------|-------------|
| Platform license | Per-deployment or per-seat licensing of the AROS platform |
| Whitelabel fee | One-time setup + ongoing fee for custom-branded deployments |
| Marketplace revenue share | Commission on third-party Node sales |
| Managed service | Hosted AROS with SLA, monitoring, and support |
| MIB007 core updates | Ongoing subscription for core engine updates |

## Exit Story

AROS is designed for clean separation from MIB007:

1. **No source coupling**: AROS consumes published packages, not source code
2. **Replaceable core**: The `@aros/core` wrapper means the MIB007 dependency could be replaced with any compatible implementation
3. **Standalone mode**: With Shre disabled and core packages vendored, AROS runs with zero external dependencies
4. **Clean IP**: AROS platform code, whitelabel system, marketplace client, and AI agent are all independently owned
5. **Transferable**: A buyer gets a working product on day one without needing access to MIB007 internals

## Security

- All inter-service communication over TLS
- JWT-based auth (Shre-issued or locally generated)
- Marketplace packages verified via content-addressable hashes and registry signatures
- Whitelabel configs are build-time only — no runtime config injection from untrusted sources
- LocalProvider encrypts vault data at rest with AES-256-GCM
