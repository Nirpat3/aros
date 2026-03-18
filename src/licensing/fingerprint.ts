/**
 * Machine fingerprint generation for license binding.
 *
 * Fingerprint = SHA-256(hostname + primaryMAC + domain?)
 * This ties a license to a specific deployment environment.
 */

import { createHash } from 'node:crypto';
import { hostname, networkInterfaces } from 'node:os';

/**
 * Get the primary (non-internal) MAC address.
 * Returns the first non-internal, non-loopback MAC found.
 */
export function getPrimaryMAC(): string {
  const interfaces = networkInterfaces();
  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        return addr.mac;
      }
    }
  }
  return '00:00:00:00:00:00';
}

/**
 * Generate a machine fingerprint for license validation.
 * Combines hostname + MAC address + optional domain.
 */
export function generateFingerprint(domain?: string): string {
  const host = hostname();
  const mac = getPrimaryMAC();
  const parts = [host, mac];

  if (domain) {
    parts.push(domain);
  }

  const hash = createHash('sha256');
  hash.update(parts.join(':'));
  return hash.digest('hex');
}

/**
 * Get the current environment fingerprint using AROS_DOMAIN env var.
 */
export function getCurrentFingerprint(): string {
  const domain = process.env['AROS_DOMAIN'];
  return generateFingerprint(domain);
}
