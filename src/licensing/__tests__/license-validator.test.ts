/**
 * AROS License Validator Tests
 *
 * Uses the test keypair (safe to commit) to verify all validation paths.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSign } from 'node:crypto';

import {
  validateLicenseKey,
  decodeLicenseKey,
  getLicenseInfo,
  hasFeature,
  clearLicenseCache,
  useTestKey,
  resetPublicKey,
  isDevMode,
  createDevLicense,
} from '../license-validator.js';
import { TEST_PRIVATE_KEY } from '../keys.js';
import { getCurrentFingerprint } from '../fingerprint.js';
import type { LicensePayload, LicenseTier } from '../license-schema.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function createTestLicense(overrides: Partial<LicensePayload & { tier: LicenseTier }> = {}): string {
  const payload: LicensePayload = {
    tenantId: overrides.tenantId ?? 'test-tenant',
    tier: overrides.tier ?? 'professional',
    features: overrides.features ?? ['plugins', 'multi-model'],
    issuedAt: overrides.issuedAt ?? new Date().toISOString(),
    expiresAt: overrides.expiresAt !== undefined ? overrides.expiresAt : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    fingerprint: overrides.fingerprint ?? getCurrentFingerprint(),
  };

  const canonicalPayload = JSON.stringify({
    tenantId: payload.tenantId,
    tier: payload.tier,
    features: payload.features,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    fingerprint: payload.fingerprint,
  });

  const signer = createSign('SHA256');
  signer.update(canonicalPayload);
  signer.end();
  const signatureBuffer = signer.sign(TEST_PRIVATE_KEY);
  const signature = signatureBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const licenseData = { ...payload, signature };
  const json = JSON.stringify(licenseData);
  return Buffer.from(json)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('AROS License Validator', () => {
  beforeEach(() => {
    useTestKey();
    clearLicenseCache();
    delete process.env['AROS_DEV_MODE'];
  });

  afterEach(() => {
    resetPublicKey();
    clearLicenseCache();
    delete process.env['AROS_DEV_MODE'];
  });

  describe('decodeLicenseKey', () => {
    it('should decode a valid base64url license key', () => {
      const key = createTestLicense();
      const license = decodeLicenseKey(key);
      expect(license).not.toBeNull();
      expect(license!.tenantId).toBe('test-tenant');
      expect(license!.tier).toBe('professional');
    });

    it('should return null for garbage input', () => {
      expect(decodeLicenseKey('not-a-valid-key')).toBeNull();
      expect(decodeLicenseKey('')).toBeNull();
      expect(decodeLicenseKey('!!!')).toBeNull();
    });

    it('should return null for valid base64 but invalid schema', () => {
      const bad = Buffer.from(JSON.stringify({ foo: 'bar' }))
        .toString('base64')
        .replace(/=/g, '');
      expect(decodeLicenseKey(bad)).toBeNull();
    });
  });

  describe('validateLicenseKey', () => {
    it('should validate a correctly signed license', () => {
      const key = createTestLicense();
      const result = validateLicenseKey(key);
      expect(result.valid).toBe(true);
      expect(result.license).not.toBeNull();
      expect(result.license!.tenantId).toBe('test-tenant');
      expect(result.license!.tier).toBe('professional');
    });

    it('should reject an expired license', () => {
      const key = createTestLicense({
        expiresAt: '2020-01-01T00:00:00.000Z',
      });
      const result = validateLicenseKey(key);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('EXPIRED');
    });

    it('should accept a perpetual license (null expiresAt)', () => {
      const key = createTestLicense({ expiresAt: null });
      const result = validateLicenseKey(key);
      expect(result.valid).toBe(true);
      expect(result.license!.expiresAt).toBeNull();
    });

    it('should reject a license with wrong fingerprint', () => {
      const key = createTestLicense({
        fingerprint: 'wrong-fingerprint-value-here',
      });
      const result = validateLicenseKey(key);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('FINGERPRINT_MISMATCH');
    });

    it('should reject a tampered license (modified payload)', () => {
      const key = createTestLicense();
      const license = decodeLicenseKey(key)!;

      // Tamper with the tenant ID
      const tampered = {
        ...license,
        tenantId: 'hacked-tenant',
      };
      delete (tampered as any).key;

      const tamperedJson = JSON.stringify(tampered);
      const tamperedKey = Buffer.from(tamperedJson)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = validateLicenseKey(tamperedKey);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject an invalid format key', () => {
      const result = validateLicenseKey('totally-bogus-key');
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_FORMAT');
    });
  });

  describe('getLicenseInfo and hasFeature', () => {
    it('should return null before validation', () => {
      expect(getLicenseInfo()).toBeNull();
    });

    it('should return license after successful validation', () => {
      const key = createTestLicense({
        features: ['plugins', 'multi-model'],
      });
      validateLicenseKey(key);
      const info = getLicenseInfo();
      expect(info).not.toBeNull();
      expect(info!.features).toContain('plugins');
    });

    it('should check features correctly', () => {
      const key = createTestLicense({
        features: ['plugins', 'multi-model'],
      });
      validateLicenseKey(key);
      expect(hasFeature('plugins')).toBe(true);
      expect(hasFeature('multi-model')).toBe(true);
      expect(hasFeature('private-registry')).toBe(false);
    });

    it('should return false for hasFeature with no license', () => {
      expect(hasFeature('plugins')).toBe(false);
    });
  });

  describe('dev mode', () => {
    it('should skip validation in dev mode', () => {
      process.env['AROS_DEV_MODE'] = 'true';
      process.env['NODE_ENV'] = 'development';

      const result = validateLicenseKey('doesnt-matter');
      expect(result.valid).toBe(true);
      expect(result.code).toBe('DEV_MODE');
      expect(result.license!.tenantId).toBe('dev-local');
      expect(result.license!.tier).toBe('starter');

      delete process.env['NODE_ENV'];
    });

    it('should NOT skip validation in production even with dev flag', () => {
      process.env['AROS_DEV_MODE'] = 'true';
      process.env['NODE_ENV'] = 'production';

      const result = validateLicenseKey('doesnt-matter');
      expect(result.valid).toBe(false);

      delete process.env['NODE_ENV'];
    });

    it('should create a dev license with 90-day expiry', () => {
      const license = createDevLicense();
      expect(license.tenantId).toBe('dev-local');
      expect(license.tier).toBe('starter');

      const expiry = new Date(license.expiresAt!);
      const now = new Date();
      const daysDiff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(89);
      expect(daysDiff).toBeLessThan(91);
    });
  });

  describe('tier validation', () => {
    it('should accept all valid tiers', () => {
      for (const tier of ['starter', 'professional', 'enterprise'] as const) {
        const key = createTestLicense({ tier });
        const result = validateLicenseKey(key);
        expect(result.valid).toBe(true);
        expect(result.license!.tier).toBe(tier);
        clearLicenseCache();
      }
    });
  });
});
