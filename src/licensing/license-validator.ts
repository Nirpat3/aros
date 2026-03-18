/**
 * AROS License Validator
 *
 * Verifies ECDSA-signed license keys against the NirLab public key.
 * Checks signature, expiry, and deployment fingerprint binding.
 */

import { createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

import type {
  AROSLicense,
  LicensePayload,
  LicenseValidationResult,
  LicenseTier,
} from './license-schema.js';
import { NIRLAB_PUBLIC_KEY, TEST_PUBLIC_KEY } from './keys.js';
import { getCurrentFingerprint } from './fingerprint.js';

// Module-level state
let _currentLicense: AROSLicense | null = null;
let _publicKey: string = NIRLAB_PUBLIC_KEY;

/**
 * Override the public key used for validation (for testing).
 */
export function setPublicKey(key: string): void {
  _publicKey = key;
}

/**
 * Reset to production public key.
 */
export function resetPublicKey(): void {
  _publicKey = NIRLAB_PUBLIC_KEY;
}

/**
 * Use the test public key for validation.
 */
export function useTestKey(): void {
  _publicKey = TEST_PUBLIC_KEY;
}

/**
 * Decode a base64url-encoded license key into an AROSLicense object.
 */
export function decodeLicenseKey(key: string): AROSLicense | null {
  try {
    // base64url → base64 → JSON
    const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    // Basic shape validation
    if (
      typeof parsed.tenantId !== 'string' ||
      typeof parsed.tier !== 'string' ||
      !Array.isArray(parsed.features) ||
      typeof parsed.issuedAt !== 'string' ||
      typeof parsed.fingerprint !== 'string' ||
      typeof parsed.signature !== 'string'
    ) {
      return null;
    }

    const validTiers: LicenseTier[] = ['starter', 'professional', 'enterprise'];
    if (!validTiers.includes(parsed.tier)) {
      return null;
    }

    return {
      key,
      tenantId: parsed.tenantId,
      tier: parsed.tier,
      features: parsed.features,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt ?? null,
      fingerprint: parsed.fingerprint,
      signature: parsed.signature,
    };
  } catch {
    return null;
  }
}

/**
 * Verify the ECDSA signature on a license payload.
 */
function verifySignature(payload: LicensePayload, signature: string): boolean {
  try {
    const verifier = createVerify('SHA256');
    const canonicalPayload = JSON.stringify({
      tenantId: payload.tenantId,
      tier: payload.tier,
      features: payload.features,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      fingerprint: payload.fingerprint,
    });
    verifier.update(canonicalPayload);
    verifier.end();

    // Decode base64url signature
    const sigBase64 = signature.replace(/-/g, '+').replace(/_/g, '/');
    const sigPadded = sigBase64 + '='.repeat((4 - (sigBase64.length % 4)) % 4);
    const sigBuffer = Buffer.from(sigPadded, 'base64');

    return verifier.verify(_publicKey, sigBuffer);
  } catch {
    return false;
  }
}

/**
 * Validate a license key string.
 */
export function validateLicenseKey(key: string): LicenseValidationResult {
  // Check dev mode
  if (isDevMode()) {
    return {
      valid: true,
      license: createDevLicense(),
      code: 'DEV_MODE',
    };
  }

  const license = decodeLicenseKey(key);
  if (!license) {
    return {
      valid: false,
      license: null,
      error: 'Invalid license key format',
      code: 'INVALID_FORMAT',
    };
  }

  // Verify signature
  const payload: LicensePayload = {
    tenantId: license.tenantId,
    tier: license.tier,
    features: license.features,
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
    fingerprint: license.fingerprint,
  };

  if (!verifySignature(payload, license.signature)) {
    return {
      valid: false,
      license: null,
      error: 'Invalid license signature — key may be tampered or from an unknown issuer',
      code: 'INVALID_SIGNATURE',
    };
  }

  // Check expiry
  if (license.expiresAt) {
    const expiryDate = new Date(license.expiresAt);
    if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
      return {
        valid: false,
        license,
        error: `License expired on ${license.expiresAt}`,
        code: 'EXPIRED',
      };
    }
  }

  // Check fingerprint
  const currentFingerprint = getCurrentFingerprint();
  if (license.fingerprint !== currentFingerprint) {
    return {
      valid: false,
      license,
      error: 'License fingerprint does not match this environment',
      code: 'FINGERPRINT_MISMATCH',
    };
  }

  // All checks passed
  _currentLicense = license;
  return { valid: true, license };
}

/**
 * Validate a license from a file path.
 */
export function validateLicense(keyPath: string): LicenseValidationResult {
  try {
    const resolvedPath = resolve(keyPath);
    const key = readFileSync(resolvedPath, 'utf-8').trim();
    if (!key) {
      return {
        valid: false,
        license: null,
        error: 'License file is empty',
        code: 'MISSING_LICENSE',
      };
    }
    return validateLicenseKey(key);
  } catch (err) {
    return {
      valid: false,
      license: null,
      error: `Cannot read license file: ${(err as Error).message}`,
      code: 'MISSING_LICENSE',
    };
  }
}

/**
 * Get the currently validated license, or null if none.
 */
export function getLicenseInfo(): AROSLicense | null {
  return _currentLicense;
}

/**
 * Check whether the current license includes a specific feature.
 */
export function hasFeature(feature: string): boolean {
  if (!_currentLicense) return false;
  return _currentLicense.features.includes(feature);
}

/**
 * Clear the cached license (for testing).
 */
export function clearLicenseCache(): void {
  _currentLicense = null;
}

/**
 * Check if we're in dev mode (skip license validation).
 */
export function isDevMode(): boolean {
  return (
    process.env['AROS_DEV_MODE'] === 'true' &&
    process.env['NODE_ENV'] !== 'production'
  );
}

/**
 * Create a synthetic dev license for local development.
 */
export function createDevLicense(): AROSLicense {
  const now = new Date();
  const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

  return {
    key: '<dev-mode>',
    tenantId: 'dev-local',
    tier: 'starter',
    features: ['plugins'],
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    fingerprint: getCurrentFingerprint(),
    signature: '<dev-mode-no-signature>',
  };
}

/**
 * Resolve the license key from environment or default file path.
 * Priority: AROS_LICENSE_KEY env var > ~/.aros/license.key file
 */
export function resolveLicenseKey(): string | null {
  // 1. Check env var
  const envKey = process.env['AROS_LICENSE_KEY'];
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }

  // 2. Check default file
  const defaultPath = resolve(homedir(), '.aros', 'license.key');
  try {
    const fileKey = readFileSync(defaultPath, 'utf-8').trim();
    if (fileKey) return fileKey;
  } catch {
    // File doesn't exist — that's fine
  }

  return null;
}
