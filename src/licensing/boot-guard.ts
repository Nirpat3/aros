/**
 * AROS Boot Guard
 *
 * Must be called at the very top of the AROS platform boot sequence,
 * before any services, plugins, or connectors load.
 *
 * If no valid license is found, the process exits with code 1.
 * Target: < 50ms added to startup time.
 */

import {
  validateLicenseKey,
  resolveLicenseKey,
  isDevMode,
  createDevLicense,
} from './license-validator.js';
import type { AROSLicense } from './license-schema.js';

export interface BootGuardResult {
  license: AROSLicense;
  devMode: boolean;
  elapsed: number; // ms
}

/**
 * Enforce license validation at boot.
 * Exits process if license is invalid or missing.
 */
export function enforceBootGuard(): BootGuardResult {
  const start = performance.now();

  // Dev mode bypass
  if (isDevMode()) {
    const license = createDevLicense();
    const elapsed = performance.now() - start;
    console.log(
      `[AROS] Dev mode active — license check skipped (tier: ${license.tier}, tenant: ${license.tenantId})`
    );
    return { license, devMode: true, elapsed };
  }

  // Resolve license key
  const key = resolveLicenseKey();

  if (!key) {
    console.error('\n' + '='.repeat(70));
    console.error('  AROS LICENSE ERROR');
    console.error('='.repeat(70));
    console.error('  No license key found.');
    console.error('');
    console.error('  Set AROS_LICENSE_KEY environment variable or place your');
    console.error('  license key in ~/.aros/license.key');
    console.error('');
    console.error('  Obtain a license at: https://nirlab.ai/aros/license');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  // Validate
  const result = validateLicenseKey(key);

  if (!result.valid || !result.license) {
    console.error('\n' + '='.repeat(70));
    console.error('  AROS LICENSE ERROR');
    console.error('='.repeat(70));
    console.error(`  ${result.error || 'Invalid license key'}`);
    console.error('');
    console.error('  AROS requires a valid license key.');
    console.error('  Obtain one at: https://nirlab.ai/aros/license');
    if (result.code) {
      console.error(`  Error code: ${result.code}`);
    }
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  const license = result.license;
  const elapsed = performance.now() - start;

  // Log license info (NEVER log the key itself)
  const expiryStr = license.expiresAt
    ? new Date(license.expiresAt).toLocaleDateString()
    : 'perpetual';

  console.log(
    `[AROS] License validated — tier: ${license.tier}, tenant: ${license.tenantId}, expires: ${expiryStr} (${elapsed.toFixed(1)}ms)`
  );

  return { license, devMode: false, elapsed };
}
