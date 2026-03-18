import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_PATH = join(process.cwd(), 'aros.config.json');
const BACKUP_PATH = join(process.cwd(), '.aros-data', 'config.backup.json');

/**
 * Rollback to the previous core version.
 *
 * Restores aros.config.json from backup, then reinstalls the previous @mib007/core version.
 */
export async function rollback(): Promise<boolean> {
  if (!existsSync(BACKUP_PATH)) {
    console.error('[rollback] No backup config found. Cannot rollback.');
    return false;
  }

  // Restore config
  copyFileSync(BACKUP_PATH, CONFIG_PATH);
  console.log('[rollback] Config restored from backup.');

  // Read the restored version
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const version = config.core.version;

  // Reinstall the previous version
  try {
    console.log(`[rollback] Reinstalling @mib007/core@${version}...`);
    execSync(`pnpm add @mib007/core@${version} --filter @aros/core`, { stdio: 'inherit' });
    console.log(`[rollback] Rolled back to ${version} successfully.`);
    return true;
  } catch (err) {
    console.error('[rollback] Failed to reinstall previous version:', err);
    return false;
  }
}

if (process.argv[1]?.endsWith('updater/rollback.ts')) {
  rollback().then((ok) => process.exit(ok ? 0 : 1));
}
