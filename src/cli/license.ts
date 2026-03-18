/**
 * AROS License CLI
 *
 * Commands:
 *   aros license info      — show current license details
 *   aros license validate   — validate current license and print result
 *   aros license activate <key> — save key to ~/.aros/license.key
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

import {
  validateLicenseKey,
  resolveLicenseKey,
  decodeLicenseKey,
  isDevMode,
  createDevLicense,
} from '../licensing/license-validator.js';
import type { AROSLicense } from '../licensing/license-schema.js';

const LICENSE_DIR = resolve(homedir(), '.aros');
const LICENSE_FILE = resolve(LICENSE_DIR, 'license.key');

function printLicenseInfo(license: AROSLicense, devMode = false): void {
  console.log('\n  AROS License Information');
  console.log('  ' + '-'.repeat(40));
  console.log(`  Tenant ID:   ${license.tenantId}`);
  console.log(`  Tier:        ${license.tier}`);
  console.log(`  Features:    ${license.features.join(', ') || '(none)'}`);
  console.log(`  Issued:      ${license.issuedAt}`);
  console.log(
    `  Expires:     ${license.expiresAt || 'Never (perpetual)'}`
  );
  console.log(`  Fingerprint: ${license.fingerprint}`);
  if (devMode) {
    console.log(`  Mode:        ⚠ DEV MODE (not for production)`);
  }
  console.log('');
}

export function licenseInfo(): void {
  if (isDevMode()) {
    const devLicense = createDevLicense();
    printLicenseInfo(devLicense, true);
    return;
  }

  const key = resolveLicenseKey();
  if (!key) {
    console.error('\n  No license key found.');
    console.error('  Run: aros license activate <key>\n');
    process.exit(1);
  }

  const license = decodeLicenseKey(key);
  if (!license) {
    console.error('\n  License key has invalid format.\n');
    process.exit(1);
  }

  printLicenseInfo(license);
}

export function licenseValidate(): void {
  if (isDevMode()) {
    console.log('\n  ✓ Dev mode active — license validation skipped.\n');
    return;
  }

  const key = resolveLicenseKey();
  if (!key) {
    console.error('\n  ✗ No license key found.');
    console.error('  Run: aros license activate <key>\n');
    process.exit(1);
  }

  const result = validateLicenseKey(key);

  if (result.valid && result.license) {
    console.log('\n  ✓ License is valid.');
    printLicenseInfo(result.license);
  } else {
    console.error(`\n  ✗ License validation failed: ${result.error}`);
    if (result.code) {
      console.error(`    Error code: ${result.code}`);
    }
    console.error('');
    process.exit(1);
  }
}

export function licenseActivate(key: string): void {
  if (!key || !key.trim()) {
    console.error('\n  Usage: aros license activate <key>\n');
    process.exit(1);
  }

  const trimmedKey = key.trim();

  // Verify the key is at least decodeable
  const license = decodeLicenseKey(trimmedKey);
  if (!license) {
    console.error('\n  ✗ Invalid license key format.\n');
    process.exit(1);
  }

  // Ensure directory exists
  if (!existsSync(LICENSE_DIR)) {
    mkdirSync(LICENSE_DIR, { recursive: true });
  }

  // Write key to file (600 permissions)
  writeFileSync(LICENSE_FILE, trimmedKey + '\n', { mode: 0o600 });

  console.log('\n  ✓ License key saved to ~/.aros/license.key');
  console.log(`    Tenant: ${license.tenantId}`);
  console.log(`    Tier:   ${license.tier}\n`);
}

/**
 * CLI entry point for `aros license <subcommand>`.
 */
export function handleLicenseCLI(args: string[]): void {
  const subcommand = args[0];

  switch (subcommand) {
    case 'info':
      licenseInfo();
      break;
    case 'validate':
      licenseValidate();
      break;
    case 'activate':
      licenseActivate(args[1]);
      break;
    default:
      console.log('\n  AROS License Management');
      console.log('  ' + '-'.repeat(30));
      console.log('  aros license info       — show license details');
      console.log('  aros license validate   — validate current license');
      console.log('  aros license activate <key> — save license key\n');
      break;
  }
}
