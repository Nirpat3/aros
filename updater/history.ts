import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { UpdateHistoryEntry } from '../versioning/types.js';

const HISTORY_PATH = join(process.cwd(), 'updater', 'history.json');

function ensureFile(): void {
  if (!existsSync(HISTORY_PATH)) {
    writeFileSync(HISTORY_PATH, '[]', 'utf8');
  }
}

/**
 * Append an entry to the update history log.
 */
export function appendHistory(entry: UpdateHistoryEntry): void {
  ensureFile();
  const history = JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) as UpdateHistoryEntry[];
  history.push(entry);
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
  console.log(
    `[history] Recorded ${entry.type} ${entry.status}: ${entry.fromVersion} → ${entry.toVersion}`,
  );
}

/**
 * Read the full update history.
 */
export function getHistory(): UpdateHistoryEntry[] {
  ensureFile();
  return JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
}

/**
 * Get the last applied update for a given type (core or ui).
 */
export function getLastApplied(type: 'core' | 'ui'): UpdateHistoryEntry | null {
  const history = getHistory();
  const applied = history.filter((e) => e.type === type && e.status === 'applied');
  return applied.length > 0 ? applied[applied.length - 1]! : null;
}
