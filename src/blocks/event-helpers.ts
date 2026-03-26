/**
 * Event publishing helpers for the AROS block system.
 * Wraps shre-sdk event bus with block-specific topics.
 */
let _log: any;
try { _log = require("shre-sdk/logger").createLogger("aros:blocks:events"); } catch { _log = { info: console.log, warn: console.warn, error: console.error }; }
const log = _log;

type Severity = "info" | "warning" | "critical";

/**
 * Publish a block-system event. Uses shre-sdk event bus when available,
 * falls back to structured logging.
 */
export function publish(event: string, severity: Severity, data: Record<string, unknown>): void {
  try {
    // Try to use shre-sdk event bus (may not be connected in all environments)
    const eventBus = require("shre-sdk/events");
    if (typeof eventBus.createEventBus === "function") {
      const bus = eventBus.createEventBus("aros-blocks");
      bus.publish(event, severity, data);
      return;
    }
  } catch (_) {
    // Event bus not available — fall through to log
  }

  // Fallback: structured log (always works)
  const logFn = severity === "critical" ? log.error : severity === "warning" ? log.warn : log.info;
  logFn(`[event] ${event}`, data);
}
