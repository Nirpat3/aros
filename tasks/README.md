# Task Management System

Task management for AROS agents — create, schedule, execute, and track tasks with full feedback loop integration.

## Task Lifecycle

```
pending → running → complete
                  → failed
                  → cancelled
```

- **pending**: Task created, waiting in queue
- **running**: Agent is actively executing the task
- **complete**: Task finished successfully with result
- **failed**: Task encountered an error (auto-retryable)
- **cancelled**: Task manually cancelled by user/agent/system

## How Tasks Connect to Agents

The executor (`executor.ts`) bridges tasks and agents:

1. `executeTask(taskId, agent)` loads the task from the store
2. Builds a prompt from `task.title + description + context`
3. Calls `agent.chat(prompt)` — this triggers the **full agent processing pipeline**
4. `agent.chat()` automatically emits `session.complete` to Shre
5. Task result is stored and `task.completed` event is emitted

Every task execution = one agent session = one feedback loop cycle.

## Feedback Loop Integration

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

## Priority Queue

Tasks are processed by priority order:

| Priority | Order |
|----------|-------|
| critical | 0 (first) |
| high     | 1 |
| normal   | 2 (default) |
| low      | 3 (last) |

Use `TaskScheduler` for automatic priority-ordered processing:

```typescript
import { TaskScheduler } from './scheduler.js';

const scheduler = new TaskScheduler();
scheduler.enqueue(task);
scheduler.start(agent); // processes queue in priority order
```

## REST API

Mount the router on your Express app:

```typescript
import { createTaskRouter } from './api.js';
app.use('/tasks', createTaskRouter(() => agent));
```

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tasks` | Create a task |
| `GET` | `/tasks` | List tasks (query: tenantId, status, agentId, priority) |
| `GET` | `/tasks/:id` | Get a single task |
| `PUT` | `/tasks/:id` | Update a task |
| `POST` | `/tasks/:id/execute` | Execute task immediately with agent |
| `POST` | `/tasks/:id/cancel` | Cancel a task |
| `GET` | `/tasks/:id/logs` | Get task execution logs |
| `POST` | `/tasks/batch` | Create + execute multiple tasks |

### Create Task

```bash
curl -X POST http://localhost:5500/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Analyze last month sales",
    "description": "Pull sales data and generate summary report",
    "agentId": "AROS",
    "tenantId": "default",
    "createdBy": "user",
    "priority": "high",
    "tags": ["analytics", "sales"]
  }'
```

## Subtask Pattern

Tasks can have parent-child relationships:

```typescript
const parent = createTask({ title: 'Monthly report', ... });
const sub1 = createTask({ title: 'Gather data', parentTaskId: parent.id, ... });
const sub2 = createTask({ title: 'Generate charts', parentTaskId: parent.id, ... });
```

Parent tasks track subtask IDs in `task.subtasks[]`.

## Shre Task Directives

Shre can create tasks via soul directives. A directive of type `soul.update` can include task definitions in the context, which the agent processes through the normal feedback loop.

## Agent Tool

The agent can manage tasks via the `/tasks` tool:

```
/tasks create: Analyze sales | Pull last month data and summarize
/tasks list
/tasks get <taskId>
/tasks complete <taskId>
/tasks cancel <taskId>
```

## Storage

- **Primary**: In-memory `Map<string, Task>` (fast, process-scoped)
- **Persistence**: JSON files at `./data/tasks/{tenantId}/{taskId}.json`
- **Production**: Swap store.ts internals for CortexService (PostgreSQL)
