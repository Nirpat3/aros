// ── Chat Guard ──────────────────────────────────────────────────
// Security layer for chat messages. Ensures no credentials leak
// into display, storage, or logs.

import type { SecureField } from './types.js';
import { maskValue } from './input-handler.js';

// ── Patterns ────────────────────────────────────────────────────

const SECURE_PATTERN = /\*\[([^\]]+)\]|\*(\S+)/g;

// ── Display Sanitizer ───────────────────────────────────────────

/** Replace any *value or *[value] with masked equivalent for display. */
export function sanitizeForDisplay(message: string): string {
  SECURE_PATTERN.lastIndex = 0;
  return message.replace(SECURE_PATTERN, (_, bracketed, single) => {
    const plain = bracketed ?? single;
    return maskValue(plain);
  });
}

// ── Storage Sanitizer ───────────────────────────────────────────

/** Replace plain secure values with vault refs before persisting. */
export function sanitizeForStorage(
  message: string,
  secureFields: SecureField[],
): string {
  let result = message;
  for (const field of secureFields) {
    if (field.isEncrypted && field.mask) {
      // Replace the masked display value with a vault reference placeholder
      result = result.replace(field.mask, `[encrypted:${field.name}]`);
    }
  }
  return result;
}

// ── Log Sanitizer ───────────────────────────────────────────────

/** Strip all secure fields from message for safe logging. */
export function sanitizeForLogs(message: string): string {
  SECURE_PATTERN.lastIndex = 0;
  return message.replace(SECURE_PATTERN, '[REDACTED]');
}
