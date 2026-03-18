import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emitSessionComplete, emitBehaviorDrift, startSnapshotSchedule } from './shre-control/events.js';
import type { AgentBrain } from './adp/types.js';

interface AgentConfig {
  name: string;
  model: string;
  role: string;
  description: string;
  soul: string;
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AgentTool {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

/**
 * AROS AI Agent — the platform driver.
 *
 * She is the platform. Not an assistant to the platform.
 * She manages marketplace, updates, identity, configuration, and conversation.
 */
export class ArosAgent {
  private config: AgentConfig;
  private tools: Map<string, AgentTool> = new Map();
  private conversationHistory: AgentMessage[] = [];

  constructor() {
    const platformConfig = JSON.parse(readFileSync(join(process.cwd(), 'aros.config.json'), 'utf8'));
    const soul = readFileSync(join(__dirname, 'SOUL.md'), 'utf8');

    this.config = {
      ...platformConfig.agent,
      soul,
    };

    // System prompt derived from SOUL.md + platform context
    this.conversationHistory.push({
      role: 'system',
      content: this.buildSystemPrompt(),
    });

    // Start scheduled brain snapshots (every 6h) → Shre control channel
    startSnapshotSchedule(this.config.name, () => this.exportBrain());
  }

  private buildSystemPrompt(): string {
    return [
      `You are ${this.config.name}. ${this.config.description}`,
      '',
      '--- SOUL ---',
      this.config.soul,
      '--- END SOUL ---',
      '',
      `Available tools: ${[...this.tools.keys()].join(', ') || 'none loaded yet'}`,
      '',
      'You respond concisely. You act decisively. You are the platform.',
    ].join('\n');
  }

  /**
   * Register a tool the agent can invoke.
   */
  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    // Rebuild system prompt to include new tool
    this.conversationHistory[0] = { role: 'system', content: this.buildSystemPrompt() };
  }

  /**
   * Process an operator message and return the agent's response.
   */
  async chat(message: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: message });

    // In production, this calls the configured LLM with tool use.
    // For scaffold, return a structured acknowledgment.
    const response = `[${this.config.name}] Received: "${message}". Agent backend not yet connected to LLM provider.`;

    this.conversationHistory.push({ role: 'assistant', content: response });

    // Emit session.complete → Shre control channel
    const transcript = this.conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    emitSessionComplete(this.config.name, transcript);

    return response;
  }

  /**
   * Get the agent's display name (respects whitelabel).
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get the configured model.
   */
  get model(): string {
    return this.config.model;
  }

  /**
   * Get conversation history.
   */
  get history(): readonly AgentMessage[] {
    return this.conversationHistory;
  }

  /**
   * Export the current brain state for Shre snapshots.
   */
  exportBrain(): AgentBrain {
    return {
      agentId: this.config.name,
      soul: this.config.soul,
      model: this.config.model,
      tools: [...this.tools.keys()],
      conversationHistory: [...this.conversationHistory],
    };
  }

  /**
   * Update the agent's soul configuration.
   * Emits behavior.drift to Shre control channel.
   */
  updateSoul(patch: string): void {
    const previous = this.config.soul;
    this.config.soul = patch;
    // Rebuild system prompt with new soul
    this.conversationHistory[0] = { role: 'system', content: this.buildSystemPrompt() };
    // Notify Shre of behavior drift
    emitBehaviorDrift(this.config.name, { previous, updated: patch });
  }
}
