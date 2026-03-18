import { Router, type Request, type Response, type NextFunction } from 'express';
import type { AgentBrain, SkillDefinition, SoulConfig, MemoryEntry, TrainingSet } from './types.js';

// ── Auth middleware ─────────────────────────────────────────────────────────

const CONTROL_KEY_HEADER = 'authorization';

function requireShreAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers[CONTROL_KEY_HEADER];
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <shre-control-key>' });
    return;
  }

  const token = auth.slice(7);
  if (!token) {
    res.status(401).json({ error: 'Empty control key' });
    return;
  }

  // Token validation stub — in production, verify against stored control key
  (req as Record<string, unknown>).shreControlKey = token;
  next();
}

// ── Stub data store ─────────────────────────────────────────────────────────

interface AgentRecord {
  id: string;
  name: string;
  tenant: string;
  soul: SoulConfig;
  skills: SkillDefinition[];
  memory: { longTerm: string; recent: Array<{ date: string; entries: MemoryEntry[] }> };
  stats: {
    sessionsTotal: number;
    sessionsToday: number;
    avgResponseMs: number;
    tokensUsed: number;
    lastActive: string;
    uptime: number;
  };
}

// In-memory store — production would back this with CortexService
const agents = new Map<string, AgentRecord>();

function getAgent(id: string): AgentRecord | undefined {
  return agents.get(id);
}

function ensureAgent(id: string): AgentRecord {
  if (!agents.has(id)) {
    agents.set(id, {
      id,
      name: 'AROS',
      tenant: '',
      soul: { identity: '', disposition: [], capabilities: [], boundaries: [], voice: '' },
      skills: [],
      memory: { longTerm: '', recent: [] },
      stats: { sessionsTotal: 0, sessionsToday: 0, avgResponseMs: 0, tokensUsed: 0, lastActive: new Date().toISOString(), uptime: 0 },
    });
  }
  return agents.get(id)!;
}

function toBrain(agent: AgentRecord): AgentBrain {
  return {
    agentId: agent.id,
    tenant: agent.tenant,
    snapshot: new Date().toISOString(),
    soul: agent.soul,
    skills: agent.skills,
    memory: agent.memory,
    stats: agent.stats,
  };
}

// ── Router ──────────────────────────────────────────────────────────────────

export function createADPRouter(): Router {
  const router = Router();

  // All ADP routes require Shre auth
  router.use(requireShreAuth);

  // GET /.aros/agents — list agents
  router.get('/.aros/agents', (_req: Request, res: Response) => {
    const list = [...agents.values()].map((a) => ({ id: a.id, name: a.name, tenant: a.tenant }));
    res.json({ agents: list });
  });

  // GET /.aros/agents/:id/brain — full brain snapshot
  router.get('/.aros/agents/:id/brain', (req: Request, res: Response) => {
    const agent = getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json(toBrain(agent));
  });

  // GET /.aros/agents/:id/soul
  router.get('/.aros/agents/:id/soul', (req: Request, res: Response) => {
    const agent = getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json({ agentId: agent.id, soul: agent.soul });
  });

  // GET /.aros/agents/:id/skills
  router.get('/.aros/agents/:id/skills', (req: Request, res: Response) => {
    const agent = getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json({ agentId: agent.id, skills: agent.skills });
  });

  // GET /.aros/agents/:id/memory
  router.get('/.aros/agents/:id/memory', (req: Request, res: Response) => {
    const agent = getAgent(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json({ agentId: agent.id, memory: agent.memory });
  });

  // POST /.aros/agents/:id/brain/sync — Shre pushes full brain update
  router.post('/.aros/agents/:id/brain/sync', (req: Request, res: Response) => {
    const agent = ensureAgent(req.params.id);
    const body = req.body as Partial<AgentBrain>;

    if (body.soul) agent.soul = body.soul;
    if (body.skills) agent.skills = body.skills;
    if (body.memory) agent.memory = body.memory;
    if (body.stats) agent.stats = body.stats;
    if (body.tenant) agent.tenant = body.tenant;

    console.log(`[adp] Brain sync received for agent ${agent.id}`);
    res.json({ ok: true, brain: toBrain(agent) });
  });

  // POST /.aros/agents/:id/soul — soul patch
  router.post('/.aros/agents/:id/soul', (req: Request, res: Response) => {
    const agent = ensureAgent(req.params.id);
    const patch = req.body as Partial<SoulConfig>;

    agent.soul = { ...agent.soul, ...patch };
    console.log(`[adp] Soul patched for agent ${agent.id}`);
    res.json({ ok: true, soul: agent.soul });
  });

  // POST /.aros/agents/:id/memory/inject — memory injection
  router.post('/.aros/agents/:id/memory/inject', (req: Request, res: Response) => {
    const agent = ensureAgent(req.params.id);
    const { entries } = req.body as { entries: MemoryEntry[] };

    if (!entries || !Array.isArray(entries)) {
      res.status(400).json({ error: 'Request body must include entries array' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    let todayMemory = agent.memory.recent.find((d) => d.date === today);
    if (!todayMemory) {
      todayMemory = { date: today, entries: [] };
      agent.memory.recent.push(todayMemory);
    }
    todayMemory.entries.push(...entries);

    console.log(`[adp] ${entries.length} memory entries injected for agent ${agent.id}`);
    res.json({ ok: true, injected: entries.length });
  });

  // POST /.aros/agents/:id/evolve — dataset push for fine-tuning
  router.post('/.aros/agents/:id/evolve', (req: Request, res: Response) => {
    const agent = ensureAgent(req.params.id);
    const { dataset } = req.body as { dataset: TrainingSet };

    if (!dataset || !dataset.entries) {
      res.status(400).json({ error: 'Request body must include dataset with entries' });
      return;
    }

    // Store dataset for scheduled fine-tune run (stub — production writes to CortexService)
    console.log(`[adp] Dataset "${dataset.name}" pushed for agent ${agent.id} (${dataset.entries.length} entries)`);
    res.json({ ok: true, datasetId: dataset.id, entries: dataset.entries.length, scheduledForFineTune: true });
  });

  return router;
}
