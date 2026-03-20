# AROS — Agentic Retail Operating System

> **AI-powered business intelligence for restaurant and retail operators.**
> Built for QSR, FSR, liquor stores, c-stores, coffee shops, food trucks, and more.

AROS puts a team of specialized AI agents at every operator's fingertips — analyzing sales, inventory, labor, voids, and reputation in real time, in their language, across every location.

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![Platform: AROS](https://img.shields.io/badge/Platform-AROS-blue.svg)](https://aros.nirlab.com)
[![Status: Beta](https://img.shields.io/badge/Status-Beta-yellow.svg)]()

---

## Meet the Team

| Agent | Role | Best For |
|-------|------|----------|
| **Ellie ✨** | Operator Intelligence — your primary interface | Every vertical |
| **Ana 📦** | Inventory — stockout prevention, velocity tracking | Food service, liquor, c-store |
| **Sammy 📈** | Revenue & P&L — real-time margin, day-over-day comps | Every vertical |
| **Victor 🔎** | Revenue Integrity — void patterns, fraud detection | High-shrink verticals |
| **Larry 👷** | Labor & Scheduling — overtime risk, coverage gaps | Staffed operations |
| **Rita ⭐** | Reputation — review aggregation, response drafting | Restaurant, coffee, food truck |

All agents report to Ellie. Ellie reports to you.

---

## What AROS Does

- **Real-time P&L** — revenue, COGS, and labor cost every hour, not end of week
- **Stockout prediction** — know what's running out before it's 86'd
- **Void & fraud detection** — cashier patterns that don't add up, surfaced quietly
- **Labor cost tracking** — overtime risk before it's overtime
- **Review management** — all your reviews in one place, AI-drafted responses in your voice
- **Multilingual** — operators and staff work in their language (Spanish, Portuguese, Chinese, Korean, and more)
- **Works with your POS** — RapidRMS, Clover, Square, DoorDash, Grubhub, and more

---

## Quickstart

```bash
# Clone and install
git clone <repo-url> aros-platform && cd aros-platform
pnpm install

# Configure
cp aros.config.example.json aros.config.json
# Edit aros.config.json with your credentials

# Start development
pnpm dev

# Build for production
pnpm build
```

**Requirements:** Node.js 20+, pnpm 8+, Docker (for local services)

---

## Architecture

AROS is a whitelabelable surface layer built on the MIB007 core engine. The core is never exposed to customers — AROS consumes versioned packages via a private registry.

```
aros-platform/
├── packages/core/       # Thin wrapper around @mib007/core
├── apps/web/            # Main AROS web UI (Vite + React)
├── aros-ai/             # AROS AI agent — the platform driver (Ellie)
├── plugins/auth/        # Auth plugin (ArosProvider + ShreProvider)
├── whitelabel/          # Brand themes, configs, schema
├── marketplace/         # MIB007 node marketplace client
├── updater/             # Core update mechanism
└── deploy/              # Docker, K8s deployment configs

docs/
├── ARCHITECTURE.md      # Full technical + business architecture
├── AGENTS.md            # Agent registry + reporting hierarchy
├── INDUSTRIES.md        # Industry taxonomy + agent relevance matrix
├── PLATFORM.md          # Platform vision, pricing, roadmap
└── legal/
    ├── PRIVACY-POLICY.md
    ├── TERMS-OF-SERVICE.md
    ├── GLOBAL-COMPLIANCE.md
    └── IP-PROTECTION.md
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical architecture.
See [docs/AGENTS.md](./docs/AGENTS.md) for the agent hierarchy.
See [docs/INDUSTRIES.md](./docs/INDUSTRIES.md) for the industry taxonomy.

---

## Supported Verticals

| Segment | Verticals |
|---------|-----------|
| **Food Service** | QSR, Full Service, Bar/Nightclub, Coffee & Smoothie, Bakery, Food Truck, Catering |
| **Fuel & Convenience** | C-Store, Gas Station |
| **Specialty** | Liquor Store, Tobacco / Smoke Shop |
| **Retail** | Gift Store, General Retail |

See [docs/INDUSTRIES.md](./docs/INDUSTRIES.md) for agent relevance by vertical.

---

## Integrations

| Category | Integrations |
|----------|-------------|
| **POS** | RapidRMS, Clover, Square |
| **Delivery** | DoorDash, Grubhub, Uber Eats |
| **Reviews** | Google, Yelp, TripAdvisor, OpenTable |
| **Payment** | Stripe |
| **Accounting** | Eurodata (more coming) |

---

## Pricing

| Tier | Price | Best For |
|------|-------|----------|
| **Free** | $0/mo | Single location, English only, Ellie + Ana + Sammy |
| **Starter** | $99/mo/location | Full agent suite, multilingual, auto-alerts |
| **Pro** | $349/mo/location | Predictive analytics, scheduling, multi-location |
| **Enterprise** | Custom | Franchise, whitelabel, SLA, source escrow |

See [docs/PLATFORM.md](./docs/PLATFORM.md) for full pricing details.

---

## Whitelabeling

AROS supports full whitelabel customization. Every customer deployment can have its own brand identity, agent name, colors, logo, and feature surface.

### Quick whitelabel setup

```bash
# 1. Copy the default config
cp -r whitelabel/default/ whitelabel/<customer-name>/

# 2. Set brand, agent name, domain
# Edit whitelabel/<customer-name>/config.json

# 3. Set colors and theme
# Edit whitelabel/<customer-name>/theme.json

# 4. Replace logo
cp <customer-logo>.svg whitelabel/<customer-name>/logo.svg

# 5. Activate
# Set whitelabel.active = "<customer-name>" in aros.config.json
```

Ellie becomes whatever name the customer chooses. No residual AROS branding.

See [ARCHITECTURE.md#whitelabel](./ARCHITECTURE.md) for full whitelabel documentation.

---

## Deployment

```bash
# Local / self-hosted
docker compose -f deploy/docker-compose.yml up

# Production
docker build -f deploy/Dockerfile -t aros-platform .
```

Kubernetes manifests: `deploy/k8s/`

---

## Security

- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Tenant data isolation — no shared data stores between operators
- License enforcement: cryptographically signed keys, verified at boot
- SOC 2 Type II (in progress)
- Report vulnerabilities: security@nirlab.com

See [security/README.md](./security/README.md) for security architecture.

---

## Legal

| Document | Link |
|----------|------|
| Terms of Service | [docs/legal/TERMS-OF-SERVICE.md](./docs/legal/TERMS-OF-SERVICE.md) |
| Privacy Policy | [docs/legal/PRIVACY-POLICY.md](./docs/legal/PRIVACY-POLICY.md) |
| Global Compliance Guide | [docs/legal/GLOBAL-COMPLIANCE.md](./docs/legal/GLOBAL-COMPLIANCE.md) |
| EULA | [EULA.md](./EULA.md) |
| IP Protection | [docs/legal/IP-PROTECTION.md](./docs/legal/IP-PROTECTION.md) *(internal)* |

---

## Contributing

AROS is proprietary software. External contributions are not accepted on the core platform.

**Plugin developers:** Build on the [AROS Plugin SDK](./docs/PLATFORM.md#developer-ecosystem) — the open extension layer. See the Developer Terms before publishing to the Marketplace.

---

## License

Proprietary — All Rights Reserved. © 2026 NirLab Inc.

AROS is licensed under the [AROS License](./LICENSE). The plugin SDK is separately licensed under the AROS Plugin License.

For licensing inquiries: legal@nirlab.com

---

## Contact

- **Website:** [aros.nirlab.com](https://aros.nirlab.com)
- **Support:** hello@nirlab.com
- **Security:** security@nirlab.com
- **Partnerships & Whitelabel:** partnerships@nirlab.com
