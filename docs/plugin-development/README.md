# AROS Plugin & Connector Development Guide

AROS is an open, extensible platform. Anyone can build plugins and connectors that integrate with the AROS marketplace.

## What's the difference?

| Type | What it does | Example |
|------|-------------|---------|
| **Connector** | Pulls data from an external system into AROS | RapidRMS POS, Azure SQL, AWS RDS |
| **Plugin** | Adds new UI, agent behaviors, or platform features | Loyalty program, Custom dashboard, SMS alerts |

## Quick Start

### 1. Use the official template

```bash
npx @aros/create-plugin my-connector --type=connector
# or
npx @aros/create-plugin my-plugin --type=plugin
```

### 2. Minimum required files

```
my-connector/
├── manifest.json       # Plugin identity + marketplace metadata
├── index.ts            # Entry point (exports connector class)
├── types.ts            # TypeScript types
├── README.md           # User-facing documentation
└── package.json        # npm package
```

### 3. Implement the interface

- For connectors: implement `AROSConnector` interface (see [CONNECTOR_SPEC.md](./CONNECTOR_SPEC.md))
- For plugins: implement `AROSPlugin` interface (see [PLUGIN_SPEC.md](./PLUGIN_SPEC.md))

### 4. Test locally

```bash
aros dev --plugin ./my-connector
```

### 5. Publish

```bash
aros publish  # submits to the AROS marketplace registry
```

## Documentation

| File | Description |
|------|-------------|
| [CONNECTOR_SPEC.md](./CONNECTOR_SPEC.md) | Full connector interface specification |
| [PLUGIN_SPEC.md](./PLUGIN_SPEC.md) | Full plugin interface specification |
| [EXAMPLES.md](./EXAMPLES.md) | Worked examples (CSV, weather API, Azure SQL) |

## Available Connectors

The AROS platform ships with these built-in connectors:

| Connector | Category | Description |
|-----------|----------|-------------|
| Azure SQL | integration | Azure SQL Database via mssql |
| AWS RDS / Aurora | integration | MySQL/PostgreSQL on AWS RDS |
| RapidRMS POS | pos | RapidRMS retail management API |

## Registry

Connectors and plugins are published to:

```
https://registry.mib007.io/marketplace
```

Browse the marketplace from your AROS dashboard → Marketplace.
