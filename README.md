# AROS — Agentic Retail Operating System

AROS is a whitelabelable AI-powered retail operating platform. It consumes versioned packages from the MIB007 core engine and exposes a fully customizable, brandable surface for retail operators.

AROS AI is the platform driver — she is not an assistant bolted onto the platform; she **is** the platform. Identity, control, and conversation unified.

## Quickstart

```bash
# Clone and install
git clone <repo-url> aros-platform && cd aros-platform
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build
```

## Architecture

```
aros-platform/
├── packages/core/       # Thin wrapper around @mib007/core
├── apps/web/            # Main AROS web UI (Vite + React)
├── aros-ai/             # AROS AI agent — the platform driver
├── plugins/auth/        # Auth plugin (ArosProvider + ShreProvider)
├── whitelabel/          # Brand themes, configs, schema
├── marketplace/         # MIB007 node marketplace client
├── updater/             # Core update mechanism
└── deploy/              # Docker, K8s deployment configs
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical and business architecture.

## Whitelabeling

AROS supports full whitelabel customization. Every customer deployment can have its own brand identity, agent name, colors, logo, and feature surface.

### Quick whitelabel setup

1. Copy `whitelabel/default/` to `whitelabel/<customer-name>/`
2. Edit `config.json` — set brand name, agent name, domain, email branding
3. Edit `theme.json` — set colors, fonts, spacing, border radius
4. Replace `logo.svg` with the customer's logo
5. Set `whitelabel.active` in `aros.config.json` to `<customer-name>`

See `whitelabel/schema.json` for the full list of customizable fields.

### Agent identity in whitelabel

AROS AI becomes whatever the customer names her. Set `agent.name` in the whitelabel config and she adopts that identity fully — no residual AROS branding leaks through.

## Shre Plugin

Shre is an optional backend plugin providing identity, vault, and authentication services from the MIB007 ecosystem.

- **Enabled** (default): AROS delegates auth and vault operations to a Shre endpoint
- **Disabled**: AROS uses the built-in `ArosProvider` — fully standalone, no external dependencies

Toggle in `aros.config.json`:

```json
{
  "shre": {
    "enabled": false
  }
}
```

See [plugins/auth/README.md](./plugins/auth/README.md) for details.

## Marketplace

AROS connects to the MIB007 node marketplace to install and manage retail apps (Nodes). Nodes are modular capabilities — POS integration, inventory sync, analytics dashboards, etc.

```bash
# Sync available nodes from registry
pnpm marketplace:sync

# Check for core updates
pnpm update:core
```

## Deployment

```bash
# Local / self-hosted
docker compose -f deploy/docker-compose.yml up

# Production build
docker build -f deploy/Dockerfile -t aros-platform .
```

Kubernetes manifests are in `deploy/k8s/`.

## License

Proprietary. All rights reserved.
