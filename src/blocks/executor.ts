/**
 * AROS Wave Executor — runs agent blocks in dependency-safe parallel waves.
 *
 * The execution model:
 *   1. Wave plan computed from block contracts (topological sort)
 *   2. Blocks in the same wave run in parallel (no shared state)
 *   3. Waves execute sequentially (wave N+1 may read wave N's output)
 *   4. Every CortexDB write is audited against the agent's contract
 *   5. TTL enforcement — blocks killed if they exceed maxTtlS
 *   6. Retry with backoff for idempotent blocks
 *
 * This replaces ad-hoc agent scheduling with a provably-safe execution order.
 *
 * Usage:
 *   import { createWaveExecutor } from "./blocks/executor.js";
 *
 *   const executor = createWaveExecutor({
 *     cortexUrl: "http://127.0.0.1:5400",
 *     onBlockComplete: (blockId, result) => { ... },
 *     onWaveComplete: (waveIndex, results) => { ... },
 *   });
 *
 *   // Run all AROS blocks for a tenant
 *   const report = await executor.runAll("tenant-123");
 *
 *   // Run a single agent's block
 *   const result = await executor.runOne("ana", "tenant-123");
 */
let _log: any;
try { _log = require("shre-sdk/logger").createLogger("aros:executor"); } catch { _log = { info: console.log, warn: console.warn, error: console.error }; }
import { createResilience } from "shre-sdk/resilience";
import { getWavePlan, getContractFor, type Wave, type WaveBlock } from "./registry.js";
import { createArosAuditor, type ArosAuditor, type ExecutionAudit } from "./auditor.js";
import { publish } from "./event-helpers.js";

const log = _log;

// ── Types ───────────────────────────────────────────────────────────────────

export interface BlockResult {
  blockId: string;
  agentId: string;
  success: boolean;
  audit: ExecutionAudit;
  output?: unknown;
  error?: string;
  retries: number;
}

export interface WaveResult {
  waveIndex: number;
  blocks: BlockResult[];
  durationMs: number;
  allSucceeded: boolean;
}

export interface ExecutionReport {
  tenantId: string;
  waves: WaveResult[];
  totalDurationMs: number;
  blocksExecuted: number;
  blocksSucceeded: number;
  blocksFailed: number;
  blocksSkipped: number;
  violations: string[];
  timestamp: string;
}

export interface AgentHandler {
  /** Execute the agent's work for a tenant. Returns any output. */
  (tenantId: string, stateKey: string[]): Promise<unknown>;
}

export interface WaveExecutorOptions {
  cortexUrl?: string;
  /** Called after each block completes */
  onBlockComplete?: (blockId: string, result: BlockResult) => void;
  /** Called after each wave completes */
  onWaveComplete?: (waveIndex: number, result: WaveResult) => void;
  /** Map of agentId → handler function. Missing handlers = block skipped. */
  handlers?: Record<string, AgentHandler>;
}

export interface WaveExecutor {
  /** Run all AROS blocks in wave order for a tenant */
  runAll(tenantId: string): Promise<ExecutionReport>;
  /** Run a single agent's block */
  runOne(agentId: string, tenantId: string): Promise<BlockResult>;
  /** Register a handler for an agent */
  registerHandler(agentId: string, handler: AgentHandler): void;
  /** Get the wave plan (for display) */
  getPlan(): ReturnType<typeof getWavePlan>;
  /** Get the auditor (for direct checks) */
  getAuditor(): ArosAuditor;
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createWaveExecutor(options: WaveExecutorOptions = {}): WaveExecutor {
  const auditor = createArosAuditor();
  const resilience = createResilience({ service: "aros:executor" });
  const handlers = new Map<string, AgentHandler>(
    Object.entries(options.handlers || {}),
  );

  function registerHandler(agentId: string, handler: AgentHandler) {
    handlers.set(agentId, handler);
  }

  async function runBlock(block: WaveBlock, tenantId: string): Promise<BlockResult> {
    const contract = getContractFor(block.agentId);
    if (!contract) {
      return {
        blockId: block.blockId,
        agentId: block.agentId,
        success: false,
        audit: {
          agentId: block.agentId, blockId: block.blockId,
          allowed: false, writes: [], violations: ["No contract found"],
          durationMs: 0, timestamp: new Date().toISOString(),
        },
        error: "No block contract registered",
        retries: 0,
      };
    }

    const handler = handlers.get(block.agentId);
    if (!handler) {
      log.warn(`[executor] No handler for ${block.agentId} — skipping`, { blockId: block.blockId });
      return {
        blockId: block.blockId,
        agentId: block.agentId,
        success: false,
        audit: {
          agentId: block.agentId, blockId: block.blockId,
          allowed: true, writes: [], violations: [],
          durationMs: 0, timestamp: new Date().toISOString(),
        },
        error: "No handler registered — block skipped",
        retries: 0,
      };
    }

    // Execute with audit wrapper + TTL enforcement
    const maxRetries = contract.idempotent ? contract.maxRetries : 0;

    try {
      const { output, audit, retries } = await resilience.wrap(
        `block:${block.blockId}`,
        async () => {
          // TTL enforcement via AbortController
          const controller = new AbortController();
          const ttlTimer = setTimeout(() => controller.abort(), contract.maxTtlS * 1000);

          try {
            const { result: output, audit } = await auditor.auditExecution(
              block.agentId,
              contract.owns,
              () => {
                // Race against TTL
                return Promise.race([
                  handler(tenantId, contract.owns),
                  new Promise<never>((_, reject) => {
                    controller.signal.addEventListener("abort", () =>
                      reject(new Error(`TTL exceeded (${contract.maxTtlS}s)`))
                    );
                  }),
                ]);
              },
            );

            clearTimeout(ttlTimer);

            if (!audit.allowed) {
              // Audit violations are not retryable — throw with marker
              const err = new Error(`Audit violations: ${audit.violations.join("; ")}`);
              (err as any).__auditViolation = true;
              (err as any).__audit = audit;
              throw err;
            }

            return { output, audit, retries: 0 };
          } catch (err) {
            clearTimeout(ttlTimer);
            throw err;
          }
        },
        {
          maxRetries,
          baseDelayMs: 1000,
          backoff: 2,
          jitter: 0.1,
          timeoutMs: Math.max(contract.maxTtlS * 1000 * (maxRetries + 1), 10_000),
          retryIf: (err: any) => !err.__auditViolation && contract.idempotent,
        },
      );

      return {
        blockId: block.blockId,
        agentId: block.agentId,
        success: true,
        audit,
        output,
        retries,
      };
    } catch (err: any) {
      if (err.__auditViolation) {
        return {
          blockId: block.blockId,
          agentId: block.agentId,
          success: false,
          audit: err.__audit,
          error: err.message,
          retries: 0,
        };
      }

      return {
        blockId: block.blockId,
        agentId: block.agentId,
        success: false,
        audit: {
          agentId: block.agentId, blockId: block.blockId,
          allowed: true, writes: [], violations: [`Failed after retries: ${err.message}`],
          durationMs: 0, timestamp: new Date().toISOString(),
        },
        error: err.message,
        retries: maxRetries,
      };
    }
  }

  async function runWave(wave: Wave, tenantId: string): Promise<WaveResult> {
    const start = Date.now();

    log.info(`[executor] Wave ${wave.index} starting`, {
      blocks: wave.blocks.map((b) => b.blockId),
      maxTtlS: wave.maxTtlS,
    });

    // Run all blocks in this wave in parallel
    const results = await Promise.all(
      wave.blocks.map((block) => runBlock(block, tenantId)),
    );

    const waveResult: WaveResult = {
      waveIndex: wave.index,
      blocks: results,
      durationMs: Date.now() - start,
      allSucceeded: results.every((r) => r.success),
    };

    // Notify
    for (const r of results) {
      options.onBlockComplete?.(r.blockId, r);
    }
    options.onWaveComplete?.(wave.index, waveResult);

    log.info(`[executor] Wave ${wave.index} complete`, {
      durationMs: waveResult.durationMs,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return waveResult;
  }

  async function runAll(tenantId: string): Promise<ExecutionReport> {
    const start = Date.now();
    const plan = getWavePlan();

    log.info("[executor] Starting full wave execution", {
      tenantId,
      waves: plan.waves.length,
      blocks: plan.totalBlocks,
    });

    publish("block.wave_execution_started", "info", { tenantId, waves: plan.waves.length });

    const waveResults: WaveResult[] = [];
    let totalViolations: string[] = [];

    for (const wave of plan.waves) {
      const result = await runWave(wave, tenantId);
      waveResults.push(result);

      // Collect violations
      for (const block of result.blocks) {
        totalViolations.push(...block.audit.violations);
      }
    }

    const allBlocks = waveResults.flatMap((w) => w.blocks);
    const report: ExecutionReport = {
      tenantId,
      waves: waveResults,
      totalDurationMs: Date.now() - start,
      blocksExecuted: allBlocks.length,
      blocksSucceeded: allBlocks.filter((b) => b.success).length,
      blocksFailed: allBlocks.filter((b) => !b.success && b.error !== "No handler registered — block skipped").length,
      blocksSkipped: allBlocks.filter((b) => b.error === "No handler registered — block skipped").length,
      violations: totalViolations,
      timestamp: new Date().toISOString(),
    };

    publish("block.wave_execution_completed", "info", {
      tenantId,
      durationMs: report.totalDurationMs,
      succeeded: report.blocksSucceeded,
      failed: report.blocksFailed,
      skipped: report.blocksSkipped,
    });

    log.info("[executor] Full execution complete", {
      tenantId,
      durationMs: report.totalDurationMs,
      succeeded: report.blocksSucceeded,
      failed: report.blocksFailed,
    });

    return report;
  }

  async function runOne(agentId: string, tenantId: string): Promise<BlockResult> {
    const contract = getContractFor(agentId);
    if (!contract) {
      return {
        blockId: "unknown",
        agentId,
        success: false,
        audit: {
          agentId, blockId: "unknown",
          allowed: false, writes: [], violations: ["Unknown agent"],
          durationMs: 0, timestamp: new Date().toISOString(),
        },
        error: `No contract for agent '${agentId}'`,
        retries: 0,
      };
    }

    const block: WaveBlock = {
      blockId: contract.blockId,
      agentId,
      priority: contract.priority,
      maxTtlS: contract.maxTtlS,
      owns: contract.owns,
      emits: contract.emits,
    };

    return runBlock(block, tenantId);
  }

  return {
    runAll,
    runOne,
    registerHandler,
    getPlan: getWavePlan,
    getAuditor: () => auditor,
  };
}
