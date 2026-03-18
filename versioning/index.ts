import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SemVer } from './types.js';

const CONFIG_PATH = join(process.cwd(), 'aros.config.json');

function loadConfig(): Record<string, any> {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * Read current platform, core, and UI versions from aros.config.json.
 */
export function getCurrentVersions(): { platform: SemVer; core: SemVer; ui: SemVer } {
  const config = loadConfig();
  return {
    platform: config.platform?.version ?? '0.0.0',
    core: config.core?.version ?? '0.0.0',
    ui: config.core?.uiVersion ?? '0.0.0',
  };
}

/**
 * Write a new version for core or UI back to aros.config.json.
 */
export function recordVersion(type: 'core' | 'ui', version: SemVer): void {
  const config = loadConfig();
  if (type === 'core') {
    config.core.version = version;
  } else {
    config.core.uiVersion = version;
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`[versioning] Recorded ${type} version: ${version}`);
}

export * from './types.js';
export * from './semver.js';
