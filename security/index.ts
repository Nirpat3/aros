// ── Security ────────────────────────────────────────────────────

export type { SecureInput, SecureField, ProcessedMessage } from './types.js';

export {
  parseSecureInput,
  encryptValue,
  decryptValue,
  maskValue,
  processMessage,
  setEncryptionKey,
} from './input-handler.js';

export { SecureField as SecureFieldComponent } from './secure-field.js';

export { sanitizeForDisplay, sanitizeForStorage, sanitizeForLogs } from './chat-guard.js';
