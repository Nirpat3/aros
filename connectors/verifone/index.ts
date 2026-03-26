// ── Verifone Commander Connector — Public Exports ──────────────

export type { VerifoneCommanderConfig, VerifoneConnectionInfo, VerifoneMode } from "./types.js";
export {
  detectRelay,
  detectConnectionMode,
  testConnection,
  fetchReports,
  getRelayInstallInfo,
} from "./connector.js";
