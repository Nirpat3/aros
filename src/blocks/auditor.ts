/**
 * AROS Runtime Mutation Auditor — enforces block contracts at execution time.
 *
 * Wraps every agent CortexDB write with a validation check:
 *   1. Before write: verify agentId has a contract
 *   2. Map the CortexDB data_type to state keys
 *   3. Check that all mutated keys are within the agent's `owns` set
 *   4. Reject and log violations — never allow unauthorized state mutation
 *
 * Usage:
 *   import { createArosAuditor } from "./blocks/auditor.js";
 *
 *   const auditor = createArosAuditor();
 *
 *   // Before writing to CortexDB:
 *   const check = auditor.checkWrite("ana", "inventory.velocity", payload);
 *   if (!check.allowed) {
 *     log.error("BLOCKED", { violations: check.violations });
 *     return; // Don't write
 *   }
 *
 *   // Wrap execution with full audit trail:
 *   const result = await auditor.auditExecution("victor", "fraud.void_baseline", async () => {
 *     return await cortex.write("fraud_void_baseline", data);
 *   });
 */
import { publish } from './event-helpers.js';
import { getContractFor, canWrite } from './registry.js';

// Dynamic imports (resolved at runtime via workspace links)
let _createStateMutationAuditor: any;
let _log: any;
try {
  _createStateMutationAuditor = require('shre-sdk/contracts').createStateMutationAuditor;
  _log = require('shre-sdk/logger').createLogger('aros:auditor');
} catch {
  _log = { info: console.log, warn: console.warn, error: console.error };
}
const log = _log;

// ── CortexDB data_type → state key mapping ─────────────────────────────────
// Maps the data_type used in CortexDB writes to the block contract state keys.
// This bridges the gap between "what CortexDB calls it" and "what the contract declares".

const DATA_TYPE_TO_STATE_KEY: Record<string, string> = {
  // Ana (Inventory)
  item_velocity: 'inventory.velocity',
  velocity_baseline: 'inventory.velocity_baseline',
  reorder_draft: 'inventory.reorder_drafts',
  dead_stock: 'inventory.dead_stock_flags',
  shrinkage_flag: 'inventory.shrinkage_flags',
  seasonal_factor: 'inventory.seasonal_factors',
  supplier_score: 'inventory.supplier_scores',
  stockout_prediction: 'inventory.stockout_predictions',

  // Sammy (Revenue)
  daily_pnl: 'pnl.daily_snapshot',
  cogs_calc: 'pnl.cogs',
  margin_trend: 'pnl.margin_trends',
  revenue_anomaly: 'pnl.revenue_anomalies',
  channel_split: 'pnl.channel_split',
  avg_ticket_trend: 'pnl.avg_ticket_trends',

  // Victor (Fraud)
  void_baseline: 'fraud.void_baseline',
  comp_baseline: 'fraud.comp_baseline',
  nosale_baseline: 'fraud.nosale_baseline',
  fraud_suspicion: 'fraud.suspicion_flags',
  fraud_pattern: 'fraud.pattern_clusters',
  false_positive: 'fraud.false_positive_tags',
  refund_pattern: 'fraud.refund_patterns',
  price_override_log: 'fraud.price_override_log',

  // Larry (Labor)
  labor_cost_pct: 'labor.cost_pct',
  overtime_alert: 'labor.overtime_alerts',
  shift_schedule: 'labor.shift_schedule',
  productivity_baseline: 'labor.productivity_baselines',
  coverage_gap: 'labor.coverage_gaps',
  callout_pattern: 'labor.callout_patterns',

  // Rita (Reputation)
  sentiment_trend: 'reputation.sentiment_trends',
  recurring_theme: 'reputation.recurring_themes',
  response_draft: 'reputation.response_drafts',
  platform_rating: 'reputation.platform_ratings',
  voice_model: 'reputation.voice_model',
  review_velocity: 'reputation.review_velocity',

  // AROS (Store Config)
  aros_config: 'store.config',
  agent_activation: 'store.agent_activation',
  tier_access: 'store.tier_access',
  routing_rules: 'store.routing_rules',

  // Read-only sources (any agent can read, none own)
  pos_item_scan: 'pos.item_scans',
  pos_transaction: 'pos.transactions',
  pos_event: 'pos.events',
};

export interface WriteCheck {
  allowed: boolean;
  agentId: string;
  stateKey: string;
  dataType: string;
  violations: string[];
}

export interface ExecutionAudit {
  agentId: string;
  blockId: string;
  allowed: boolean;
  writes: WriteCheck[];
  violations: string[];
  durationMs: number;
  timestamp: string;
}

// ── Auditor Factory ─────────────────────────────────────────────────────────

export interface ArosAuditor {
  /**
   * Check if an agent is allowed to write a specific data_type.
   * Call BEFORE every CortexDB write.
   */
  checkWrite(agentId: string, dataType: string, payload?: Record<string, unknown>): WriteCheck;

  /**
   * Wrap an agent's execution with full audit trail.
   * Logs all write attempts and blocks violations.
   */
  auditExecution<T>(
    agentId: string,
    writeKeys: string[],
    fn: () => Promise<T>,
  ): Promise<{ result: T | null; audit: ExecutionAudit }>;

  /**
   * Resolve a CortexDB data_type to a block contract state key.
   */
  resolveStateKey(dataType: string): string | undefined;

  /**
   * Get audit history for an agent (last N audits).
   */
  getHistory(agentId: string, limit?: number): ExecutionAudit[];
}

export function createArosAuditor(): ArosAuditor {
  const _sdkAuditor = _createStateMutationAuditor?.('aros-platform', {
    throwOnViolation: false,
  });

  // In-memory audit log (ring buffer, last 500 entries)
  const _auditLog: ExecutionAudit[] = [];
  const MAX_LOG = 500;

  function _pushAudit(audit: ExecutionAudit) {
    _auditLog.push(audit);
    if (_auditLog.length > MAX_LOG) _auditLog.shift();
  }

  function checkWrite(
    agentId: string,
    dataType: string,
    _payload?: Record<string, unknown>,
  ): WriteCheck {
    const stateKey = DATA_TYPE_TO_STATE_KEY[dataType];

    // Unknown data type — allow but warn (might be a new type not yet mapped)
    if (!stateKey) {
      log.warn('[auditor] Unknown data_type, allowing', { agentId, dataType });
      return { allowed: true, agentId, stateKey: dataType, dataType, violations: [] };
    }

    const contract = getContractFor(agentId);
    if (!contract) {
      // Agent has no contract — block ALL writes
      const msg = `Agent '${agentId}' has no block contract — write BLOCKED`;
      log.error('[auditor] ' + msg, { dataType, stateKey });
      publish('block.violation', 'critical', {
        agentId,
        dataType,
        stateKey,
        reason: 'no_contract',
      });
      return { allowed: false, agentId, stateKey, dataType, violations: [msg] };
    }

    if (!canWrite(agentId, stateKey)) {
      const owner = _findOwner(stateKey);
      const msg = `Agent '${agentId}' attempted write to '${stateKey}' — owned by '${owner || 'nobody'}'`;
      log.error('[auditor] VIOLATION: ' + msg, { dataType, blockId: contract.blockId });
      publish('block.violation', 'critical', {
        agentId,
        dataType,
        stateKey,
        owner,
        blockId: contract.blockId,
      });
      return { allowed: false, agentId, stateKey, dataType, violations: [msg] };
    }

    return { allowed: true, agentId, stateKey, dataType, violations: [] };
  }

  async function auditExecution<T>(
    agentId: string,
    writeKeys: string[],
    fn: () => Promise<T>,
  ): Promise<{ result: T | null; audit: ExecutionAudit }> {
    const start = Date.now();
    const contract = getContractFor(agentId);
    const blockId = contract?.blockId || 'unknown';

    // Pre-check all planned writes
    const writes: WriteCheck[] = writeKeys.map((key) => {
      const dataType =
        Object.entries(DATA_TYPE_TO_STATE_KEY).find(([, v]) => v === key)?.[0] || key;
      return checkWrite(agentId, dataType);
    });

    const violations = writes.flatMap((w) => w.violations);
    const allAllowed = violations.length === 0;

    const audit: ExecutionAudit = {
      agentId,
      blockId,
      allowed: allAllowed,
      writes,
      violations,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };

    if (!allAllowed) {
      audit.durationMs = Date.now() - start;
      _pushAudit(audit);
      log.error('[auditor] Execution BLOCKED', { agentId, blockId, violations });
      publish('block.execution_blocked', 'critical', { agentId, blockId, violations });
      return { result: null, audit };
    }

    // Execute the function
    let result: T | null = null;
    try {
      result = await fn();
      audit.durationMs = Date.now() - start;

      // Check TTL
      if (contract && audit.durationMs > contract.maxTtlS * 1000) {
        log.warn('[auditor] Block exceeded TTL', {
          agentId,
          blockId,
          durationMs: audit.durationMs,
          maxTtlMs: contract.maxTtlS * 1000,
        });
        publish('block.ttl_exceeded', 'warning', {
          agentId,
          blockId,
          durationMs: audit.durationMs,
          maxTtlS: contract.maxTtlS,
        });
      }

      publish('block.execution_completed', 'info', {
        agentId,
        blockId,
        durationMs: audit.durationMs,
        writeCount: writes.length,
      });
    } catch (err: any) {
      audit.durationMs = Date.now() - start;
      audit.allowed = false;
      audit.violations.push(`Execution error: ${err.message}`);
      log.error('[auditor] Execution failed', { agentId, blockId, error: err.message });
      publish('block.execution_failed', 'critical', { agentId, blockId, error: err.message });
    }

    _pushAudit(audit);
    return { result, audit };
  }

  function resolveStateKey(dataType: string): string | undefined {
    return DATA_TYPE_TO_STATE_KEY[dataType];
  }

  function getHistory(agentId: string, limit = 20): ExecutionAudit[] {
    return _auditLog.filter((a) => a.agentId === agentId).slice(-limit);
  }

  return { checkWrite, auditExecution, resolveStateKey, getHistory };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _findOwner(stateKey: string): string | undefined {
  // Import dynamically to avoid circular deps at module level
  const { getOwnershipMap } = require('./registry.js');
  const map = getOwnershipMap();
  return map[stateKey];
}
