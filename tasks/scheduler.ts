import type { ArosAgent } from '../aros-ai/agent.js';
import type { Task } from './types.js';
import { executeTask } from './executor.js';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Task queue scheduler — processes tasks in priority order.
 *
 * After each task: logs completion, emits events, triggers the agent feedback loop
 * (all handled by executeTask → agent.chat → emitSessionComplete).
 */
export class TaskScheduler {
  private queue: Task[] = [];
  private running = false;
  private agent: ArosAgent | null = null;

  enqueue(task: Task): void {
    this.queue.push(task);
    console.log(`[TaskScheduler] Enqueued task ${task.id} (${task.priority}): ${task.title}`);
  }

  getPrioritized(): Task[] {
    return [...this.queue].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
    );
  }

  getQueue(): Task[] {
    return [...this.queue];
  }

  start(agent: ArosAgent): void {
    this.agent = agent;
    this.running = true;
    console.log(`[TaskScheduler] Started — processing queue with agent ${agent.name}`);
    this.processLoop();
  }

  stop(): void {
    this.running = false;
    this.agent = null;
    console.log('[TaskScheduler] Stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      const sorted = this.getPrioritized();
      if (sorted.length === 0) {
        // No tasks — wait and check again
        await this.sleep(1000);
        continue;
      }

      const task = sorted[0];
      // Remove from queue
      const idx = this.queue.findIndex((t) => t.id === task.id);
      if (idx >= 0) this.queue.splice(idx, 1);

      console.log(`[TaskScheduler] Processing task ${task.id}: ${task.title}`);

      try {
        // executeTask → agent.chat → emitSessionComplete → Shre feedback loop
        await executeTask(task.id, this.agent!);
        console.log(`[TaskScheduler] Task ${task.id} completed`);
      } catch (err) {
        console.error(
          `[TaskScheduler] Task ${task.id} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
