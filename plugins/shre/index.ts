import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthProvider } from './LocalProvider.js';
import { LocalProvider } from './LocalProvider.js';
import { ShreProvider } from './ShreProvider.js';

interface ArosConfig {
  shre: {
    enabled: boolean;
    endpoint: string;
    fallback: 'local' | 'error';
  };
}

function loadConfig(): ArosConfig {
  const raw = readFileSync(join(process.cwd(), 'aros.config.json'), 'utf8');
  return JSON.parse(raw);
}

let _provider: AuthProvider | null = null;

/**
 * Returns the active auth provider based on aros.config.json.
 *
 * - Shre enabled + endpoint configured → ShreProvider
 * - Shre disabled → LocalProvider
 * - Shre enabled but no endpoint + fallback=local → LocalProvider with warning
 * - Shre enabled but no endpoint + fallback=error → throws
 */
export function getAuthProvider(): AuthProvider {
  if (_provider) return _provider;

  const config = loadConfig();

  if (!config.shre.enabled) {
    _provider = new LocalProvider();
    return _provider;
  }

  if (config.shre.endpoint) {
    _provider = new ShreProvider({ endpoint: config.shre.endpoint });
    return _provider;
  }

  // Shre enabled but no endpoint — use fallback strategy
  if (config.shre.fallback === 'local') {
    console.warn('[shre] Shre enabled but no endpoint configured — falling back to LocalProvider');
    _provider = new LocalProvider();
    return _provider;
  }

  throw new Error(
    'Shre is enabled but no endpoint is configured and fallback is set to "error". ' +
      'Set shre.endpoint in aros.config.json or set shre.fallback to "local".',
  );
}

/** Reset the cached provider (useful for testing or config reload). */
export function resetProvider(): void {
  _provider = null;
}

export type { AuthProvider };
export { LocalProvider, ShreProvider };
