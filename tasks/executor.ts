import type { ArosAgent } from '../aros-ai/agent.js';
import { getTask, updateTask, appendLog, completeTask, failTask } from './store.js';
import { emitTaskEvent } from './events.js';
import type { TaskResult } from './types.js';

/**
 * Execute a task using the assigned agent.
 * This is the bridge between task management and the agent feedback loop.
 *
 * Flow:
 *   executeTask → agent.chat(prompt) → emitSessionComplete → Shre auto-pulls brain
 */
export async function executeTask(taskId: string, agent: ArosAgent): Promise<void> {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const now = new Date().toISOString();

  // Mark running
  updateTask(taskId, { status: 'running', startedAt: now });
  emitTaskEvent({
    type: 'task.started',
    taskId,
    agentId: task.agentId,
    tenantId: task.tenantId,
    timestamp: now,
  });
  appendLog(taskId, 'info', 'Task execution started', agent.name);

  try {
    // Build prompt from task fields
    const prompt = [
      `Task: ${task.title}`,
      task.description ? `Description: ${task.description}` : '',
      Object.keys(task.context).length > 0 ? `Context: ${JSON.stringify(task.context)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // agent.chat() triggers the full feedback loop:
    //   response → emitSessionComplete → Shre auto-pulls brain
    const response = await agent.chat(prompt);

    appendLog(taskId, 'info', `Agent response: ${response.slice(0, 200)}`, agent.name);

    const result: TaskResult = {
      success: true,
      output: response,
      toolsUsed: [],
    };

    completeTask(taskId, result);
    emitTaskEvent({
      type: 'task.completed',
      taskId,
      agentId: task.agentId,
      tenantId: task.tenantId,
      timestamp: new Date().toISOString(),
      data: { output: response.slice(0, 500) },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    appendLog(taskId, 'error', `Execution failed: ${error}`, agent.name);
    failTask(taskId, error);
    emitTaskEvent({
      type: 'task.failed',
      taskId,
      agentId: task.agentId,
      tenantId: task.tenantId,
      timestamp: new Date().toISOString(),
      data: { error },
    });
  }
}

/**
 * Execute multiple tasks in sequence for an agent.
 */
export async function executeTaskQueue(taskIds: string[], agent: ArosAgent): Promise<void> {
  for (const taskId of taskIds) {
    await executeTask(taskId, agent);
  }
}

/**
 * Execute tasks in parallel (up to concurrency limit).
 */
export async function executeTasksParallel(
  taskIds: string[],
  agent: ArosAgent,
  concurrency = 3,
): Promise<void> {
  const queue = [...taskIds];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    // Fill up to concurrency limit
    while (queue.length > 0 && running.length < concurrency) {
      const taskId = queue.shift()!;
      const promise = executeTask(taskId, agent).then(() => {
        const idx = running.indexOf(promise);
        if (idx >= 0) running.splice(idx, 1);
      });
      running.push(promise);
    }

    // Wait for at least one to complete
    if (running.length > 0) {
      await Promise.race(running);
    }
  }
}
