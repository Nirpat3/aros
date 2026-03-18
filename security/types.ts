// ── Secure Input Types ──────────────────────────────────────────

export type SecureInputMarker = "*";  // * prefix = encrypt this value

export interface SecureInput {
  raw: string;          // original user input e.g. "*mypassword123"
  isSecure: boolean;    // true if starts with *
  displayValue: string; // what to show in UI: "••••••••••••" (never plain)
  encryptedValue?: string; // AES-256-GCM encrypted (stored/transmitted)
  // plainValue: NEVER stored, used in-memory only for immediate processing
}

export interface SecureField {
  name: string;
  value: string;
  isEncrypted: boolean;
  mask: string;         // display mask e.g. "••••••••"
}

export interface ProcessedMessage {
  displayMessage: string;
  secureFields: SecureField[];
}
