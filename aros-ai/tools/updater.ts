import { checkForUpdates } from '../../updater/index.js';
import { applyUpdate } from '../../updater/apply.js';
import { rollback } from '../../updater/rollback.js';

export const updaterTools = [
  {
    name: 'update_check',
    description: 'Check for available core updates from the MIB007 registry',
    async execute(): Promise<string> {
      const result = await checkForUpdates();
      if (!result.available) return `Core is up to date (v${result.current}).`;
      return `Update available: ${result.current} → ${result.latest}\nRelease notes: ${result.release?.releaseNotes ?? 'N/A'}`;
    },
  },
  {
    name: 'update_apply',
    description: 'Apply a pending core update',
    async execute(): Promise<string> {
      const ok = await applyUpdate();
      return ok ? 'Update applied successfully.' : 'Update failed. Check logs for details.';
    },
  },
  {
    name: 'update_rollback',
    description: 'Rollback to the previous core version',
    async execute(): Promise<string> {
      const ok = await rollback();
      return ok ? 'Rolled back successfully.' : 'Rollback failed. Check logs for details.';
    },
  },
];
