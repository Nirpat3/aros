/**
 * AROS License Key Generator — INTERNAL TOOL, NOT SHIPPED
 *
 * Used by NirLab to issue license keys for customers.
 * The private key is loaded from vault (env var or file), never embedded in code.
 *
 * Usage:
 *   NIRLAB_PRIVATE_KEY_PATH=/path/to/key.pem tsx src/tools/generate-license.ts \
 *     --tenant acme-corp \
 *     --tier professional \
 *     --features plugins,multi-model \
 *     --fingerprint <hex> \
 *     --expires 2027-01-01
 */

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { LicenseTier, LicensePayload } from '../licensing/license-schema.js';

interface GenerateLicenseOptions {
  tenantId: string;
  tier: LicenseTier;
  features: string[];
  fingerprint: string;
  expiresAt: string | null; // ISO date or null for perpetual
}

/**
 * Load the NirLab private key from vault.
 * Checks: NIRLAB_PRIVATE_KEY env var (PEM string), then NIRLAB_PRIVATE_KEY_PATH file.
 */
function loadPrivateKey(): string {
  const envKey = process.env['NIRLAB_PRIVATE_KEY'];
  if (envKey) return envKey;

  const keyPath = process.env['NIRLAB_PRIVATE_KEY_PATH'];
  if (keyPath) {
    return readFileSync(resolve(keyPath), 'utf-8');
  }

  throw new Error(
    'No private key found. Set NIRLAB_PRIVATE_KEY or NIRLAB_PRIVATE_KEY_PATH env var.\n' +
    'The private key lives in NirLab vault — never embed it in code.'
  );
}

/**
 * Generate a signed AROS license key.
 * Returns a base64url-encoded string containing the license + signature.
 */
export function generateLicenseKey(options: GenerateLicenseOptions): string {
  const privateKey = loadPrivateKey();

  const payload: LicensePayload = {
    tenantId: options.tenantId,
    tier: options.tier,
    features: options.features,
    issuedAt: new Date().toISOString(),
    expiresAt: options.expiresAt,
    fingerprint: options.fingerprint,
  };

  // Create canonical JSON for signing
  const canonicalPayload = JSON.stringify({
    tenantId: payload.tenantId,
    tier: payload.tier,
    features: payload.features,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    fingerprint: payload.fingerprint,
  });

  // Sign with ECDSA P-256
  const signer = createSign('SHA256');
  signer.update(canonicalPayload);
  signer.end();
  const signatureBuffer = signer.sign(privateKey);
  const signature = signatureBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Build the full license object (minus 'key' which is the outer envelope)
  const licenseData = {
    tenantId: payload.tenantId,
    tier: payload.tier,
    features: payload.features,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    fingerprint: payload.fingerprint,
    signature,
  };

  // Encode as base64url
  const json = JSON.stringify(licenseData);
  const key = Buffer.from(json)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return key;
}

// ── CLI entry point ──────────────────────────────────────────────────────

function parseArgs(argv: string[]): GenerateLicenseOptions {
  const args = argv.slice(2);
  let tenantId = '';
  let tier: LicenseTier = 'starter';
  let features: string[] = [];
  let fingerprint = '';
  let expiresAt: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tenant':
        tenantId = args[++i];
        break;
      case '--tier':
        tier = args[++i] as LicenseTier;
        break;
      case '--features':
        features = args[++i].split(',');
        break;
      case '--fingerprint':
        fingerprint = args[++i];
        break;
      case '--expires':
        expiresAt = args[++i];
        break;
    }
  }

  if (!tenantId || !fingerprint) {
    console.error('Usage: generate-license --tenant <id> --fingerprint <hex> [--tier starter|professional|enterprise] [--features a,b,c] [--expires YYYY-MM-DD]');
    process.exit(1);
  }

  return { tenantId, tier, features, fingerprint, expiresAt };
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith('generate-license.ts') ||
               process.argv[1]?.endsWith('generate-license.js');

if (isMain) {
  const options = parseArgs(process.argv);
  const key = generateLicenseKey(options);

  console.log('\nGenerated AROS License Key:');
  console.log('-'.repeat(60));
  console.log(key);
  console.log('-'.repeat(60));
  console.log(`\nTenant:      ${options.tenantId}`);
  console.log(`Tier:        ${options.tier}`);
  console.log(`Features:    ${options.features.join(', ') || '(default)'}`);
  console.log(`Fingerprint: ${options.fingerprint}`);
  console.log(`Expires:     ${options.expiresAt || 'Never (perpetual)'}\n`);
}
