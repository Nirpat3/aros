import type { TaskEvent } from './types.js';

/**
 * Emit a task lifecycle event.
 *
 * Logs the event locally. If Shre control socket is connected,
 * wraps as an ArosEvent (session.complete) so task completions
 * feed into the Shre brain just like chat sessions.
 */
export function emitTaskEvent(event: TaskEvent): void {
  console.log(
    `[tasks:events] ${event.type} — task=${event.taskId} agent=${event.agentId} tenant=${event.tenantId}`,
  );

  // Forward to Shre control channel as session.complete wrapper
  // This ensures task events feed the brain snapshot pipeline
  try {
    // Dynamic import to avoid hard dependency on shre-control at module level
    import('../aros-ai/shre-control/events.js').then(({ emitSessionComplete }) => {
      emitSessionComplete(event.agentId, JSON.stringify(event));
    }).catch(() => {
      // Shre control not available — events logged locally only
    });
  } catch {
    // Silent — Shre integration is optional
  }
}
