import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { License, LicenseTier } from './types.js';

// ── Config shape ────────────────────────────────────────────────────────────

interface LicensingConfig {
  tier: LicenseTier;
  maxUsers: number;
  whitelabel: boolean;
  licenseKey: string;
  expiresAt: string | null;
}

interface ArosConfig {
  licensing: LicensingConfig;
  models: { metered: boolean };
}

// ── Tier defaults ───────────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<LicenseTier, Pick<License, 'maxUsers' | 'whitelabelEnabled'>> = {
  free: { maxUsers: 1, whitelabelEnabled: false },
  business: { maxUsers: Infinity, whitelabelEnabled: false },
  enterprise: { maxUsers: Infinity, whitelabelEnabled: false },
  oem: { maxUsers: Infinity, whitelabelEnabled: true },
};

// ── License key format ──────────────────────────────────────────────────────

const LICENSE_KEY_PATTERN = /^AROS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function validateLicenseKey(key: string): boolean {
  if (!key) return true; // empty = free tier, no key needed
  return LICENSE_KEY_PATTERN.test(key);
}

// ── Audit logging stub ──────────────────────────────────────────────────────

function auditLog(event: string, data: Record<string, unknown>): void {
  console.log(`[licensing:audit] ${event}`, JSON.stringify(data));
}

// ── Public API ──────────────────────────────────────────────────────────────

function loadConfig(): ArosConfig {
  const raw = readFileSync(join(process.cwd(), 'aros.config.json'), 'utf8');
  return JSON.parse(raw);
}

/**
 * Read the current license from aros.config.json.
 */
export function getLicense(): License {
  const config = loadConfig();
  const lc = config.licensing;
  const tier = lc.tier ?? 'free';
  const defaults = TIER_DEFAULTS[tier];

  if (!validateLicenseKey(lc.licenseKey)) {
    auditLog('invalid_key_format', { key: lc.licenseKey, tier });
  } else if (lc.licenseKey) {
    auditLog('key_validated', { tier });
  }

  return {
    tier,
    maxUsers: lc.maxUsers ?? defaults.maxUsers,
    whitelabelEnabled: lc.whitelabel ?? defaults.whitelabelEnabled,
    byomEnabled: true, // all tiers
    mib007Metered: config.models?.metered ?? true,
    licenseKey: lc.licenseKey ?? '',
    expiresAt: lc.expiresAt ?? null,
    tenantId: '', // resolved at runtime
  };
}

/**
 * Check whether adding another user would exceed the license limit.
 */
export function checkUserLimit(currentUsers: number): boolean {
  const license = getLicense();
  return currentUsers < license.maxUsers;
}

/**
 * Returns true if the current license permits whitelabel customization.
 */
export function isWhitelabelAllowed(): boolean {
  return getLicense().whitelabelEnabled;
}

/**
 * Throws if the current user count meets or exceeds the license limit.
 */
export function enforceUserLimit(currentUsers: number): void {
  const license = getLicense();
  if (currentUsers >= license.maxUsers) {
    auditLog('user_limit_exceeded', {
      currentUsers,
      maxUsers: license.maxUsers,
      tier: license.tier,
    });
    throw new Error(
      `User limit reached (${license.maxUsers}) for "${license.tier}" tier. ` +
        'Upgrade your license to add more users.',
    );
  }
}

// ── Boot guard ─────────────────────────────────────────────────────────────

/**
 * Enforce license validation at boot. Must be called before any AROS
 * services or plugins load. Throws if the license is expired or invalid.
 */
export function enforceBootGuard(): void {
  const license = getLicense();
  if (license.expiresAt) {
    const exp = new Date(license.expiresAt);
    if (exp.getTime() < Date.now()) {
      auditLog('boot_guard_expired', { tier: license.tier, expiresAt: license.expiresAt });
      throw new Error(
        `AROS license expired on ${license.expiresAt}. ` +
          'Renew your license to continue using the platform.',
      );
    }
  }
  if (license.tier !== 'free' && !license.licenseKey) {
    auditLog('boot_guard_missing_key', { tier: license.tier });
    throw new Error(
      `License key required for "${license.tier}" tier. ` +
        'Set licensing.licenseKey in aros.config.json.',
    );
  }
  auditLog('boot_guard_passed', { tier: license.tier });
}

/** Alias — some consumers reference the bootGuard name directly */
export const bootGuard = enforceBootGuard;

// ── Key generation ─────────────────────────────────────────────────────────

import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';

/**
 * Generate an ECDSA P-256 key pair for license signing.
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * Generate a formatted AROS license key.
 */
export function generateKey(tier: LicenseTier): string {
  const segment = () =>
    Array.from(
      { length: 4 },
      () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)],
    ).join('');
  return `AROS-${segment()}-${segment()}-${segment()}-${segment()}`;
}

/**
 * Sign a license payload with an ECDSA P-256 private key.
 */
export function signLicense(payload: string, privateKeyPem: string): string {
  const signer = createSign('SHA256');
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

/**
 * Verify a license signature with an ECDSA P-256 public key.
 */
export function verifyLicenseSignature(
  payload: string,
  signature: string,
  publicKeyPem: string,
): boolean {
  const verifier = createVerify('SHA256');
  verifier.update(payload);
  verifier.end();
  return verifier.verify(publicKeyPem, signature, 'base64');
}

export type { License, LicenseTier } from './types.js';
