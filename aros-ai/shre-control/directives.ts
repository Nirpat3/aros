import type {
  ShreDirective,
  SoulConfig,
  SkillDefinition,
  MemoryEntry,
  TrainingSet,
} from '../adp/types.js';

// ── Audit logging ───────────────────────────────────────────────────────────

function auditLog(event: string, data: Record<string, unknown>): void {
  console.log(`[shre-control:directive] ${event}`, JSON.stringify(data));
}

// ── Directive handlers ──────────────────────────────────────────────────────

async function handleSoulUpdate(
  agentId: string,
  patch: Partial<SoulConfig>,
): Promise<Record<string, unknown>> {
  // In production: read SOUL.md, apply patch, write back, restart agent context
  auditLog('soul.update', { agentId, fields: Object.keys(patch) });

  // Stub: log the patch and return acknowledgment
  console.log(`[directives] Patching SOUL.md for agent ${agentId}:`, patch);
  return { applied: true, fields: Object.keys(patch) };
}

async function handleSkillPush(
  agentId: string,
  skill: SkillDefinition,
): Promise<Record<string, unknown>> {
  // In production: register skill in agent's tool registry
  auditLog('skill.push', { agentId, skillId: skill.id, skillName: skill.name });

  console.log(`[directives] Skill "${skill.name}" pushed to agent ${agentId}`);
  return { registered: true, skillId: skill.id };
}

async function handleMemoryInject(
  agentId: string,
  memories: MemoryEntry[],
): Promise<Record<string, unknown>> {
  // In production: append entries to agent memory files on disk
  auditLog('memory.inject', { agentId, count: memories.length });

  console.log(`[directives] ${memories.length} memory entries injected for agent ${agentId}`);
  return { injected: memories.length };
}

async function handleDatasetPush(
  agentId: string,
  dataset: TrainingSet,
): Promise<Record<string, unknown>> {
  // In production: store dataset in CortexService, schedule fine-tune run
  auditLog('dataset.push', { agentId, datasetId: dataset.id, entries: dataset.entries.length });

  console.log(
    `[directives] Dataset "${dataset.name}" stored for agent ${agentId}, fine-tune scheduled`,
  );
  return { stored: true, datasetId: dataset.id, scheduledFineTune: true };
}

async function handleAgentRestart(agentId: string): Promise<Record<string, unknown>> {
  // In production: graceful agent restart — flush state, reload SOUL.md, reinitialize tools
  auditLog('agent.restart', { agentId });

  console.log(`[directives] Graceful restart for agent ${agentId}`);
  return { restarted: true };
}

async function handleAgentRollback(
  agentId: string,
  version: string,
): Promise<Record<string, unknown>> {
  // In production: restore previous soul/memory snapshot from CortexService
  auditLog('agent.rollback', { agentId, version });

  console.log(`[directives] Rolling back agent ${agentId} to version ${version}`);
  return { rolledBack: true, version };
}

// ── Router ──────────────────────────────────────────────────────────────────

/**
 * Dispatch a ShreDirective to the appropriate handler.
 */
export async function handleDirective(directive: ShreDirective): Promise<Record<string, unknown>> {
  switch (directive.type) {
    case 'soul.update':
      return handleSoulUpdate(directive.agentId, directive.patch);

    case 'skill.push':
      return handleSkillPush(directive.agentId, directive.skill);

    case 'memory.inject':
      return handleMemoryInject(directive.agentId, directive.memory);

    case 'dataset.push':
      return handleDatasetPush(directive.agentId, directive.dataset);

    case 'agent.restart':
      return handleAgentRestart(directive.agentId);

    case 'agent.rollback':
      return handleAgentRollback(directive.agentId, directive.version);

    default:
      throw new Error(`Unknown directive type: ${(directive as { type: string }).type}`);
  }
}
