/**
 * BYOM (Bring Your Own Model) enforcement gate.
 * AROS never provides model API keys. Users must configure their own.
 * This check runs at startup and blocks if no model is configured.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
  apiKey?: string; // Not required for ollama
  endpoint?: string; // Required for ollama/custom
  model: string;
  label?: string;
}

export interface ModelsConfig {
  active: string; // provider id of active model
  providers: ModelConfig[];
}

function loadModelsConfig(configDir: string): ModelsConfig | null {
  const path = join(configDir, 'models.config.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function assertByom(configDir: string = process.cwd()): void {
  const config = loadModelsConfig(configDir);

  if (!config || !config.providers || config.providers.length === 0) {
    console.error(`
╔══════════════════════════════════════════════════════════════╗
║              AROS — MODEL CONFIGURATION REQUIRED             ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  AROS does not include AI model API keys.                    ║
║  You must configure your own model provider to proceed.      ║
║                                                              ║
║  Supported providers:                                        ║
║    • OpenAI (https://platform.openai.com)                    ║
║    • Anthropic (https://console.anthropic.com)               ║
║    • Google Gemini (https://aistudio.google.com)             ║
║    • Ollama (local, no API key needed)                       ║
║    • Any OpenAI-compatible endpoint                          ║
║                                                              ║
║  Setup: Open AROS → Settings → AI Models → Add Provider      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  const active = config.providers.find((p) => p.provider === config.active);
  if (!active) {
    console.error('[aros] No active model provider found in models.config.json');
    process.exit(1);
  }

  // Validate key presence (ollama and custom don't require one)
  if (active.provider !== 'ollama' && active.provider !== 'custom') {
    if (!active.apiKey || active.apiKey.trim() === '') {
      console.error(`[aros] Active provider "${active.provider}" has no API key configured.`);
      console.error('[aros] Open Settings → AI Models to add your key.');
      process.exit(1);
    }
  }

  console.log(`[aros] Model: ${active.provider}/${active.model} ✓`);
}
