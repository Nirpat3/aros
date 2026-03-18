// ── Secure Input Handler ────────────────────────────────────────
// Detects * prefix, encrypts values, masks display text.
// Plain text is NEVER stored or logged after encryption.

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { SecureInput, SecureField, ProcessedMessage } from './types.js';

// ── Constants ───────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const MASK_CHAR = '\u2022'; // •

// Encryption key — in production, derive from tenant secret
let _encKey: Buffer | undefined;

/** Set encryption key (32 bytes). Call once at startup. */
export function setEncryptionKey(key: Buffer): void {
  _encKey = key;
}

function getKey(): Buffer {
  if (!_encKey) {
    // Fallback: derive from env or generate ephemeral (dev only)
    _encKey = randomBytes(32);
  }
  return _encKey;
}

// ── Patterns ────────────────────────────────────────────────────

// *word — single word secure value
// *[multi word value] — bracketed multi-word secure value
const SECURE_PATTERN = /\*\[([^\]]+)\]|\*(\S+)/g;

// ── Parse ───────────────────────────────────────────────────────

/** Parse a single input string. If it starts with *, treat as secure. */
export function parseSecureInput(raw: string): SecureInput {
  if (!raw.startsWith('*')) {
    return { raw, isSecure: false, displayValue: raw };
  }

  // Strip the * prefix
  let plain: string;
  if (raw.startsWith('*[') && raw.endsWith(']')) {
    plain = raw.slice(2, -1);
  } else {
    plain = raw.slice(1);
  }

  const encrypted = encryptValue(plain);
  const display = maskValue(plain);

  return {
    raw,
    isSecure: true,
    displayValue: display,
    encryptedValue: encrypted,
  };
}

// ── Encrypt / Decrypt ───────────────────────────────────────────

/** Encrypt plain text with AES-256-GCM. Returns base64 ciphertext. */
export function encryptValue(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: iv + tag + ciphertext → base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decrypt base64 ciphertext. In-memory only — never log the result. */
export function decryptValue(encrypted: string): string {
  const key = getKey();
  const packed = Buffer.from(encrypted, 'base64');

  const iv = packed.subarray(0, IV_LEN);
  const tag = packed.subarray(IV_LEN, IV_LEN + 16);
  const ciphertext = packed.subarray(IV_LEN + 16);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ── Mask ────────────────────────────────────────────────────────

/** Return masked string of same length. */
export function maskValue(value: string): string {
  return MASK_CHAR.repeat(value.length);
}

// ── Message Processing ──────────────────────────────────────────

/**
 * Scan a full message for *word and *[multi word] patterns.
 * Replace each secure segment with masked version for display.
 * Store encrypted versions separately.
 */
export function processMessage(message: string): ProcessedMessage {
  const secureFields: SecureField[] = [];
  let fieldIndex = 0;

  SECURE_PATTERN.lastIndex = 0;
  const displayMessage = message.replace(SECURE_PATTERN, (match, bracketed, single) => {
    const plain = bracketed ?? single;
    const encrypted = encryptValue(plain);
    const mask = maskValue(plain);

    secureFields.push({
      name: `secure_${fieldIndex++}`,
      value: encrypted,
      isEncrypted: true,
      mask,
    });

    return mask;
  });

  return { displayMessage, secureFields };
}
