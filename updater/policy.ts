import type { VersionManifest, SemVer, UpdatePolicy } from '../versioning/types.js';
import { bumpType, isNewer } from '../versioning/semver.js';
import { getCurrentVersions } from '../versioning/index.js';

export interface UpdatesConfig {
  core: {
    policy: UpdatePolicy;
    channel: string;
    autoApplyPatch: boolean;
    autoApplyMinor: boolean;
    requireManualMajor: boolean;
  };
  ui: {
    policy: UpdatePolicy;
    ignoreIfWhitelabeled: boolean;
    previewBeforeApply: boolean;
  };
  checkIntervalMinutes: number;
  webhookOnUpdate: string;
}

export type UpdateAction = 'apply' | 'notify' | 'ignore';

export interface UpdateDecision {
  core: UpdateAction;
  ui: UpdateAction;
  manifest: VersionManifest;
}

/**
 * Determine whether a core/ui update should be auto-applied given the bump type and policy.
 */
export function shouldAutoApply(
  bump: 'major' | 'minor' | 'patch',
  policy: UpdatePolicy,
  config: UpdatesConfig,
): boolean {
  if (policy === 'ignore' || policy === 'off') return false;
  if (bump === 'major' && config.core.requireManualMajor) return false;
  if (bump === 'patch' && config.core.autoApplyPatch) return true;
  if (bump === 'minor' && config.core.autoApplyMinor) return true;
  return false;
}

/**
 * Determine whether UI updates should be ignored for this deployment.
 */
export function shouldIgnoreUi(config: UpdatesConfig, whitelabelActive: string): boolean {
  if (config.ui.policy === 'ignore') return true;
  if (config.ui.ignoreIfWhitelabeled && whitelabelActive !== 'default') return true;
  return false;
}

/**
 * Evaluate a manifest against current versions and config to produce an update decision.
 */
export function evaluateUpdate(
  manifest: VersionManifest,
  currentVersions: { platform: SemVer; core: SemVer; ui: SemVer },
  config: UpdatesConfig,
  whitelabelActive: string = 'default',
): UpdateDecision {
  // Core decision
  let core: UpdateAction = 'ignore';
  if (isNewer(manifest.packages.core.version, currentVersions.core)) {
    const bump = bumpType(currentVersions.core, manifest.packages.core.version);
    if (config.core.policy === 'off') {
      core = 'ignore';
    } else if (shouldAutoApply(bump, config.core.policy, config)) {
      core = 'apply';
    } else if (config.core.policy !== 'ignore') {
      core = 'notify';
    }
  }

  // UI decision
  let ui: UpdateAction = 'ignore';
  if (isNewer(manifest.packages.ui.version, currentVersions.ui)) {
    if (shouldIgnoreUi(config, whitelabelActive)) {
      ui = 'ignore';
    } else if (config.ui.policy === 'auto') {
      ui = 'apply';
    } else if (config.ui.policy === 'notify') {
      ui = 'notify';
    }
  }

  return { core, ui, manifest };
}
