# Agent Data Protocol (ADP) — Shre-facing API

The ADP is AROS's brain-level API. It allows Shre (the external control plane) to read, update, and manage agent state — soul configuration, skills, memory, and training data.

## Authentication

All endpoints require a `Authorization: Bearer <shre-control-key>` header. Requests without valid auth return `401`.

## Endpoints

### List Agents

```
GET /.aros/agents
```

**Response:**
```json
{
  "agents": [
    { "id": "agent-001", "name": "AROS", "tenant": "tenant-abc" }
  ]
}
```

### Get Brain Snapshot

```
GET /.aros/agents/:id/brain
```

Returns the full `AgentBrain` object: soul, skills, memory, and stats.

**Response:**
```json
{
  "agentId": "agent-001",
  "tenant": "tenant-abc",
  "snapshot": "2026-03-18T12:00:00.000Z",
  "soul": { "identity": "...", "disposition": [...], "capabilities": [...], "boundaries": [...], "voice": "..." },
  "skills": [...],
  "memory": { "longTerm": "...", "recent": [...] },
  "stats": { "sessionsTotal": 142, "sessionsToday": 7, "avgResponseMs": 320, "tokensUsed": 58000, "lastActive": "...", "uptime": 86400 }
}
```

### Get Soul

```
GET /.aros/agents/:id/soul
```

### Get Skills

```
GET /.aros/agents/:id/skills
```

### Get Memory

```
GET /.aros/agents/:id/memory
```

### Sync Brain (Full Update)

```
POST /.aros/agents/:id/brain/sync
```

Shre pushes a full brain update. Partial fields are merged.

**Request body:** Partial `AgentBrain` object.

### Patch Soul

```
POST /.aros/agents/:id/soul
```

**Request body:** Partial `SoulConfig`:
```json
{
  "disposition": ["decisive", "warm", "minimal"],
  "voice": "Short sentences. Active voice."
}
```

### Inject Memory

```
POST /.aros/agents/:id/memory/inject
```

**Request body:**
```json
{
  "entries": [
    {
      "type": "feedback",
      "name": "prefer-concise",
      "content": "User prefers concise responses without trailing summaries",
      "timestamp": "2026-03-18T12:00:00.000Z"
    }
  ]
}
```

### Push Training Dataset (Evolve)

```
POST /.aros/agents/:id/evolve
```

**Request body:**
```json
{
  "dataset": {
    "id": "ds-001",
    "name": "retail-conversations-q1",
    "entries": [
      { "input": "What's our top seller?", "expectedOutput": "Based on this week's data..." }
    ],
    "createdAt": "2026-03-18T12:00:00.000Z"
  }
}
```

## Types

All request/response types are defined in `types.ts`:

- `AgentBrain` — full brain snapshot
- `SoulConfig` — identity, disposition, capabilities, boundaries, voice
- `SkillDefinition` — registered agent skill
- `MemoryEntry` — single memory item
- `TrainingSet` — fine-tuning dataset
- `ShreDirective` — Shre → AROS command (used via WebSocket control socket)
- `ArosEvent` — AROS → Shre event (emitted via WebSocket control socket)
