import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Node, NodeCategory, RegistryResponse } from './types.js';

interface ArosConfig {
  platform: { version: string };
  marketplace: {
    registryUrl: string;
    autoSync: boolean;
  };
}

const CONFIG_PATH = join(process.cwd(), 'aros.config.json');
const CACHE_PATH = join(process.cwd(), '.aros-data', 'marketplace-cache.json');

function loadConfig(): ArosConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * Fetch available nodes from the MIB007 marketplace registry.
 */
export async function fetchNodes(options?: {
  category?: NodeCategory;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<RegistryResponse> {
  const config = loadConfig();
  const params = new URLSearchParams();

  if (options?.category) params.set('category', options.category);
  if (options?.search) params.set('q', options.search);
  params.set('page', String(options?.page ?? 1));
  params.set('pageSize', String(options?.pageSize ?? 50));
  params.set('platformVersion', config.platform.version);

  const url = `${config.marketplace.registryUrl}/nodes?${params}`;
  console.log(`[marketplace] Fetching nodes: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `aros-platform/${config.platform.version}` },
    });

    if (!res.ok) {
      throw new Error(`Registry returned ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as RegistryResponse;

    // Cache the result
    writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[marketplace] Fetched ${data.nodes.length} nodes (${data.total} total)`);

    return data;
  } catch (err) {
    console.error('[marketplace] Failed to fetch from registry:', err);

    // Fall back to cache if available
    if (existsSync(CACHE_PATH)) {
      console.log('[marketplace] Using cached data');
      return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    }

    return { nodes: [], total: 0, page: 1, pageSize: 50 };
  }
}

/**
 * Get details for a specific node by ID.
 */
export async function getNode(nodeId: string): Promise<Node | null> {
  const config = loadConfig();
  const url = `${config.marketplace.registryUrl}/nodes/${nodeId}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `aros-platform/${config.platform.version}` },
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Registry returned ${res.status}`);

    return (await res.json()) as Node;
  } catch (err) {
    console.error(`[marketplace] Failed to fetch node ${nodeId}:`, err);
    return null;
  }
}

/**
 * List all available categories.
 */
export async function getCategories(): Promise<NodeCategory[]> {
  const { nodes } = await fetchNodes({ pageSize: 1000 });
  const categories = new Set(nodes.map((n) => n.category));
  return [...categories].sort();
}

// CLI entrypoint
if (process.argv[1]?.endsWith('marketplace/registry.ts')) {
  fetchNodes().then((result) => {
    console.log(`\n${result.total} nodes available in marketplace.`);
    for (const node of result.nodes.slice(0, 10)) {
      console.log(`  ${node.name} (${node.version}) — ${node.description}`);
    }
    if (result.total > 10) console.log(`  ... and ${result.total - 10} more`);
  });
}
