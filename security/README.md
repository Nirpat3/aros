# Secure Input System

AROS uses `*` as the universal secure prefix.

## Usage

In any text field or chat message:
```
*password123       → single word encrypted, displayed as ••••••••••••
*[my secret 123]   → phrase encrypted, displayed as •••••••••••••••
*[Azure@P@ssw0rd]  → spaces/special chars supported with brackets
```

In dedicated password fields:
- Always masked (no `*` needed)
- 🔒 icon confirms encryption active

## What Happens

1. You type `*mypassword`
2. AROS immediately encrypts the value (AES-256-GCM)
3. Display shows: `••••••••••`
4. Encrypted value stored in vault or transmitted encrypted
5. Plain text is never stored, never logged, never displayed again

## Why `*`?

- Natural, memorable ("star = secret")
- Works in chat AND form fields
- Consistent across entire platform
- No separate "secure mode" to remember

## Components

### `input-handler.ts`
Core processing: parse, encrypt, decrypt, mask, and process full messages.

### `secure-field.tsx`
React component — controlled input that auto-masks when `*` is typed:
- Normal text input by default
- `*` as first char → switches to password-type masking
- Shows 🔒 icon when secure mode active
- `alwaysSecure` prop for dedicated password fields
- Never emits plain text after `*` prefix

### `chat-guard.ts`
Security layer for chat messages:
- `sanitizeForDisplay()` — masks `*values` for UI rendering
- `sanitizeForStorage()` — replaces plain values with vault refs before persisting
- `sanitizeForLogs()` — strips all secure fields from log entries

## Integration

```typescript
import { processMessage, sanitizeForLogs } from './security/index.js';

const msg = 'Connect to server with *[MyP@ssw0rd!] please';
const { displayMessage, secureFields } = processMessage(msg);
// displayMessage: "Connect to server with •••••••••••• please"
// secureFields: [{ name: 'secure_0', value: '<encrypted>', isEncrypted: true }]

console.log(sanitizeForLogs(msg));
// "Connect to server with [REDACTED] please"
```
