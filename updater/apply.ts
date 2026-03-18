import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkForUpdates, pinVersion } from './index.js';

const CONFIG_PATH = join(process.cwd(), 'aros.config.json');
const BACKUP_PATH = join(process.cwd(), '.aros-data', 'config.backup.json');

/**
 * Apply a pending core update.
 *
 * Steps:
 * 1. Check for available update
 * 2. Back up current config
 * 3. Install the new @mib007/core version
 * 4. Pin the new version in config
 * 5. Run health check
 */
export async function applyUpdate(): Promise<boolean> {
  const result = await checkForUpdates();

  if (!result.available || !result.release) {
    console.log('[updater] No update to apply.');
    return false;
  }

  const { version } = result.release;
  console.log(`[updater] Applying update: ${result.current} → ${version}`);

  // Back up current config
  try {
    copyFileSync(CONFIG_PATH, BACKUP_PATH);
    console.log('[updater] Config backed up.');
  } catch (err) {
    console.error('[updater] Failed to back up config:', err);
    return false;
  }

  // Install the new core version
  try {
    const pkg = `@mib007/core@${version}`;
    console.log(`[updater] Installing ${pkg}...`);
    execSync(`pnpm add ${pkg} --filter @aros/core`, { stdio: 'inherit' });
  } catch (err) {
    console.error('[updater] Installation failed:', err);
    console.log('[updater] Rolling back...');
    copyFileSync(BACKUP_PATH, CONFIG_PATH);
    return false;
  }

  // Pin version
  pinVersion(version);

  // Health check
  try {
    console.log('[updater] Running health check...');
    execSync('pnpm build', { stdio: 'inherit' });
    console.log(`[updater] Update to ${version} applied successfully.`);
    return true;
  } catch (err) {
    console.error('[updater] Health check failed. Rolling back...');
    const { rollback } = await import('./rollback.js');
    await rollback();
    return false;
  }
}

if (process.argv[1]?.endsWith('updater/apply.ts')) {
  applyUpdate().then((ok) => process.exit(ok ? 0 : 1));
}
