/**
 * AROS License Key Schema
 *
 * Defines the structure for NirLab-issued license keys.
 * Keys are ECDSA-signed (P-256) and bound to a specific deployment.
 */

export type LicenseTier = 'starter' | 'professional' | 'enterprise';

export interface AROSLicense {
  /** Opaque signed token (base64url-encoded) */
  key: string;
  /** NirLab-issued tenant ID */
  tenantId: string;
  /** License tier */
  tier: LicenseTier;
  /** Enabled features, e.g. ['plugins', 'multi-model', 'private-registry'] */
  features: string[];
  /** ISO 8601 timestamp when the license was issued */
  issuedAt: string;
  /** ISO 8601 expiry timestamp, or null for perpetual licenses */
  expiresAt: string | null;
  /** Deployment fingerprint: domain, machineId, or combination */
  fingerprint: string;
  /** ECDSA P-256 signature (base64url) over the license payload */
  signature: string;
}

/** The payload that gets signed (everything except key and signature) */
export interface LicensePayload {
  tenantId: string;
  tier: LicenseTier;
  features: string[];
  issuedAt: string;
  expiresAt: string | null;
  fingerprint: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  license: AROSLicense | null;
  error?: string;
  code?: LicenseErrorCode;
}

export type LicenseErrorCode =
  | 'MISSING_LICENSE'
  | 'INVALID_FORMAT'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED'
  | 'FINGERPRINT_MISMATCH'
  | 'INVALID_TIER'
  | 'DEV_MODE';

/** Known feature flags */
export const KNOWN_FEATURES = [
  'plugins',
  'multi-model',
  'private-registry',
  'advanced-analytics',
  'custom-connectors',
  'priority-support',
  'sso',
  'audit-log',
] as const;

/** Default features per tier */
export const TIER_FEATURES: Record<LicenseTier, string[]> = {
  starter: ['plugins'],
  professional: ['plugins', 'multi-model', 'advanced-analytics'],
  enterprise: [
    'plugins',
    'multi-model',
    'private-registry',
    'advanced-analytics',
    'custom-connectors',
    'priority-support',
    'sso',
    'audit-log',
  ],
};
