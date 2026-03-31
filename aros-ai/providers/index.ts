import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LLMProvider {
  name: string;
  chat(messages: Array<{ role: string; content: string }>, options?: LLMOptions): Promise<string>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{ name: string; description: string }>;
}

const ROUTER_URL = process.env.SHRE_ROUTER_URL || 'https://127.0.0.1:5497';

/**
 * Shre Router provider — all AROS AI routes through shre-router for
 * unified cost tracking, budget enforcement, and model selection.
 */
export class ShreRouterProvider implements LLMProvider {
  name = 'shre-router';
  private tenantId?: string;

  constructor(tenantId?: string) {
    this.tenantId = tenantId;
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: LLMOptions,
  ): Promise<string> {
    const systemContent = messages.find((m) => m.role === 'system')?.content;
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: 'auto',
      stream: false,
      maxTokens: options?.maxTokens ?? 4096,
      agentId: 'aros',
      messages: otherMessages,
      metadata: { taskType: 'conversation' },
    };
    if (systemContent) body.systemPrompt = systemContent;
    if (this.tenantId) body.tenantId = this.tenantId;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.tenantId) headers['x-tenant-id'] = this.tenantId;

    const res = await fetch(`${ROUTER_URL}/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`shre-router error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    return (
      data.content?.[0]?.text ||
      data.message?.content ||
      data.choices?.[0]?.message?.content ||
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      ''
    );
  }
}

/**
 * Get the configured LLM provider. All models route through shre-router.
 */
export function getProvider(tenantId?: string): LLMProvider {
  return new ShreRouterProvider(tenantId);
}
