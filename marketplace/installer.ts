import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Node, InstalledNode, InstallResult } from './types.js';
import { getNode } from './registry.js';

const INSTALLED_PATH = join(process.cwd(), '.aros-data', 'installed-nodes.json');

function loadInstalled(): Record<string, InstalledNode> {
  if (!existsSync(INSTALLED_PATH)) return {};
  return JSON.parse(readFileSync(INSTALLED_PATH, 'utf8'));
}

function saveInstalled(data: Record<string, InstalledNode>): void {
  writeFileSync(INSTALLED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Install a node from the marketplace.
 */
export async function installNode(nodeId: string): Promise<InstallResult> {
  const node = await getNode(nodeId);
  if (!node) {
    return { success: false, node: { id: nodeId } as Node, error: 'Node not found in registry' };
  }

  const installed = loadInstalled();
  if (installed[nodeId]) {
    return { success: false, node, error: `Node ${node.name} is already installed` };
  }

  try {
    console.log(`[marketplace] Installing ${node.name}@${node.version}...`);
    execSync(`pnpm add ${node.packageName}@${node.version}`, { stdio: 'inherit' });

    installed[nodeId] = {
      node,
      installedVersion: node.version,
      installedAt: new Date().toISOString(),
      enabled: true,
      config: {},
    };
    saveInstalled(installed);

    console.log(`[marketplace] ${node.name} installed successfully.`);
    return { success: true, node };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[marketplace] Failed to install ${node.name}:`, message);
    return { success: false, node, error: message };
  }
}

/**
 * Uninstall a node.
 */
export async function uninstallNode(nodeId: string): Promise<boolean> {
  const installed = loadInstalled();
  const entry = installed[nodeId];
  if (!entry) {
    console.warn(`[marketplace] Node ${nodeId} is not installed.`);
    return false;
  }

  try {
    console.log(`[marketplace] Uninstalling ${entry.node.name}...`);
    execSync(`pnpm remove ${entry.node.packageName}`, { stdio: 'inherit' });

    delete installed[nodeId];
    saveInstalled(installed);

    console.log(`[marketplace] ${entry.node.name} uninstalled.`);
    return true;
  } catch (err) {
    console.error(`[marketplace] Failed to uninstall ${entry.node.name}:`, err);
    return false;
  }
}

/**
 * List all installed nodes.
 */
export function listInstalled(): InstalledNode[] {
  return Object.values(loadInstalled());
}

/**
 * Enable or disable an installed node.
 */
export function toggleNode(nodeId: string, enabled: boolean): boolean {
  const installed = loadInstalled();
  if (!installed[nodeId]) return false;
  installed[nodeId].enabled = enabled;
  saveInstalled(installed);
  return true;
}
