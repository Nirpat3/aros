# aros-platform

AROS (Agentic Retail Operating System) — customer-facing platform monorepo. Provides
licensing, onboarding, connectors, skills, and the AROS web UI. AROS is a customer of
the Shre AI platform, not a core service.

## Quick Reference

- **Port**: 5457 (from ports.json)
- **Framework**: Turbo monorepo (pnpm), Node built-in HTTP for health server
- **Run**: `pnpm dev` (turbo) or `npx tsx src/server.ts` (health server only)
- **Build**: `pnpm build`

## Key Files

| Path | Purpose |
|------|---------|
| src/index.ts | Platform entry point — license boot-guard, public API exports |
| src/server.ts | Health server (/health, /readyz) on port 5457 |
| src/licensing/ | License enforcement, boot-guard, tier management |
| src/blocks/ | Block registry, executor, event helpers |
| src/tools/ | CLI tools (license generation) |
| aros-ai/ | AI agent layer (ADP server, shre-control socket) |
| apps/web/ | Vite-based web UI |
| packages/core/ | Core shared package |
| packages/pos-sdk/ | POS SDK package |
| connectors/ | Data connectors (Azure DB, etc.) |
| skills/ | AROS skill definitions |
| onboarding/ | Customer onboarding flow |
| marketplace/ | Marketplace registry sync |
| aros.config.json | Platform configuration |

## Architecture

AROS is a **monorepo** managed by Turbo with pnpm workspaces. The platform enforces
license validation at boot via `enforceBootGuard()` before any services or plugins load.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check with uptime and version |
| GET | /readyz | Readiness probe |

## Notes

- This is a git submodule in the shre-router monorepo
- Shre integration is optional (`shre.enabled` in aros.config.json)
- Whitelabel support via `whitelabel/` directory
