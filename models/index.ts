import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LLMProvider } from '../aros-ai/providers/index.js';
import type { ModelConfig, ModelProvider } from './types.js';

// ── Config loading ──────────────────────────────────────────────────────────

interface ArosConfig {
  models: {
    provider: ModelProvider;
    metered: boolean;
    byom: {
      enabled: boolean;
      provider: ModelProvider | '';
      apiKey: string;
      model: string;
      endpoint: string;
    };
  };
}

function loadConfig(): ArosConfig {
  const raw = readFileSync(join(process.cwd(), 'aros.config.json'), 'utf8');
  return JSON.parse(raw);
}

// ── Audit / metering stub ───────────────────────────────────────────────────

function auditLog(event: string, data: Record<string, unknown>): void {
  console.log(`[models:audit] ${event}`, JSON.stringify(data));
}

// ── Provider factories ──────────────────────────────────────────────────────

function createOpenAIProvider(apiKey: string, model: string, endpoint?: string): LLMProvider {
  const baseUrl = endpoint || 'https://api.openai.com/v1';
  return {
    name: 'openai',
    async chat(messages, options) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || options?.model || 'gpt-4o',
          messages,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content ?? '';
    },
  };
}

function createAnthropicProvider(apiKey: string, model: string): LLMProvider {
  return {
    name: 'anthropic',
    async chat(messages, options) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || options?.model || 'claude-opus-4-6',
          max_tokens: options?.maxTokens ?? 4096,
          messages: messages.filter((m) => m.role !== 'system'),
          system: messages.find((m) => m.role === 'system')?.content,
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API error (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as { content: Array<{ text: string }> };
      return data.content[0]?.text ?? '';
    },
  };
}

function createOllamaProvider(model: string, endpoint: string): LLMProvider {
  const baseUrl = endpoint || 'http://localhost:11434';
  return {
    name: 'ollama',
    async chat(messages, options) {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || options?.model || 'llama3',
          messages,
          stream: false,
        }),
      });
      if (!res.ok) throw new Error(`Ollama API error (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as { message: { content: string } };
      return data.message?.content ?? '';
    },
  };
}

function createMIB007Provider(): LLMProvider {
  // MIB007 hosted — delegates to the platform's built-in Claude provider
  // Metering is handled externally via trackUsage()
  return {
    name: 'mib007',
    async chat(messages, options) {
      const { ClaudeProvider } = await import('../aros-ai/providers/index.js');
      const provider = new ClaudeProvider();
      return provider.chat(messages, options);
    },
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Read model configuration from aros.config.json.
 */
export function getModelConfig(): ModelConfig {
  const config = loadConfig();
  return {
    provider: config.models.provider ?? 'mib007',
    metered: config.models.metered ?? true,
    byom: {
      enabled: config.models.byom?.enabled ?? false,
      provider: config.models.byom?.provider ?? '',
      apiKey: config.models.byom?.apiKey ?? '',
      model: config.models.byom?.model ?? '',
      endpoint: config.models.byom?.endpoint ?? '',
    },
  };
}

/**
 * Resolve the correct LLM provider based on config.
 *
 * - byom.enabled=false → MIB007 hosted (metered)
 * - byom.enabled=true  → customer's own provider, no MIB007 metering
 */
export function resolveProvider(): LLMProvider {
  const mc = getModelConfig();

  if (!mc.byom.enabled) {
    auditLog('provider_resolved', { provider: 'mib007', metered: true });
    return createMIB007Provider();
  }

  const provider = mc.byom.provider;
  auditLog('provider_resolved', { provider, metered: false, byom: true });

  switch (provider) {
    case 'openai':
      return createOpenAIProvider(mc.byom.apiKey, mc.byom.model, mc.byom.endpoint);
    case 'anthropic':
      return createAnthropicProvider(mc.byom.apiKey, mc.byom.model);
    case 'ollama':
      return createOllamaProvider(mc.byom.model, mc.byom.endpoint);
    case 'custom':
      // Custom = any OpenAI-compatible endpoint
      return createOpenAIProvider(mc.byom.apiKey, mc.byom.model, mc.byom.endpoint);
    default:
      throw new Error(`Unsupported BYOM provider: "${provider}". Use openai, anthropic, ollama, or custom.`);
  }
}

/**
 * Track token usage for metered (MIB007) requests.
 * Posts to the MIB007 meter endpoint when metering is active.
 */
export async function trackUsage(tokens: number, model: string): Promise<void> {
  const mc = getModelConfig();

  if (!mc.metered || mc.byom.enabled) {
    return; // no metering for BYOM
  }

  auditLog('usage_tracked', { tokens, model });

  try {
    await fetch('https://meter.mib007.io/v1/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens,
        model,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Metering failures should not break the request
    console.error('[models] Failed to post usage to MIB007 meter:', err);
  }
}

export type { ModelConfig, ModelProvider } from './types.js';
