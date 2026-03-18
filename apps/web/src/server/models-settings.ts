/**
 * GET/POST /api/settings/models
 * Reads and writes models.config.json in the config directory.
 * No remote calls — purely local file I/O.
 * models.config.json is in .gitignore (contains user API keys).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Request, Response, Router } from 'express';

const CONFIG_DIR = process.env.AROS_CONFIG_DIR || join(process.cwd(), '.aros-data');
const CONFIG_FILE = join(CONFIG_DIR, 'models.config.json');

interface ModelProvider {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
  label: string;
  model: string;
  apiKey?: string;
  endpoint?: string;
  isActive: boolean;
}

interface ModelsConfig {
  active: string;
  providers: ModelProvider[];
}

function readConfig(): ModelsConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { active: '', providers: [] };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { active: '', providers: [] };
  }
}

function writeConfig(config: ModelsConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function registerModelsRoutes(router: Router): void {
  // GET /api/settings/models
  router.get('/settings/models', (_req: Request, res: Response) => {
    const config = readConfig();
    res.json(config);
  });

  // POST /api/settings/models
  router.post('/settings/models', (req: Request, res: Response) => {
    const { providers, active } = req.body as ModelsConfig;

    if (!Array.isArray(providers)) {
      res.status(400).json({ error: 'providers must be an array' });
      return;
    }

    const config: ModelsConfig = { active: active || '', providers };
    writeConfig(config);
    res.json({ ok: true });
  });
}
