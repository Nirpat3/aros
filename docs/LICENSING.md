# AROS License System

AROS requires a valid license key to start. This document covers key generation,
activation, and development mode.

## Overview

- **Algorithm:** ECDSA with P-256 curve (SHA-256 digest)
- **Key format:** Base64url-encoded JSON containing license payload + signature
- **Binding:** Each key is tied to a deployment fingerprint (hostname + MAC + optional domain)
- **Public key** is embedded in the AROS binary (safe to ship)
- **Private key** lives in NirLab's vault only — never in code or builds

## License Tiers

| Tier | Features |
|------|----------|
| `starter` | plugins |
| `professional` | plugins, multi-model, advanced-analytics |
| `enterprise` | All features (plugins, multi-model, private-registry, advanced-analytics, custom-connectors, priority-support, sso, audit-log) |

## Activating a License

### Option 1: Environment variable

```bash
export AROS_LICENSE_KEY="<your-license-key>"
```

### Option 2: License file

```bash
aros license activate <your-license-key>
# Saves to ~/.aros/license.key (mode 0600)
```

### Option 3: Manual file placement

```bash
mkdir -p ~/.aros
echo "<your-license-key>" > ~/.aros/license.key
chmod 600 ~/.aros/license.key
```

**Priority:** `AROS_LICENSE_KEY` env var > `~/.aros/license.key` file

## CLI Commands

```bash
# Show current license info
aros license info

# Validate the current license
aros license validate

# Activate a new license key
aros license activate <key>
```

## Development Mode

For local development, you can skip license validation:

```bash
export AROS_DEV_MODE=true
# Works only when NODE_ENV !== 'production'
```

Dev mode creates a synthetic license:
- Tier: `starter`
- Tenant: `dev-local`
- Expiry: 90 days from activation
- Features: `plugins` only

⚠️ **Dev mode is automatically disabled in production** (`NODE_ENV=production`)
regardless of `AROS_DEV_MODE` setting.

## Generating License Keys (NirLab Internal)

**Prerequisites:** Access to the NirLab private signing key (from vault).

### 1. Get the deployment fingerprint

The customer runs:
```bash
# The fingerprint is based on hostname + primary MAC + AROS_DOMAIN
node -e "
  const { getCurrentFingerprint } = require('./src/licensing/fingerprint');
  console.log(getCurrentFingerprint());
"
```

If `AROS_DOMAIN` is set, include it:
```bash
AROS_DOMAIN=shop.acme.com node -e "..."
```

### 2. Generate the key

```bash
NIRLAB_PRIVATE_KEY_PATH=/path/to/nirlab-private.pem \
tsx src/tools/generate-license.ts \
  --tenant acme-corp \
  --tier professional \
  --features plugins,multi-model,advanced-analytics \
  --fingerprint <customer-fingerprint-hex> \
  --expires 2027-01-01
```

For perpetual licenses, omit `--expires`.

### 3. Deliver the key securely

Send the base64url key string to the customer via a secure channel.
**Never transmit private keys.**

## Boot Behavior

At startup, AROS:

1. Checks for `AROS_DEV_MODE` (non-production only)
2. Reads license from env var or file
3. Decodes and verifies ECDSA signature
4. Checks expiry date
5. Validates fingerprint matches current environment
6. Logs: tier, tenant ID, expiry (never logs the key itself)
7. Exits with code 1 if any check fails

Boot guard adds < 50ms to startup time.

## Key Rotation

To rotate the signing keypair:

1. Generate new P-256 keypair
2. Store new private key in vault
3. Update `src/licensing/keys.ts` with new public key
4. Re-issue all active licenses with new keypair
5. Ship updated AROS binary

## Security Notes

- License keys are **never logged** in any output
- The private signing key is **never embedded** in shipped code
- Keys are stored with restrictive file permissions (0600)
- Fingerprint binding prevents key sharing between deployments
- ECDSA P-256 provides strong signature security with compact keys

## Testing

A test keypair is included in `src/licensing/keys.ts` for CI:

```bash
# Install vitest if not present
pnpm add -D vitest

# Run license tests
pnpm vitest run src/licensing/__tests__/
```

The test keypair is separate from production keys and safe to commit.
