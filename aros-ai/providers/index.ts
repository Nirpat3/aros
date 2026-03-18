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

/**
 * Anthropic Claude provider — the default for AROS AI.
 */
export class ClaudeProvider implements LLMProvider {
  name = 'claude';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  }

  async chat(messages: Array<{ role: string; content: string }>, options?: LLMOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured. Set it in environment or pass to ClaudeProvider.');
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options?.model ?? 'claude-opus-4-6',
        max_tokens: options?.maxTokens ?? 4096,
        messages: messages.filter((m) => m.role !== 'system'),
        system: messages.find((m) => m.role === 'system')?.content,
      }),
    });

    if (!res.ok) {
      throw new Error(`Claude API error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { content: Array<{ text: string }> };
    return data.content[0]?.text ?? '';
  }
}

/**
 * Get the configured LLM provider based on aros.config.json.
 */
export function getProvider(): LLMProvider {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'aros.config.json'), 'utf8'));
  const model = config.agent.model ?? 'claude-opus-4-6';

  if (model.startsWith('claude')) {
    return new ClaudeProvider();
  }

  throw new Error(`Unsupported model: ${model}. Currently only Claude models are supported.`);
}
