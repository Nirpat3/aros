// ── Verifone Commander Connector Types ──────────────────────────

export interface VerifoneCommanderConfig {
  /** Commander IP on LAN (e.g. 192.168.31.11) */
  commanderIp: string;
  /** Commander CGI username */
  username: string;
  /** Password vault reference — NEVER stored in plain text */
  // password: vaultRef only
  /** Sync interval in ms (default 300000 = 5min) */
  syncIntervalMs: number;
  /** Site display name */
  siteName: string;
}

export type VerifoneMode = 'direct' | 'relay';

/**
 * direct — AROS talks to Commander on same LAN (no edge relay needed)
 * relay  — AROS talks to local edge relay sidecar on localhost:18464
 */
export interface VerifoneConnectionInfo {
  mode: VerifoneMode;
  /** For direct: Commander IP. For relay: localhost:18464 */
  endpoint: string;
  /** Is Commander reachable right now? */
  reachable: boolean;
  /** Is edge relay running locally? */
  relayDetected: boolean;
  relayVersion?: string;
  relayStatus?: string;
}
