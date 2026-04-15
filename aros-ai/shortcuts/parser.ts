// ── Shortcut Parser ─────────────────────────────────────────────
// Extracts @mention, /tool, and #node shortcuts from message text.

import type { ParsedShortcut, ShortcutType } from './types.js';

// ── Patterns ────────────────────────────────────────────────────

const SHORTCUT_RE = /(?:^|(?<=\s))(@|\/|#)([\w.-]+)/g;

const SYMBOL_TYPE: Record<string, ShortcutType> = {
  '@': 'mention',
  '/': 'tool',
  '#': 'node',
};

// ── Core Parser ─────────────────────────────────────────────────

/** Scan message for all @mention, /tool, and #node shortcuts. */
export function parseShortcuts(message: string): ParsedShortcut[] {
  const results: ParsedShortcut[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  SHORTCUT_RE.lastIndex = 0;

  while ((match = SHORTCUT_RE.exec(message)) !== null) {
    const symbol = match[1] as ParsedShortcut['symbol'];
    const target = match[2];
    results.push({
      type: SYMBOL_TYPE[symbol],
      symbol,
      target,
      raw: match[0],
      position: match.index,
    });
  }

  return results;
}

// ── Convenience Filters ─────────────────────────────────────────

/** Extract only @mentions from message. */
export function extractMentions(message: string): ParsedShortcut[] {
  return parseShortcuts(message).filter((s) => s.type === 'mention');
}

/** Extract only /tool shortcuts from message. */
export function extractTools(message: string): ParsedShortcut[] {
  return parseShortcuts(message).filter((s) => s.type === 'tool');
}

/** Extract only #node shortcuts from message. */
export function extractNodes(message: string): ParsedShortcut[] {
  return parseShortcuts(message).filter((s) => s.type === 'node');
}

// ── Strip ───────────────────────────────────────────────────────

/** Remove all shortcuts from message, returning clean text. */
export function stripShortcuts(message: string): string {
  SHORTCUT_RE.lastIndex = 0;
  return message
    .replace(SHORTCUT_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
