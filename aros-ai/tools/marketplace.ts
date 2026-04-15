import { fetchNodes, getNode } from '../../marketplace/registry.js';
import {
  installNode,
  uninstallNode,
  listInstalled,
  toggleNode,
} from '../../marketplace/installer.js';

export const marketplaceTools = [
  {
    name: 'marketplace_search',
    description: 'Search the node marketplace for available apps',
    async execute(params: Record<string, unknown>): Promise<string> {
      const result = await fetchNodes({
        search: params.query as string,
        category: params.category as any,
      });
      if (result.nodes.length === 0) return 'No nodes found matching your search.';
      return result.nodes.map((n) => `${n.name} (${n.version}) — ${n.description}`).join('\n');
    },
  },
  {
    name: 'marketplace_install',
    description: 'Install a node from the marketplace',
    async execute(params: Record<string, unknown>): Promise<string> {
      const result = await installNode(params.nodeId as string);
      return result.success
        ? `Installed ${result.node.name} v${result.node.version}.`
        : `Failed to install: ${result.error}`;
    },
  },
  {
    name: 'marketplace_uninstall',
    description: 'Uninstall a node',
    async execute(params: Record<string, unknown>): Promise<string> {
      const ok = await uninstallNode(params.nodeId as string);
      return ok ? 'Node uninstalled.' : 'Failed to uninstall node.';
    },
  },
  {
    name: 'marketplace_list',
    description: 'List all installed nodes',
    async execute(): Promise<string> {
      const nodes = listInstalled();
      if (nodes.length === 0) return 'No nodes installed.';
      return nodes
        .map((n) => `${n.node.name} v${n.installedVersion} (${n.enabled ? 'enabled' : 'disabled'})`)
        .join('\n');
    },
  },
  {
    name: 'marketplace_toggle',
    description: 'Enable or disable an installed node',
    async execute(params: Record<string, unknown>): Promise<string> {
      const ok = toggleNode(params.nodeId as string, params.enabled as boolean);
      return ok ? `Node ${params.enabled ? 'enabled' : 'disabled'}.` : 'Node not found.';
    },
  },
];
