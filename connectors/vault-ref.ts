// ── Vault Reference Manager ─────────────────────────────────────
// Credentials are NEVER stored in plain text. This module handles
// encryption, storage, and retrieval via vault references.

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';

// ── Constants ───────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 32;
const KEY_LEN = 32;

// ── In-memory vault (swap for persistent store in production) ───

const vault = new Map<string, Buffer>();

// ── Key Derivation ──────────────────────────────────────────────

let _tenantSecret: string | undefined;

/** Set per-tenant secret for key derivation. Each tenant is isolated. */
export function setTenantSecret(secret: string): void {
  _tenantSecret = secret;
}

function deriveKey(salt: Buffer): Buffer {
  if (!_tenantSecret) throw new Error('Tenant secret not set — call setTenantSecret() first');
  return scryptSync(_tenantSecret, salt, KEY_LEN);
}

// ── Public API ──────────────────────────────────────────────────

/** Encrypt value, store in vault, return vaultRef (not the value). */
export async function storeCredential(key: string, value: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derivedKey = deriveKey(salt);
  const iv = randomBytes(IV_LEN);

  const cipher = createCipheriv(ALGO, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: salt + iv + tag + ciphertext
  const packed = Buffer.concat([salt, iv, tag, encrypted]);
  const ref = `vault:${key}:${randomBytes(8).toString('hex')}`;

  vault.set(ref, packed);
  return ref;
}

/** Decrypt and return value (in-memory only, never logged). */
export async function retrieveCredential(vaultRef: string): Promise<string> {
  const packed = vault.get(vaultRef);
  if (!packed) throw new Error(`Vault ref not found: ${vaultRef}`);

  const salt = packed.subarray(0, SALT_LEN);
  const iv = packed.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = packed.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = packed.subarray(SALT_LEN + IV_LEN + TAG_LEN);

  const derivedKey = deriveKey(salt);
  const decipher = createDecipheriv(ALGO, derivedKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Delete credential from vault. */
export async function deleteCredential(vaultRef: string): Promise<void> {
  vault.delete(vaultRef);
}

/** Rotate: delete old, store new value under same key prefix. */
export async function rotateCredential(vaultRef: string, newValue: string): Promise<string> {
  // Extract key name from ref
  const parts = vaultRef.split(':');
  const key = parts[1] ?? 'rotated';

  await deleteCredential(vaultRef);
  return storeCredential(key, newValue);
}
