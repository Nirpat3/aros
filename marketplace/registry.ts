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

// shre-marketplace service (plugin review + published registry)
const SHRE_MARKETPLACE_URL = process.env.SHRE_MARKETPLACE_URL ?? 'http://localhost:5458';

/**
 * Fetch available nodes from both the MIB007 registry and shre-marketplace.
 * Results are merged and deduplicated by node ID.
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

  // Fetch from both registries in parallel
  const [mib007Result, marketplaceResult] = await Promise.allSettled([
    fetchFromUrl(`${config.marketplace.registryUrl}/nodes?${params}`, config.platform.version),
    fetchFromUrl(`${SHRE_MARKETPLACE_URL}/api/registry/nodes?${params}`, config.platform.version),
  ]);

  const mib007Nodes = mib007Result.status === 'fulfilled' ? mib007Result.value.nodes : [];
  const marketplaceNodes =
    marketplaceResult.status === 'fulfilled' ? marketplaceResult.value.nodes : [];

  // If both failed, fall back to cache
  if (mib007Nodes.length === 0 && marketplaceNodes.length === 0) {
    if (existsSync(CACHE_PATH)) {
      console.log('[marketplace] Both registries failed — using cached data');
      return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    }
    return { nodes: [], total: 0, page: 1, pageSize: 50 };
  }

  // Merge and deduplicate by ID (marketplace takes precedence)
  const nodeMap = new Map<string, Node>();
  for (const node of mib007Nodes) nodeMap.set(node.id, node);
  for (const node of marketplaceNodes) nodeMap.set(node.id, node);
  const nodes = [...nodeMap.values()];

  const data: RegistryResponse = {
    nodes,
    total: nodes.length,
    page: options?.page ?? 1,
    pageSize: options?.pageSize ?? 50,
  };

  // Cache the merged result
  writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(
    `[marketplace] Fetched ${nodes.length} nodes (${mib007Nodes.length} MIB007 + ${marketplaceNodes.length} marketplace)`,
  );

  return data;
}

async function fetchFromUrl(url: string, platformVersion: string): Promise<RegistryResponse> {
  console.log(`[marketplace] Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': `aros-platform/${platformVersion}` },
  });
  if (!res.ok) throw new Error(`Registry returned ${res.status}`);
  return (await res.json()) as RegistryResponse;
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
