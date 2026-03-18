import { Router, json } from 'express';
import {
  createTask,
  getTask,
  listTasks,
  updateTask,
  cancelTask,
  type TaskFilters,
} from './store.js';
import { executeTask } from './executor.js';
import { emitTaskEvent } from './events.js';
import type { TaskCreateInput } from './types.js';

/**
 * Express router for task management REST API.
 *
 * Mount: app.use('/tasks', taskRouter(agent))
 *
 * Requires an ArosAgent instance to execute tasks —
 * task execution feeds the full agent feedback loop.
 */
export function createTaskRouter(getAgent: () => import('../aros-ai/agent.js').ArosAgent) {
  const router = Router();
  router.use(json());

  // POST /tasks — create a task
  router.post('/', (req, res) => {
    try {
      const input: TaskCreateInput = req.body;
      if (!input.title || !input.agentId || !input.tenantId || !input.createdBy) {
        res.status(400).json({ error: 'Missing required fields: title, agentId, tenantId, createdBy' });
        return;
      }

      const task = createTask(input);
      emitTaskEvent({
        type: 'task.created',
        taskId: task.id,
        agentId: task.agentId,
        tenantId: task.tenantId,
        timestamp: task.createdAt,
      });

      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /tasks — list tasks
  router.get('/', (req, res) => {
    const tenantId = (req.query.tenantId as string) ?? 'default';
    const filters: TaskFilters = {};
    if (req.query.status) filters.status = req.query.status as TaskFilters['status'];
    if (req.query.agentId) filters.agentId = req.query.agentId as string;
    if (req.query.priority) filters.priority = req.query.priority as TaskFilters['priority'];

    res.json(listTasks(tenantId, filters));
  });

  // GET /tasks/:id — get task
  router.get('/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  });

  // PUT /tasks/:id — update task
  router.put('/:id', (req, res) => {
    try {
      const task = updateTask(req.params.id, req.body);
      res.json(task);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /tasks/:id/execute — execute task with agent
  router.post('/:id/execute', async (req, res) => {
    const task = getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    try {
      const agent = getAgent();
      await executeTask(task.id, agent);
      const updated = getTask(task.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /tasks/:id/cancel — cancel task
  router.post('/:id/cancel', (req, res) => {
    try {
      const task = cancelTask(req.params.id);
      emitTaskEvent({
        type: 'task.cancelled',
        taskId: task.id,
        agentId: task.agentId,
        tenantId: task.tenantId,
        timestamp: new Date().toISOString(),
      });
      res.json(task);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /tasks/:id/logs — get task logs
  router.get('/:id/logs', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task.logs);
  });

  // POST /tasks/batch — create + execute multiple tasks
  router.post('/batch', async (req, res) => {
    const inputs: TaskCreateInput[] = req.body.tasks;
    if (!Array.isArray(inputs)) {
      res.status(400).json({ error: 'Expected { tasks: TaskCreateInput[] }' });
      return;
    }

    const agent = getAgent();
    const results = [];

    for (const input of inputs) {
      const task = createTask(input);
      emitTaskEvent({
        type: 'task.created',
        taskId: task.id,
        agentId: task.agentId,
        tenantId: task.tenantId,
        timestamp: task.createdAt,
      });

      try {
        await executeTask(task.id, agent);
        results.push(getTask(task.id));
      } catch {
        results.push(getTask(task.id));
      }
    }

    res.json(results);
  });

  return router;
}
