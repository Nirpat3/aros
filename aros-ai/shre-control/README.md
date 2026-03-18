# Shre Control Channel

AROS connects to Shre via a persistent WebSocket at `/.aros/shre-control`.

## Events emitted by AROS → Shre

| Event | When | Payload |
|-------|------|---------|
| `session.complete` | After every agent session ends | `{ agentId, transcript }` |
| `behavior.drift` | When soul is updated | `{ agentId, delta: { previous, updated } }` |
| `brain.snapshot` | Every 6h (scheduled) | `{ agentId, brain }` |
| `update.applied` | After platform update | `{ version }` |

## Directives received from Shre → AROS

| Directive | Effect |
|-----------|--------|
| `soul.update` | Patches SOUL.md + resets agent context |
| `skill.push` | Adds skill to agent registry |
| `memory.inject` | Appends to agent memory files |
| `dataset.push` | Stores dataset for evolution |
| `agent.restart` | Graceful agent restart |
| `agent.rollback` | Restores previous soul/memory snapshot |

## Startup

`startSnapshotSchedule(agentId, getBrain)` is called in agent constructor.
This emits `brain.snapshot` every 6 hours to Shre automatically.

## Session Lifecycle

```
User sends message
  → agent.chat() called
  → agent processes, generates response
  → emitSessionComplete(agentId, fullTranscript) called
  → Shre receives event, auto-pulls brain
  → Shre stores updated brain snapshot
  → Intelligence loop complete ✓
```
