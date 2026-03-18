# 04 — Brain Sync & Feedback Loop

How agent sessions, task executions, and brain snapshots flow between AROS and Shre.

## Feedback Loop Architecture

Every agent interaction — whether a user chat or a task execution — feeds the brain sync pipeline:

```
User or Shre creates a Task
       ↓
TaskScheduler.enqueue(task)
       ↓
executeTask(taskId, agent)
       ↓
agent.chat(taskPrompt)          ← full agent processing
       ↓
emitSessionComplete()           ← feedback loop fires
       ↓
Shre receives session.complete
       ↓
Shre auto-pulls brain (includes task stats in brain export)
       ↓
shre-sync archives to MIB007
       ↓
Task result stored + logs appended
       ↓
TaskEvent emitted (task.completed)
       ↓
Admin panel shows task history
```

## Event Types (AROS → Shre)

| Event | Trigger | Data |
|-------|---------|------|
| `session.complete` | After every `agent.chat()` call | Full transcript (user + assistant messages) |
| `behavior.drift` | After `agent.updateSoul()` | Previous + updated soul config delta |
| `brain.snapshot` | Every 6 hours (scheduled) | Complete `AgentBrain` export |
| `update.applied` | After platform update | Version string |

## Session Complete Flow

1. User sends message → `agent.chat(message)`
2. Agent processes with tools, generates response
3. `emitSessionComplete(agentId, transcript)` fires
4. Event sent over Shre control WebSocket
5. Shre receives, triggers brain pull via ADP HTTP endpoint
6. Brain snapshot archived to MIB007 via shre-sync

## Task Execution as Sessions

Task execution uses the same feedback loop as chat:

1. `executeTask(taskId, agent)` builds prompt from task fields
2. Calls `agent.chat(prompt)` — treated as a normal session
3. `session.complete` fires automatically (chat() handles this)
4. Task-specific `TaskEvent` also emitted for task tracking

This means every task produces:
- A session transcript in Shre
- A task result in the task store
- Updated brain stats (session count incremented)

## Brain Snapshot Contents

```typescript
interface AgentBrain {
  agentId: string;
  tenantId: string;
  lastUpdated: string;
  soul: SoulConfig;
  skills: { name: string }[];
  memory: {
    longTerm: string;        // Last 100 messages joined
    recent: DailyMemory[];
  };
  sessions: [];
  datasets: [];
  stats: {
    totalSessions: number;
    lastActive: string;
    topTopics: string[];
    behaviorScore: number;
    version: string;
  };
}
```

## Behavior Drift Detection

When `agent.updateSoul(patch)` is called:

1. Previous soul state is captured
2. Patch is applied to current soul
3. `behavior.drift` event emitted with `{ previous, updated }` delta
4. Shre logs the drift and triggers soul backup
5. System prompt is rebuilt with new soul text

## Scheduled Snapshots

- Interval: every 6 hours (21,600,000 ms)
- Started automatically in `ArosAgent` constructor
- Stopped on `agent.shutdown()`
- Calls `agent.exportBrain()` and emits `brain.snapshot`
- On failure: logs error, continues schedule

## MIB007 Integration

MIB007Agent uses callback hooks instead of direct Shre events:

```typescript
agent.onSessionComplete = (agentId, transcript) => {
  // AROS wires this to emitSessionComplete
};

agent.onBehaviorDrift = (agentId, delta) => {
  // AROS wires this to emitBehaviorDrift
};
```

This keeps MIB007 core decoupled from Shre — AROS is the integration layer.

## Brain Import (Restore)

`agent.importBrain(brain)` restores agent state from a Shre snapshot:
- Applies soul config
- Updates soul text if `raw` field present
- Logs restoration timestamp
