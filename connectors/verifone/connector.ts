// ── Verifone Commander Connector ─────────────────────────────────
//
// Two operating modes:
//   1. DIRECT — AROS on same LAN as Commander → talk CGI directly
//   2. RELAY  — Edge relay running on localhost → proxy through relay API
//
// Auto-detection: check localhost:18464 first (relay), then try Commander IP.

import type { ConnectorTestResult } from "../types.js";
import type { VerifoneCommanderConfig, VerifoneConnectionInfo, VerifoneMode } from "./types.js";

const RELAY_URL = "http://localhost:18464";
const CGI_TIMEOUT_MS = 10_000;

// ── Auto-detection ──────────────────────────────────────────────

/** Detect if edge relay is running locally. */
export async function detectRelay(): Promise<{
  detected: boolean;
  version?: string;
  status?: string;
}> {
  try {
    const res = await fetch(`${RELAY_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { detected: false };
    const data = await res.json();
    return {
      detected: true,
      version: data.version || "unknown",
      status: data.status || "unknown",
    };
  } catch {
    return { detected: false };
  }
}

/** Test direct Commander connectivity on LAN. */
async function testCommanderDirect(
  ip: string,
  username: string,
  password: string,
): Promise<{ reachable: boolean; cookie?: string; error?: string }> {
  try {
    const url = `https://${ip}/cgi-bin/CGILink?cmd=validate&user=${encodeURIComponent(username)}&passwd=${encodeURIComponent(password)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(CGI_TIMEOUT_MS) });
    if (!res.ok) return { reachable: false, error: `HTTP ${res.status}` };

    const body = await res.text();
    const match = body.match(/cookie[=:]?\s*["']?([A-Za-z0-9_-]+)/i);
    const setCookie = res.headers.get("set-cookie");
    const cookie =
      match?.[1] ||
      setCookie?.match(/cookie=([^;]+)/i)?.[1] ||
      setCookie?.match(/(\w{8,})/)?.[1];

    return cookie ? { reachable: true, cookie } : { reachable: false, error: "No cookie returned" };
  } catch (err: any) {
    return { reachable: false, error: err.message };
  }
}

// ── Connection Info ─────────────────────────────────────────────

/**
 * Determine the best connection mode for Verifone Commander.
 * Priority: relay (if running) > direct (if reachable)
 */
export async function detectConnectionMode(
  config: VerifoneCommanderConfig,
  password: string,
): Promise<VerifoneConnectionInfo> {
  // 1. Check for local edge relay
  const relay = await detectRelay();
  if (relay.detected) {
    return {
      mode: "relay",
      endpoint: RELAY_URL,
      reachable: true,
      relayDetected: true,
      relayVersion: relay.version,
      relayStatus: relay.status,
    };
  }

  // 2. Try direct Commander access
  const direct = await testCommanderDirect(config.commanderIp, config.username, password);
  return {
    mode: "direct",
    endpoint: `https://${config.commanderIp}`,
    reachable: direct.reachable,
    relayDetected: false,
  };
}

// ── Connector Interface ─────────────────────────────────────────

/** Test Verifone connection (for connector manager). */
export async function testConnection(
  config: VerifoneCommanderConfig,
  passwordVaultRef: string,
): Promise<ConnectorTestResult> {
  const start = Date.now();

  // Try relay first
  const relay = await detectRelay();
  if (relay.detected) {
    try {
      const res = await fetch(`${RELAY_URL}/api/status`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return {
        success: true,
        latencyMs: Date.now() - start,
        testedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Relay detected but status failed: ${err.message}`,
        testedAt: new Date().toISOString(),
      };
    }
  }

  // Direct test — attempt Commander CGI login with vault-resolved password
  try {
    const password = passwordVaultRef; // Connector manager resolves vaultRef before calling
    if (!password) {
      return {
        success: false,
        error: "No edge relay detected and no password provided for direct test",
        latencyMs: Date.now() - start,
        testedAt: new Date().toISOString(),
      };
    }
    const cgiUrl = `https://${config.commanderIp}/cgi-bin/CGILink?cmd=validate&user=${encodeURIComponent(config.username)}&passwd=${encodeURIComponent(password)}`;
    const res = await fetch(cgiUrl, {
      signal: AbortSignal.timeout(8_000),
      // @ts-expect-error -- Node fetch: skip self-signed cert validation for LAN device
      rejectUnauthorized: false,
    });
    const text = await res.text();
    const loginOk = text.includes("validated") || text.includes("cookie=");
    return {
      success: loginOk,
      error: loginOk ? undefined : "Commander login failed — check username/password",
      latencyMs: Date.now() - start,
      testedAt: new Date().toISOString(),
      mode: "direct",
      hint: "Install Edge Relay for cloud sync: https://support.nirtek.net/edge-relay",
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Commander unreachable at ${config.commanderIp}: ${err.message}`,
      latencyMs: Date.now() - start,
      testedAt: new Date().toISOString(),
    };
  }
}

// ── Data Access (dual-mode) ─────────────────────────────────────

/**
 * Fetch reports — routes through relay if available, otherwise direct.
 */
export async function fetchReports(
  mode: VerifoneMode,
  config: VerifoneCommanderConfig,
  password: string,
): Promise<any[]> {
  if (mode === "relay") {
    return fetchViaRelay(config);
  }
  return fetchDirect(config, password);
}

async function fetchViaRelay(config: VerifoneCommanderConfig): Promise<any[]> {
  const res = await fetch(`${RELAY_URL}/api/status`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Relay status failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.reports || [];
}

async function fetchDirect(config: VerifoneCommanderConfig, password: string): Promise<any[]> {
  // Login
  const loginUrl = `https://${config.commanderIp}/cgi-bin/CGILink?cmd=validate&user=${encodeURIComponent(config.username)}&passwd=${encodeURIComponent(password)}`;
  const loginRes = await fetch(loginUrl, { signal: AbortSignal.timeout(CGI_TIMEOUT_MS) });
  if (!loginRes.ok) throw new Error(`Commander login failed: HTTP ${loginRes.status}`);

  const body = await loginRes.text();
  const match = body.match(/cookie[=:]?\s*["']?([A-Za-z0-9_-]+)/i);
  const setCookie = loginRes.headers.get("set-cookie");
  const cookie =
    match?.[1] || setCookie?.match(/cookie=([^;]+)/i)?.[1] || setCookie?.match(/(\w{8,})/)?.[1];

  if (!cookie) throw new Error("No cookie from Commander login");

  // Fetch summary report
  const reportUrl = `https://${config.commanderIp}/cgi-bin/CGILink?cmd=vrubyrept&reptname=summary&period=2&cookie=${cookie}`;
  const reportRes = await fetch(reportUrl, { signal: AbortSignal.timeout(CGI_TIMEOUT_MS) });
  if (!reportRes.ok) throw new Error(`Report fetch failed: HTTP ${reportRes.status}`);

  const html = await reportRes.text();
  // Basic table extraction (full parsing in edge-relay/pos-sdk)
  return [{ raw: html, fetchedAt: new Date().toISOString() }];
}

// ── Relay Sidecar Management ────────────────────────────────────

/**
 * Check if edge relay needs to be installed.
 * Returns download URL for the user's platform if relay not detected.
 */
export async function getRelayInstallInfo(): Promise<{
  installed: boolean;
  downloadUrl?: string;
  platform: string;
}> {
  const relay = await detectRelay();
  if (relay.detected) return { installed: true, platform: process.platform };

  const platformMap: Record<string, string> = {
    win32: "https://download.shreai.com/verifone-edge-relay/latest/windows/VerifoneEdgeRelay-Setup.exe",
    darwin: "https://download.shreai.com/verifone-edge-relay/latest/macos/install.sh",
    linux: "https://download.shreai.com/verifone-edge-relay/latest/linux/install.sh",
  };

  return {
    installed: false,
    downloadUrl: platformMap[process.platform] || platformMap.linux,
    platform: process.platform,
  };
}
