/**
 * AROS Licensing Module
 *
 * Public API for the license enforcement system.
 */

// Schema types
export type {
  AROSLicense,
  LicensePayload,
  LicenseValidationResult,
  LicenseTier,
  LicenseErrorCode,
} from './license-schema.js';
export { KNOWN_FEATURES, TIER_FEATURES } from './license-schema.js';

// Validator
export {
  validateLicense,
  validateLicenseKey,
  getLicenseInfo,
  hasFeature,
  isDevMode,
  decodeLicenseKey,
  resolveLicenseKey,
  createDevLicense,
} from './license-validator.js';

// Fingerprint
export { generateFingerprint, getCurrentFingerprint, getPrimaryMAC } from './fingerprint.js';

// Boot guard
export { enforceBootGuard } from './boot-guard.js';
export type { BootGuardResult } from './boot-guard.js';
