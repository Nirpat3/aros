import type { ArosEvent, AgentBrain, BehaviorDelta } from '../adp/types.js';
import { emitEvent } from './socket.js';

// ── Scheduled snapshot interval ─────────────────────────────────────────────

const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
let snapshotTimer: ReturnType<typeof setInterval> | null = null;

// ── Event emitters ──────────────────────────────────────────────────────────

/**
 * Emit a session.complete event after every agent session ends.
 */
export function emitSessionComplete(agentId: string, transcript: string): void {
  const event: ArosEvent = {
    type: 'session.complete',
    agentId,
    transcript,
  };
  emitEvent(event);
}

/**
 * Emit a behavior.drift event when soul configuration changes are detected.
 */
export function emitBehaviorDrift(agentId: string, delta: BehaviorDelta): void {
  const event: ArosEvent = {
    type: 'behavior.drift',
    agentId,
    delta,
  };
  emitEvent(event);
}

/**
 * Emit a brain.snapshot event with the current agent brain state.
 */
export function emitBrainSnapshot(agentId: string, brain: AgentBrain): void {
  const event: ArosEvent = {
    type: 'brain.snapshot',
    agentId,
    brain,
  };
  emitEvent(event);
}

/**
 * Emit an update.applied event after a platform update is applied.
 */
export function emitUpdateApplied(version: string): void {
  const event: ArosEvent = {
    type: 'update.applied',
    version,
  };
  emitEvent(event);
}

// ── Scheduled brain snapshot ────────────────────────────────────────────────

/**
 * Start the periodic brain snapshot emitter (every 6 hours).
 * Provide a callback that returns the current brain state for the given agent.
 */
export function startSnapshotSchedule(
  agentId: string,
  getBrain: () => AgentBrain,
): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
  }

  snapshotTimer = setInterval(() => {
    try {
      const brain = getBrain();
      emitBrainSnapshot(agentId, brain);
      console.log(`[shre-control:events] Scheduled brain snapshot emitted for agent ${agentId}`);
    } catch (err) {
      console.error('[shre-control:events] Failed to emit scheduled brain snapshot:', err);
    }
  }, SNAPSHOT_INTERVAL_MS);

  console.log(`[shre-control:events] Brain snapshot schedule started (every 6h) for agent ${agentId}`);
}

/**
 * Stop the periodic brain snapshot emitter.
 */
export function stopSnapshotSchedule(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
    console.log('[shre-control:events] Brain snapshot schedule stopped');
  }
}
