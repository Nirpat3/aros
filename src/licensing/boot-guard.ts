const print = (m: unknown) => process.stdout.write((m == null ? '' : String(m)) + '\n');
const printErr = (...a: unknown[]) => process.stderr.write(a.map(String).join(' ') + '\n');
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
    print(
      `[AROS] Dev mode active — license check skipped (tier: ${license.tier}, tenant: ${license.tenantId})`,
    );
    return { license, devMode: true, elapsed };
  }

  // Resolve license key
  const key = resolveLicenseKey();

  if (!key) {
    printErr('\n' + '='.repeat(70));
    printErr('  AROS LICENSE ERROR');
    printErr('='.repeat(70));
    printErr('  AROS requires a valid license key.');
    printErr('');
    printErr('  Set AROS_LICENSE_KEY environment variable or place your');
    printErr('  license key in ~/.aros/license.key');
    printErr('');
    printErr('  Obtain a license at: [URL_PLACEHOLDER]');
    printErr('  Contact: [CONTACT_PLACEHOLDER]');
    printErr('='.repeat(70) + '\n');
    process.exit(1);
  }

  // Validate
  const result = validateLicenseKey(key);

  if (!result.valid || !result.license) {
    printErr('\n' + '='.repeat(70));
    printErr('  AROS LICENSE ERROR');
    printErr('='.repeat(70));
    printErr(`  ${result.error || 'Invalid license key'}`);
    printErr('');
    printErr('  AROS requires a valid license key.');
    printErr('  Obtain a license at: [URL_PLACEHOLDER]');
    printErr('  Contact: [CONTACT_PLACEHOLDER]');
    if (result.code) {
      printErr(`  Error code: ${result.code}`);
    }
    printErr('='.repeat(70) + '\n');
    process.exit(1);
  }

  const license = result.license;
  const elapsed = performance.now() - start;

  // Log license info (NEVER log the key itself)
  const expiryStr = license.expiresAt
    ? new Date(license.expiresAt).toLocaleDateString()
    : 'perpetual';

  print(
    `[AROS] License validated — tier: ${license.tier}, tenant: ${license.tenantId}, expires: ${expiryStr} (${elapsed.toFixed(1)}ms)`,
  );

  return { license, devMode: false, elapsed };
}
