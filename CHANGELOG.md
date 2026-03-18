# AROS Platform Changelog

All notable changes to AROS Platform are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]
### In Progress
- Shre brain sync integration
- BYOM model selector
- Licensing module

## [0.1.0] — 2026-03-18
### Added
- Initial AROS Platform scaffold
- Whitelabel system (theme, logo, agent name, full UI customization)
- AROS AI agent (platform driver — soul, tools, LLM provider)
- Shre auth plugin (ShreProvider + ArosProvider fallback)
- Marketplace registry (fetch + install nodes from MIB007)
- Updater (core + UI update channels, policy engine, history tracking)
- Versioning system (semver utilities, manifest parsing, two-channel updates)
- Licensing module (free/business/OEM tiers, user limits, BYOM)
- Agent Data Protocol (ADP) — Shre-facing brain API
- Shre control socket (WebSocket directives + events)
- Deploy configs (Docker Compose, Dockerfile, Kubernetes)
- Core: thin wrapper around @mib007/core (version-pinned)
