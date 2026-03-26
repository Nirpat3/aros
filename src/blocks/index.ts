/**
 * AROS Block System — Lego-style agent composition with runtime enforcement.
 *
 * Modules:
 *   contracts  — Agent block contract declarations (owns/reads/emits)
 *   registry   — BlockRegistry initialization, wave planner, ownership checks
 *   auditor    — Runtime mutation auditor, execution wrapper, audit log
 *
 * Quick start:
 *   import { getRegistry, getWavePlan, createArosAuditor, ALL_CONTRACTS } from "./blocks";
 *
 *   // 1. Initialize registry (validates no collisions/cycles)
 *   const registry = getRegistry();
 *   const plan = getWavePlan();
 *
 *   // 2. Create auditor for runtime enforcement
 *   const auditor = createArosAuditor();
 *
 *   // 3. Execute waves in order
 *   for (const wave of plan.waves) {
 *     await Promise.all(wave.blocks.map(block =>
 *       auditor.auditExecution(block.agentId, block.owns, () =>
 *         executeAgent(block.agentId)
 *       )
 *     ));
 *   }
 */

// Contracts (static declarations)
export {
  ANA_CONTRACT,
  SAMMY_CONTRACT,
  VICTOR_CONTRACT,
  LARRY_CONTRACT,
  RITA_CONTRACT,
  AROS_CONTRACT,
  ALL_CONTRACTS,
  AGENT_CONTRACT_MAP,
} from "./contracts.js";

// Registry (initialization + analysis)
export {
  getRegistry,
  getReport,
  getWavePlan,
  getContractFor,
  canWrite,
  canRead,
  getOwnershipMap,
  type WaveBlock,
  type Wave,
  type WavePlan,
} from "./registry.js";

// Auditor (runtime enforcement)
export {
  createArosAuditor,
  type ArosAuditor,
  type WriteCheck,
  type ExecutionAudit,
} from "./auditor.js";

// Executor (wave-based parallel execution)
export {
  createWaveExecutor,
  type WaveExecutor,
  type WaveExecutorOptions,
  type AgentHandler,
  type BlockResult,
  type WaveResult,
  type ExecutionReport,
} from "./executor.js";
