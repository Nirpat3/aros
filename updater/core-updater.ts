import { execSync } from 'node:child_process';
import type { VersionManifest, SemVer } from '../versioning/types.js';
import { getCurrentVersions, recordVersion } from '../versioning/index.js';
import { fetchManifest } from './manifest.js';
import { evaluateUpdate, type UpdateDecision, type UpdatesConfig } from './policy.js';
import { appendHistory } from './history.js';

/**
 * Apply a core update from a manifest.
 * Installs the new @mib007/core version, updates config, records history,
 * and triggers an app restart notification.
 */
export async function applyCore(manifest: VersionManifest): Promise<void> {
  const versions = getCurrentVersions();
  const targetVersion = manifest.packages.core.version;
  const fromVersion = versions.core;

  console.log(`[core-updater] Applying core update: ${fromVersion} → ${targetVersion}`);

  try {
    const pkg = `@mib007/core@${targetVersion}`;
    console.log(`[core-updater] Installing ${pkg}...`);
    execSync(`pnpm update ${pkg} --filter @aros/core`, { stdio: 'inherit' });

    recordVersion('core', targetVersion);

    appendHistory({
      timestamp: new Date().toISOString(),
      type: 'core',
      fromVersion,
      toVersion: targetVersion,
      status: 'applied',
      auto: true,
    });

    console.log(`[core-updater] Core updated to ${targetVersion}. Restart required.`);
  } catch (err) {
    appendHistory({
      timestamp: new Date().toISOString(),
      type: 'core',
      fromVersion,
      toVersion: targetVersion,
      status: 'failed',
      auto: true,
      reason: String(err),
    });
    throw err;
  }
}

/**
 * Check for core updates against the feed and return a decision.
 */
export async function checkCore(feedUrl: string, config: UpdatesConfig): Promise<UpdateDecision> {
  const manifest = await fetchManifest(feedUrl);
  const versions = getCurrentVersions();
  return evaluateUpdate(manifest, versions, config);
}
