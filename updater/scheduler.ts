import { fetchManifest, clearCache } from './manifest.js';
import { evaluateUpdate, type UpdatesConfig, type UpdateAction } from './policy.js';
import { applyCore } from './core-updater.js';
import { applyUi } from './ui-updater.js';
import { getCurrentVersions } from '../versioning/index.js';

export interface CheckResult {
  core: UpdateAction;
  ui: UpdateAction;
  coreVersion?: string;
  uiVersion?: string;
  checkedAt: string;
}

let _timer: ReturnType<typeof setInterval> | null = null;
let _config: UpdatesConfig | null = null;
let _feedUrl: string = '';

/**
 * Start the update scheduler. Runs checkAndApply on the configured interval.
 */
export function start(config: UpdatesConfig, feedUrl: string): void {
  _config = config;
  _feedUrl = feedUrl;

  const intervalMs = (config.checkIntervalMinutes || 30) * 60 * 1000;
  console.log(`[scheduler] Starting update checks every ${config.checkIntervalMinutes}min`);

  // Run immediately on start
  checkAndApply().catch((err) => console.error('[scheduler] Check failed:', err));

  _timer = setInterval(() => {
    checkAndApply().catch((err) => console.error('[scheduler] Check failed:', err));
  }, intervalMs);
}

/**
 * Stop the scheduler.
 */
export function stop(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[scheduler] Stopped.');
  }
}

/**
 * Fetch manifest, evaluate policy, auto-apply if warranted, emit notifications otherwise.
 */
export async function checkAndApply(): Promise<void> {
  if (!_config || !_feedUrl) {
    console.warn('[scheduler] Not configured — call start() first.');
    return;
  }

  console.log('[scheduler] Checking for updates...');
  clearCache();

  const manifest = await fetchManifest(_feedUrl);
  const versions = getCurrentVersions();
  const decision = evaluateUpdate(manifest, versions, _config);

  if (decision.core === 'apply') {
    console.log('[scheduler] Auto-applying core update...');
    await applyCore(manifest);
  } else if (decision.core === 'notify') {
    console.log(
      `[scheduler] Core update available: ${versions.core} → ${manifest.packages.core.version}`,
    );
  }

  if (decision.ui === 'apply') {
    console.log('[scheduler] Auto-applying UI update...');
    await applyUi(manifest);
  } else if (decision.ui === 'notify') {
    console.log(
      `[scheduler] UI update available: ${versions.ui} → ${manifest.packages.ui.version}`,
    );
  }

  if (decision.core === 'ignore' && decision.ui === 'ignore') {
    console.log('[scheduler] Everything is up to date.');
  }
}

/**
 * Run an on-demand check without auto-applying.
 */
export async function checkNow(): Promise<CheckResult> {
  if (!_config || !_feedUrl) {
    throw new Error('[scheduler] Not configured — call start() first.');
  }

  clearCache();
  const manifest = await fetchManifest(_feedUrl);
  const versions = getCurrentVersions();
  const decision = evaluateUpdate(manifest, versions, _config);

  return {
    core: decision.core,
    ui: decision.ui,
    coreVersion: manifest.packages.core.version,
    uiVersion: manifest.packages.ui.version,
    checkedAt: new Date().toISOString(),
  };
}
