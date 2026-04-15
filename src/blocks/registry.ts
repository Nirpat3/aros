/**
 * AROS Block Registry — initializes the BlockRegistry with all AROS agent
 * contracts, validates no collisions or cycles, and exposes the wave planner.
 *
 * Usage:
 *   import { getRegistry, getWavePlan, getContractFor } from "./blocks/registry.js";
 *
 *   const report = getRegistry().analyze();
 *   console.log(report.isClean);    // true — no collisions or cycles
 *   console.log(report.waves);      // [[wave1], [wave2], ...] execution order
 *
 *   const plan = getWavePlan();     // Pre-computed wave plan with metadata
 *   for (const wave of plan.waves) {
 *     await Promise.all(wave.blocks.map(b => executeBlock(b)));
 *   }
 */
import { ALL_CONTRACTS, AGENT_CONTRACT_MAP, type AgentBlockContract } from './contracts.js';

// Inline types from shre-sdk/contracts (resolved at runtime via workspace links)
interface BlockCollision {
  blockIdA: string;
  blockIdB: string;
  conflictingKeys: string[];
}
interface CollisionReport {
  collisions: BlockCollision[];
  waves: string[][];
  cycles: string[][];
  isClean: boolean;
}
interface BlockRegistry {
  register(contract: AgentBlockContract): void;
  unregister(blockId: string): boolean;
  getContract(blockId: string): AgentBlockContract | undefined;
  listBlockIds(): string[];
  analyze(): CollisionReport;
  readonly collisionCount: number;
}

// Dynamic imports (resolved at runtime)
let _createBlockRegistry: any;
let _log: any;
try {
  _createBlockRegistry = require('shre-sdk/contracts').createBlockRegistry;
  _log = require('shre-sdk/logger').createLogger('aros:blocks');
} catch {
  _log = { info: console.log, warn: console.warn, error: console.error };
}
const log = _log;

// ── Singleton Registry ─────────────────────────────────────────────────────

let _registry: BlockRegistry | null = null;
let _report: CollisionReport | null = null;

/**
 * Initialize and return the AROS block registry.
 * Registers all agent contracts. Throws on collision or cycle.
 * Safe to call multiple times — returns cached instance.
 */
export function getRegistry(): BlockRegistry {
  if (_registry) return _registry;

  if (!_createBlockRegistry) throw new Error('shre-sdk/contracts not available');
  _registry = _createBlockRegistry('aros-platform', {
    rejectOnCollision: true,
    rejectOnCycle: true,
  });

  for (const contract of ALL_CONTRACTS) {
    try {
      _registry!.register(contract);
      log.info(`[blocks] Registered: ${contract.blockId} (P${contract.priority})`, {
        owns: contract.owns.length,
        reads: contract.reads.length,
        emits: contract.emits.length,
      });
    } catch (err: any) {
      log.error(`[blocks] FAILED to register ${contract.blockId}`, {}, err);
      throw err; // Fatal — don't start with broken contracts
    }
  }

  // Run analysis and cache
  _report = _registry!.analyze();

  if (!_report.isClean) {
    log.error('[blocks] Registry has collisions or cycles!', {
      collisions: _report.collisions.length,
      cycles: _report.cycles.length,
    });
    // Log each collision for debugging
    for (const c of _report.collisions) {
      log.error(`[blocks] COLLISION: ${c.blockIdA} ↔ ${c.blockIdB}`, {
        conflictingKeys: c.conflictingKeys,
      });
    }
    for (const cycle of _report.cycles) {
      log.error(`[blocks] CYCLE: ${cycle.join(' → ')}`);
    }
  } else {
    log.info('[blocks] Registry clean — no collisions, no cycles', {
      blocks: _registry!.listBlockIds().length,
      waves: _report.waves.length,
    });
  }

  return _registry!;
}

/**
 * Get the cached collision report. Initializes registry if needed.
 */
export function getReport(): CollisionReport {
  if (!_report) getRegistry();
  return _report!;
}

// ── Wave Planner ───────────────────────────────────────────────────────────

export interface WaveBlock {
  blockId: string;
  agentId: string;
  priority: number;
  maxTtlS: number;
  owns: string[];
  emits: string[];
}

export interface Wave {
  index: number;
  blocks: WaveBlock[];
  canRunParallel: true;
  maxTtlS: number; // Max TTL of any block in this wave
}

export interface WavePlan {
  waves: Wave[];
  totalBlocks: number;
  estimatedMaxDurationS: number;
  isClean: boolean;
}

/**
 * Get the pre-computed wave execution plan.
 * Blocks in the same wave can run in parallel (no dependency conflicts).
 * Waves must execute sequentially.
 */
export function getWavePlan(): WavePlan {
  const report = getReport();
  const registry = getRegistry();

  const waves: Wave[] = report.waves.map((blockIds: string[], index: number) => {
    const blocks: WaveBlock[] = blockIds.map((bid) => {
      const contract = registry.getContract(bid)!;
      // Reverse-lookup agentId from contract
      const agentId =
        Object.entries(AGENT_CONTRACT_MAP).find(([, c]) => c.blockId === bid)?.[0] || bid;
      return {
        blockId: bid,
        agentId,
        priority: contract.priority,
        maxTtlS: contract.maxTtlS,
        owns: contract.owns,
        emits: contract.emits,
      };
    });

    // Sort blocks within wave by priority (highest first)
    blocks.sort((a, b) => b.priority - a.priority);

    return {
      index,
      blocks,
      canRunParallel: true as const,
      maxTtlS: Math.max(...blocks.map((b) => b.maxTtlS)),
    };
  });

  return {
    waves,
    totalBlocks: ALL_CONTRACTS.length,
    estimatedMaxDurationS: waves.reduce((sum, w) => sum + w.maxTtlS, 0),
    isClean: report.isClean,
  };
}

/**
 * Get the contract for a specific agent.
 * @param agentId — e.g. "ana", "victor", "aros"
 */
export function getContractFor(agentId: string): AgentBlockContract | undefined {
  return AGENT_CONTRACT_MAP[agentId];
}

/**
 * Check if an agent is allowed to write to a specific state key.
 * Used by the runtime auditor before any CortexDB write.
 */
export function canWrite(agentId: string, stateKey: string): boolean {
  const contract = AGENT_CONTRACT_MAP[agentId];
  if (!contract) return false;
  return contract.owns.includes(stateKey);
}

/**
 * Check if an agent is allowed to read a specific state key.
 */
export function canRead(agentId: string, stateKey: string): boolean {
  const contract = AGENT_CONTRACT_MAP[agentId];
  if (!contract) return false;
  return contract.reads.includes(stateKey);
}

/**
 * Get all state keys owned across all agents (for dashboard display).
 */
export function getOwnershipMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [agentId, contract] of Object.entries(AGENT_CONTRACT_MAP)) {
    if (agentId === 'aros-agent') continue; // Skip alias
    for (const key of contract.owns) {
      map[key] = agentId;
    }
  }
  return map;
}
