import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emitSessionComplete,
  emitBehaviorDrift,
  startSnapshotSchedule,
  stopSnapshotSchedule,
} from './shre-control/events.js';
import type { AgentBrain } from './adp/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface AgentConfig {
  name: string;
  model: string;
  role: string;
  description: string;
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgentTool {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

interface SoulConfig {
  [key: string]: unknown;
}

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  artifacts?: string[];
  toolsUsed?: string[];
  tokensUsed?: number;
}

/**
 * AROS AI Agent — the platform driver.
 *
 * She is the platform. Not an assistant to the platform.
 * She manages marketplace, updates, identity, configuration, conversation, and tasks.
 *
 * Feedback loop:
 *   chat() → emitSessionComplete → Shre auto-pulls brain
 *   updateSoul() → emitBehaviorDrift → Shre logs + soul backup
 *   exportBrain() → scheduled every 6h via startSnapshotSchedule
 */
export class ArosAgent {
  private config: AgentConfig;
  private soul: SoulConfig;
  private soulText: string;
  private tools: Map<string, AgentTool> = new Map();
  private conversationHistory: AgentMessage[] = [];
  private sessionCount = 0;
  private startedAt: string;

  constructor() {
    const platformConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'aros.config.json'), 'utf8'),
    );
    this.soulText = existsSync(join(__dirname, 'SOUL.md'))
      ? readFileSync(join(__dirname, 'SOUL.md'), 'utf8')
      : 'You are AROS. You are the platform.';

    this.soul = { raw: this.soulText };
    this.config = platformConfig.agent;
    this.startedAt = new Date().toISOString();

    this.conversationHistory.push({
      role: 'system',
      content: this.buildSystemPrompt(),
      timestamp: this.startedAt,
    });

    // Wire Shre snapshot schedule — emit brain.snapshot every 6h
    startSnapshotSchedule(this.config.name, () => this.exportBrain());

    console.log(`[ArosAgent] ${this.config.name} online — Shre snapshot schedule started`);
  }

  private buildSystemPrompt(): string {
    return [
      `You are ${this.config.name}. ${this.config.description}`,
      '',
      '--- SOUL ---',
      this.soulText,
      '--- END SOUL ---',
      '',
      `Available tools: ${[...this.tools.keys()].join(', ') || 'none loaded yet'}`,
      '',
      'You respond concisely. You act decisively. You are the platform.',
    ].join('\n');
  }

  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    this.conversationHistory[0] = {
      role: 'system',
      content: this.buildSystemPrompt(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process an operator message.
   * After response: emits session.complete → Shre auto-pulls brain.
   */
  async chat(message: string): Promise<string> {
    const userMsg: AgentMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    this.conversationHistory.push(userMsg);

    // Check for shortcut: /tool, @mention, #node
    const response = await this.processWithTools(message);

    const assistantMsg: AgentMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };
    this.conversationHistory.push(assistantMsg);
    this.sessionCount++;

    // Build transcript for Shre
    const transcript = JSON.stringify([userMsg, assistantMsg]);

    // Emit session.complete → Shre receives and auto-pulls brain
    emitSessionComplete(this.config.name, transcript);
    console.log(`[ArosAgent] session.complete emitted (session #${this.sessionCount})`);

    return response;
  }

  /**
   * Process message with tool invocation if applicable.
   */
  private async processWithTools(message: string): Promise<string> {
    // Check for /tool shortcut
    const toolMatch = message.match(/\/(\w+)/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const tool = this.tools.get(toolName);
      if (tool) {
        try {
          const result = await tool.execute({ message });
          return `[${toolName}] ${result}`;
        } catch (err) {
          return `[${toolName}] Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
    }

    // Default response (real LLM call goes here)
    return `[${this.config.name}] ${message}`;
  }

  /**
   * Update soul — emits behavior.drift to Shre.
   */
  async updateSoul(patch: Partial<SoulConfig>): Promise<void> {
    const previous = { ...this.soul };
    Object.assign(this.soul, patch);

    // Update soulText if raw provided
    if (patch.raw && typeof patch.raw === 'string') {
      this.soulText = patch.raw;
      // Rebuild system prompt
      this.conversationHistory[0] = {
        role: 'system',
        content: this.buildSystemPrompt(),
        timestamp: new Date().toISOString(),
      };
    }

    // Emit behavior.drift → Shre logs + triggers soul backup
    emitBehaviorDrift(this.config.name, { previous, updated: patch });
    console.log('[ArosAgent] soul updated — behavior.drift emitted');
  }

  /**
   * Execute a task by ID — loads from store, runs via chat(), returns result.
   * This bridges the task management system into the agent feedback loop.
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    // Dynamic import to avoid circular dependency at module load time
    const { getTask, appendLog, completeTask, failTask } = await import('../tasks/store.js');
    const { emitTaskEvent } = await import('../tasks/events.js');

    const task = getTask(taskId);
    if (!task) {
      return { success: false, output: '', error: `Task ${taskId} not found` };
    }

    try {
      appendLog(taskId, 'info', `Agent ${this.config.name} executing task`, this.config.name);

      // Build prompt from task context
      const prompt = [
        `Task: ${task.title}`,
        task.description ? `Description: ${task.description}` : '',
        Object.keys(task.context).length > 0 ? `Context: ${JSON.stringify(task.context)}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      // chat() triggers the full feedback loop: response → emitSessionComplete → Shre
      const response = await this.chat(prompt);

      const result: TaskResult = {
        success: true,
        output: response,
        toolsUsed: [],
      };

      completeTask(taskId, {
        success: true,
        output: response,
        toolsUsed: [],
      });

      emitTaskEvent({
        type: 'task.completed',
        taskId,
        agentId: this.config.name,
        tenantId: task.tenantId,
        timestamp: new Date().toISOString(),
        data: { result },
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failTask(taskId, error);

      emitTaskEvent({
        type: 'task.failed',
        taskId,
        agentId: this.config.name,
        tenantId: task.tenantId,
        timestamp: new Date().toISOString(),
        data: { error },
      });

      return { success: false, output: '', error };
    }
  }

  /**
   * Export full brain snapshot — called by Shre snapshot schedule.
   */
  exportBrain(): AgentBrain {
    return {
      agentId: this.config.name,
      tenantId: 'default',
      lastUpdated: new Date().toISOString(),
      soul: this.soul,
      skills: [...this.tools.keys()].map((name) => ({ name })),
      memory: {
        longTerm: this.conversationHistory
          .filter((m) => m.role !== 'system')
          .slice(-100)
          .map((m) => m.content)
          .join('\n---\n'),
        recent: [],
      },
      sessions: [],
      datasets: [],
      stats: {
        totalSessions: this.sessionCount,
        lastActive: this.conversationHistory.at(-1)?.timestamp ?? this.startedAt,
        topTopics: [],
        behaviorScore: 1.0,
        version: '1.0.0',
      },
    };
  }

  /**
   * Import brain from Shre (restore).
   */
  async importBrain(brain: AgentBrain): Promise<void> {
    if (brain.soul) Object.assign(this.soul, brain.soul);
    if (brain.soul?.raw && typeof brain.soul.raw === 'string') {
      this.soulText = brain.soul.raw as string;
    }
    console.log(`[ArosAgent] Brain imported from snapshot ${brain.lastUpdated}`);
  }

  /**
   * Graceful shutdown — stop snapshot schedule.
   */
  shutdown(): void {
    stopSnapshotSchedule();
    console.log(`[ArosAgent] ${this.config.name} shutting down`);
  }

  get name(): string {
    return this.config.name;
  }

  get model(): string {
    return this.config.model;
  }

  get history(): readonly AgentMessage[] {
    return this.conversationHistory;
  }
}
