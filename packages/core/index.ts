/**
 * @aros/core — Thin wrapper around @mib007/core with AROS-specific overrides.
 *
 * All platform code imports from here, never directly from @mib007/core.
 * This gives us a single point to:
 * - Override defaults for AROS context
 * - Inject whitelabel configuration
 * - Add AROS-specific utilities
 * - Version-gate MIB007 features
 */

// Re-export everything from the MIB007 core
// export * from '@mib007/core';

// ── AROS Overrides ─────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ArosPlatformConfig {
  platform: {
    name: string;
    version: string;
    description: string;
  };
  core: {
    source: string;
    version: string;
    autoUpdate: boolean;
    updateFeed: string;
    channel: string;
  };
  agent: {
    name: string;
    model: string;
    role: string;
    description: string;
  };
  shre: {
    enabled: boolean;
    endpoint: string;
    fallback: string;
  };
  whitelabel: {
    active: string;
    customizable: boolean;
  };
  marketplace: {
    registryUrl: string;
    autoSync: boolean;
  };
}

let _config: ArosPlatformConfig | null = null;

/**
 * Load and cache the platform configuration.
 */
export function getConfig(configPath?: string): ArosPlatformConfig {
  if (_config) return _config;
  const path = configPath ?? join(process.cwd(), 'aros.config.json');
  _config = JSON.parse(readFileSync(path, 'utf8'));
  return _config!;
}

/**
 * Get the active whitelabel configuration.
 */
export function getWhitelabelConfig(configPath?: string): Record<string, unknown> {
  const config = getConfig(configPath);
  const brandDir = join(process.cwd(), 'whitelabel', config.whitelabel.active);
  return JSON.parse(readFileSync(join(brandDir, 'config.json'), 'utf8'));
}

/**
 * Platform version string for user agents, headers, etc.
 */
export function getPlatformVersion(): string {
  const config = getConfig();
  return `${config.platform.name}/${config.platform.version} (core:${config.core.version})`;
}
