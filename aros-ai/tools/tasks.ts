import { createTask, listTasks, completeTask, cancelTask, getTask } from '../../tasks/store.js';
import { emitTaskEvent } from '../../tasks/events.js';

/**
 * Agent tool for task management.
 *
 * Allows the agent to create, list, and manage tasks via natural language.
 * e.g. "create a task to analyze last month's sales" → creates task
 * e.g. "what tasks are pending?" → lists pending tasks
 */
export const tasksTool = {
  name: 'tasks',
  description:
    'Create, list, and manage tasks. Use to schedule work, track progress, delegate to other agents.',

  async execute(params: Record<string, unknown>): Promise<string> {
    const message = String(params.message ?? '')
      .trim()
      .toLowerCase();

    // Parse action from message
    if (message.startsWith('create:') || message.startsWith('/tasks create:')) {
      return handleCreate(message, params);
    }

    if (
      message.includes('list') ||
      message.includes('pending') ||
      message.includes('what tasks') ||
      message.startsWith('/tasks list') ||
      message.startsWith('/tasks')
    ) {
      return handleList(params);
    }

    if (message.startsWith('complete ') || message.startsWith('/tasks complete ')) {
      return handleComplete(message);
    }

    if (message.startsWith('cancel ') || message.startsWith('/tasks cancel ')) {
      return handleCancel(message);
    }

    if (message.startsWith('get ') || message.startsWith('/tasks get ')) {
      return handleGet(message);
    }

    return 'Task commands: create:<title>|<description>, list, complete <taskId>, cancel <taskId>, get <taskId>';
  },
};

function handleCreate(message: string, params: Record<string, unknown>): string {
  const createMatch = message.match(/create:\s*(.+)/);
  if (!createMatch) return 'Usage: create: <title> | <description>';

  const parts = createMatch[1].split('|').map((s) => s.trim());
  const title = parts[0];
  const description = parts[1] ?? '';

  const task = createTask({
    title,
    description,
    agentId: String(params.agentId ?? 'AROS'),
    tenantId: String(params.tenantId ?? 'default'),
    createdBy: 'agent',
    tags: [],
  });

  emitTaskEvent({
    type: 'task.created',
    taskId: task.id,
    agentId: task.agentId,
    tenantId: task.tenantId,
    timestamp: task.createdAt,
  });

  return `Created task ${task.id}: "${task.title}" (${task.priority})`;
}

function handleList(params: Record<string, unknown>): string {
  const tenantId = String(params.tenantId ?? 'default');
  const tasks = listTasks(tenantId);

  if (tasks.length === 0) return 'No tasks found.';

  return tasks
    .slice(0, 20)
    .map((t) => `[${t.status}] ${t.id.slice(0, 8)}… — ${t.title} (${t.priority})`)
    .join('\n');
}

function handleComplete(message: string): string {
  const idMatch = message.match(/complete\s+(\S+)/);
  if (!idMatch) return 'Usage: complete <taskId>';

  try {
    const task = completeTask(idMatch[1], { success: true, output: 'Marked complete by agent' });
    return `Task ${task.id} marked complete.`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function handleCancel(message: string): string {
  const idMatch = message.match(/cancel\s+(\S+)/);
  if (!idMatch) return 'Usage: cancel <taskId>';

  try {
    const task = cancelTask(idMatch[1]);
    return `Task ${task.id} cancelled.`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function handleGet(message: string): string {
  const idMatch = message.match(/get\s+(\S+)/);
  if (!idMatch) return 'Usage: get <taskId>';

  const task = getTask(idMatch[1]);
  if (!task) return `Task ${idMatch[1]} not found.`;

  return [
    `Task: ${task.title}`,
    `Status: ${task.status} | Priority: ${task.priority}`,
    `Agent: ${task.agentId} | Created: ${task.createdAt}`,
    task.description ? `Description: ${task.description}` : '',
    task.result ? `Result: ${task.result.output.slice(0, 200)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
