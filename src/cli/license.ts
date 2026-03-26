const print = (m: unknown) => process.stdout.write((m == null ? '' : String(m)) + '\n');
const printErr = (...a: unknown[]) => process.stderr.write(a.map(String).join(' ') + '\n');
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
  print('\n  AROS License Information');
  print('  ' + '-'.repeat(40));
  print(`  Tenant ID:   ${license.tenantId}`);
  print(`  Tier:        ${license.tier}`);
  print(`  Features:    ${license.features.join(', ') || '(none)'}`);
  print(`  Issued:      ${license.issuedAt}`);
  print(
    `  Expires:     ${license.expiresAt || 'Never (perpetual)'}`
  );
  print(`  Fingerprint: ${license.fingerprint}`);
  if (devMode) {
    print(`  Mode:        ⚠ DEV MODE (not for production)`);
  }
  print('');
}

export function licenseInfo(): void {
  if (isDevMode()) {
    const devLicense = createDevLicense();
    printLicenseInfo(devLicense, true);
    return;
  }

  const key = resolveLicenseKey();
  if (!key) {
    printErr('\n  No license key found.');
    printErr('  Run: aros license activate <key>\n');
    process.exit(1);
  }

  const license = decodeLicenseKey(key);
  if (!license) {
    printErr('\n  License key has invalid format.\n');
    process.exit(1);
  }

  printLicenseInfo(license);
}

export function licenseValidate(): void {
  if (isDevMode()) {
    print('\n  ✓ Dev mode active — license validation skipped.\n');
    return;
  }

  const key = resolveLicenseKey();
  if (!key) {
    printErr('\n  ✗ No license key found.');
    printErr('  Run: aros license activate <key>\n');
    process.exit(1);
  }

  const result = validateLicenseKey(key);

  if (result.valid && result.license) {
    print('\n  ✓ License is valid.');
    printLicenseInfo(result.license);
  } else {
    printErr(`\n  ✗ License validation failed: ${result.error}`);
    if (result.code) {
      printErr(`    Error code: ${result.code}`);
    }
    printErr('');
    process.exit(1);
  }
}

export function licenseActivate(key: string): void {
  if (!key || !key.trim()) {
    printErr('\n  Usage: aros license activate <key>\n');
    process.exit(1);
  }

  const trimmedKey = key.trim();

  // Verify the key is at least decodeable
  const license = decodeLicenseKey(trimmedKey);
  if (!license) {
    printErr('\n  ✗ Invalid license key format.\n');
    process.exit(1);
  }

  // Ensure directory exists
  if (!existsSync(LICENSE_DIR)) {
    mkdirSync(LICENSE_DIR, { recursive: true });
  }

  // Write key to file (600 permissions)
  writeFileSync(LICENSE_FILE, trimmedKey + '\n', { mode: 0o600 });

  print('\n  ✓ License key saved to ~/.aros/license.key');
  print(`    Tenant: ${license.tenantId}`);
  print(`    Tier:   ${license.tier}\n`);
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
      print('\n  AROS License Management');
      print('  ' + '-'.repeat(30));
      print('  aros license info       — show license details');
      print('  aros license validate   — validate current license');
      print('  aros license activate <key> — save license key\n');
      break;
  }
}
