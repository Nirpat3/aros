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
 * OpenAI provider — the default for AROS AI.
 */
export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
  }

  async chat(messages: Array<{ role: string; content: string }>, options?: LLMOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured. Set it in environment or pass to OpenAIProvider.');
    }

    // OpenAI expects system as the first message in the messages array
    const systemContent = messages.find((m) => m.role === 'system')?.content;
    const otherMessages = messages.filter((m) => m.role !== 'system');
    const openaiMessages = [
      ...(systemContent ? [{ role: 'system', content: systemContent }] : []),
      ...otherMessages,
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model ?? 'gpt-4o',
        max_tokens: options?.maxTokens ?? 4096,
        messages: openaiMessages,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

/**
 * Get the configured LLM provider based on aros.config.json.
 */
export function getProvider(): LLMProvider {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'aros.config.json'), 'utf8'));
  const model = config.agent.model ?? 'gpt-4o';

  if (model.startsWith('gpt')) {
    return new OpenAIProvider();
  }

  throw new Error(`Unsupported model: ${model}. Currently only OpenAI models are supported.`);
}
