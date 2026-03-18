import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ShreDirective, ArosEvent } from '../adp/types.js';
import { handleDirective } from './directives.js';

// ── Audit logging ───────────────────────────────────────────────────────────

function auditLog(event: string, data: Record<string, unknown>): void {
  console.log(`[shre-control:audit] ${event}`, JSON.stringify(data));
}

// ── Token validation stub ───────────────────────────────────────────────────

function validateShreToken(token: string): boolean {
  // Production: verify signed JWT from Shre
  // Stub: accept any non-empty token
  return token.length > 0;
}

// ── Connection state ────────────────────────────────────────────────────────

let shreSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const RECONNECT_INTERVAL_MS = 5_000;

/**
 * Emit an event to the connected Shre control socket.
 * Queues silently if Shre is not connected.
 */
export function emitEvent(event: ArosEvent): void {
  if (!shreSocket || shreSocket.readyState !== shreSocket.OPEN) {
    console.warn('[shre-control] Shre not connected — event dropped:', event.type);
    return;
  }

  const payload = JSON.stringify(event);
  shreSocket.send(payload);
  auditLog('event_emitted', { type: event.type });
}

/**
 * Attach the Shre control WebSocket server to an existing HTTP server.
 * Listens on the `/.aros/shre-control` path.
 */
export function attachShreControl(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/.aros/shre-control' });

  wss.on('connection', (ws, req) => {
    // ── Auth ────────────────────────────────────────────────────────────
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') ?? '';

    if (!validateShreToken(token)) {
      auditLog('auth_rejected', { reason: 'invalid_token' });
      ws.close(4001, 'Invalid or missing Shre token');
      return;
    }

    // ── Accept connection ───────────────────────────────────────────────
    if (shreSocket) {
      shreSocket.close(4002, 'Replaced by new Shre connection');
    }
    shreSocket = ws;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    auditLog('connected', { remoteAddress: req.socket.remoteAddress });

    // ── Message handling ────────────────────────────────────────────────
    ws.on('message', async (raw) => {
      let directive: ShreDirective;
      try {
        directive = JSON.parse(raw.toString()) as ShreDirective;
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      auditLog('directive_received', { type: directive.type, agentId: directive.agentId });

      try {
        const result = await handleDirective(directive);
        ws.send(JSON.stringify({ ok: true, directive: directive.type, result }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        ws.send(JSON.stringify({ ok: false, directive: directive.type, error: message }));
        auditLog('directive_error', { type: directive.type, error: message });
      }
    });

    // ── Disconnection ───────────────────────────────────────────────────
    ws.on('close', (code, reason) => {
      auditLog('disconnected', { code, reason: reason.toString() });
      shreSocket = null;

      // Auto-reconnect awareness: log that we're waiting
      reconnectTimer = setTimeout(() => {
        console.log('[shre-control] Shre has not reconnected within timeout window');
      }, RECONNECT_INTERVAL_MS);
    });

    ws.on('error', (err) => {
      auditLog('ws_error', { error: err.message });
    });
  });

  console.log('[shre-control] WebSocket server attached at /.aros/shre-control');
  return wss;
}
