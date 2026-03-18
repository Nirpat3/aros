import { execSync } from 'node:child_process';
import type { VersionManifest, SemVer, ChangelogEntry } from '../versioning/types.js';
import { getCurrentVersions, recordVersion } from '../versioning/index.js';
import { fetchManifest } from './manifest.js';
import { evaluateUpdate, type UpdateDecision, type UpdatesConfig } from './policy.js';
import { appendHistory } from './history.js';

export interface UiPreviewData {
  changelog: ChangelogEntry[];
  whitelabelWarning: boolean;
  componentCount: number;
}

/**
 * Apply a UI update from a manifest.
 * Installs the new @mib007/ui version, updates config, and records history.
 */
export async function applyUi(manifest: VersionManifest): Promise<void> {
  const versions = getCurrentVersions();
  const targetVersion = manifest.packages.ui.version;
  const fromVersion = versions.ui;

  console.log(`[ui-updater] Applying UI update: ${fromVersion} → ${targetVersion}`);

  try {
    const pkg = `@mib007/ui@${targetVersion}`;
    console.log(`[ui-updater] Installing ${pkg}...`);
    execSync(`pnpm update ${pkg}`, { stdio: 'inherit' });

    recordVersion('ui', targetVersion);

    appendHistory({
      timestamp: new Date().toISOString(),
      type: 'ui',
      fromVersion,
      toVersion: targetVersion,
      status: 'applied',
      auto: true,
    });

    console.log(`[ui-updater] UI updated to ${targetVersion}.`);
  } catch (err) {
    appendHistory({
      timestamp: new Date().toISOString(),
      type: 'ui',
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
 * Skip a UI update and record it in history.
 */
export async function skipUi(manifest: VersionManifest, reason: string): Promise<void> {
  const versions = getCurrentVersions();

  appendHistory({
    timestamp: new Date().toISOString(),
    type: 'ui',
    fromVersion: versions.ui,
    toVersion: manifest.packages.ui.version,
    status: 'skipped',
    auto: false,
    reason,
  });

  console.log(`[ui-updater] Skipped UI update to ${manifest.packages.ui.version}: ${reason}`);
}

/**
 * Check for UI updates against the feed and return a decision.
 */
export async function checkUi(feedUrl: string, config: UpdatesConfig): Promise<UpdateDecision> {
  const manifest = await fetchManifest(feedUrl);
  const versions = getCurrentVersions();
  return evaluateUpdate(manifest, versions, config);
}

/**
 * Get preview data for a UI update — changelog, whitelabel impact, affected component count.
 */
export function getUiPreview(manifest: VersionManifest): UiPreviewData {
  const ui = manifest.packages.ui;
  return {
    changelog: ui.changelog,
    whitelabelWarning: !!ui.whitelabelNote,
    componentCount: ui.changelog.filter((e) => e.scope === 'ui' || e.scope === 'dashboard').length,
  };
}
