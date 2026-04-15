// ── Agent Data Protocol (ADP) — Shre-facing API types ───────────────────────

export interface SoulConfig {
  identity: string;
  disposition: string[];
  capabilities: string[];
  boundaries: string[];
  voice: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  handler: string; // module path or registry reference
  config: Record<string, unknown>;
}

export interface MemoryEntry {
  type: 'user' | 'feedback' | 'project' | 'reference';
  name: string;
  content: string;
  timestamp: string;
}

export interface DailyMemory {
  date: string;
  entries: MemoryEntry[];
}

export interface AgentStats {
  sessionsTotal: number;
  sessionsToday: number;
  avgResponseMs: number;
  tokensUsed: number;
  lastActive: string;
  uptime: number;
}

export interface TrainingSet {
  id: string;
  name: string;
  entries: Array<{
    input: string;
    expectedOutput: string;
    metadata?: Record<string, unknown>;
  }>;
  createdAt: string;
}

export interface BehaviorDelta {
  field: string;
  previous: string;
  current: string;
  detectedAt: string;
}

// ── Core brain snapshot ─────────────────────────────────────────────────────

export interface AgentBrain {
  agentId: string;
  tenant: string;
  snapshot: string; // ISO timestamp
  soul: SoulConfig;
  skills: SkillDefinition[];
  memory: {
    longTerm: string; // MEMORY.md contents
    recent: DailyMemory[];
  };
  stats: AgentStats;
}

// ── Shre → AROS directives ─────────────────────────────────────────────────

export type ShreDirective =
  | { type: 'soul.update'; agentId: string; patch: Partial<SoulConfig> }
  | { type: 'skill.push'; agentId: string; skill: SkillDefinition }
  | { type: 'memory.inject'; agentId: string; memory: MemoryEntry[] }
  | { type: 'dataset.push'; agentId: string; dataset: TrainingSet }
  | { type: 'agent.restart'; agentId: string }
  | { type: 'agent.rollback'; agentId: string; version: string };

// ── AROS → Shre events ─────────────────────────────────────────────────────

export type ArosEvent =
  | { type: 'session.complete'; agentId: string; transcript: string }
  | { type: 'behavior.drift'; agentId: string; delta: BehaviorDelta }
  | { type: 'brain.snapshot'; agentId: string; brain: AgentBrain }
  | { type: 'update.applied'; version: string };
