import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Task,
  TaskCreateInput,
  TaskResult,
  TaskStatus,
  TaskPriority,
  TaskLog,
} from './types.js';

// ── In-memory store (swap for DB in production) ─────────────────────────────

const tasks = new Map<string, Task>();
const DATA_DIR = join(process.cwd(), 'data', 'tasks');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function persistTask(task: Task): void {
  try {
    const tenantDir = join(DATA_DIR, task.tenantId);
    ensureDir(tenantDir);
    writeFileSync(join(tenantDir, `${task.id}.json`), JSON.stringify(task, null, 2));
  } catch {
    // Silent fail on persistence — in-memory is primary
  }
}

// ── CRUD operations ─────────────────────────────────────────────────────────

export function createTask(input: TaskCreateInput): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    status: 'pending',
    priority: input.priority ?? 'normal',
    agentId: input.agentId,
    tenantId: input.tenantId,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    parentTaskId: input.parentTaskId,
    subtasks: [],
    tags: input.tags ?? [],
    context: input.context ?? {},
    logs: [],
  };

  tasks.set(task.id, task);

  // Link to parent if applicable
  if (input.parentTaskId) {
    const parent = tasks.get(input.parentTaskId);
    if (parent) {
      parent.subtasks = parent.subtasks ?? [];
      parent.subtasks.push(task.id);
      parent.updatedAt = now;
      persistTask(parent);
    }
  }

  persistTask(task);
  return task;
}

export function getTask(taskId: string): Task | null {
  return tasks.get(taskId) ?? null;
}

export interface TaskFilters {
  status?: TaskStatus;
  agentId?: string;
  priority?: TaskPriority;
}

export function listTasks(tenantId: string, filters?: TaskFilters): Task[] {
  const result: Task[] = [];
  for (const task of tasks.values()) {
    if (task.tenantId !== tenantId) continue;
    if (filters?.status && task.status !== filters.status) continue;
    if (filters?.agentId && task.agentId !== filters.agentId) continue;
    if (filters?.priority && task.priority !== filters.priority) continue;
    result.push(task);
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateTask(taskId: string, patch: Partial<Task>): Task {
  const task = tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  Object.assign(task, patch, { updatedAt: new Date().toISOString() });
  persistTask(task);
  return task;
}

export function appendLog(
  taskId: string,
  level: TaskLog['level'],
  message: string,
  agentId?: string,
): void {
  const task = tasks.get(taskId);
  if (!task) return;

  task.logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
    agentId,
  });
  task.updatedAt = new Date().toISOString();
  persistTask(task);
}

export function completeTask(taskId: string, result: TaskResult): Task {
  const task = tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const now = new Date().toISOString();
  task.status = 'complete';
  task.completedAt = now;
  task.updatedAt = now;
  task.result = result;
  task.logs.push({ timestamp: now, level: 'info', message: 'Task completed' });

  persistTask(task);
  return task;
}

export function failTask(taskId: string, error: string): Task {
  const task = tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const now = new Date().toISOString();
  task.status = 'failed';
  task.completedAt = now;
  task.updatedAt = now;
  task.result = { success: false, output: '', error };
  task.logs.push({ timestamp: now, level: 'error', message: `Task failed: ${error}` });

  persistTask(task);
  return task;
}

export function cancelTask(taskId: string): Task {
  const task = tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const now = new Date().toISOString();
  task.status = 'cancelled';
  task.completedAt = now;
  task.updatedAt = now;
  task.logs.push({ timestamp: now, level: 'info', message: 'Task cancelled' });

  persistTask(task);
  return task;
}
