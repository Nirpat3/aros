// ── Shortcut Autocomplete ───────────────────────────────────────
// Provides ranked suggestions as the user types @, /, or # prefixes.

import type {
  ShortcutType,
  AutocompleteSuggestion,
  MentionTarget,
  ToolTarget,
  NodeTarget,
} from './types.js';

const MAX_SUGGESTIONS = 5;

interface Registries {
  mentions?: MentionTarget[];
  tools?: ToolTarget[];
  nodes?: NodeTarget[];
}

// ── Core ────────────────────────────────────────────────────────

/**
 * Return up to 5 autocomplete suggestions for the given partial input.
 *   "@ni"  → suggests @nir, @aros (if matching)
 *   "/sal" → suggests /sales, /salary
 *   "#sto" → suggests #storepulse
 */
export function getSuggestions(
  partial: string,
  type: ShortcutType,
  registries: Registries,
): AutocompleteSuggestion[] {
  const query = partial.toLowerCase();

  switch (type) {
    case 'mention':
      return matchMentions(query, registries.mentions ?? []);
    case 'tool':
      return matchTools(query, registries.tools ?? []);
    case 'node':
      return matchNodes(query, registries.nodes ?? []);
  }
}

// ── Matchers ────────────────────────────────────────────────────

function matchMentions(query: string, registry: MentionTarget[]): AutocompleteSuggestion[] {
  return registry
    .filter((t) => t.name.toLowerCase().includes(query))
    .sort((a, b) => scoreMatch(a.name, query) - scoreMatch(b.name, query))
    .slice(0, MAX_SUGGESTIONS)
    .map((t) => ({
      label: `@${t.name}`,
      value: t.name,
      type: 'mention' as const,
      description: t.type === 'agent' ? 'Agent' : `User${t.online ? ' (online)' : ''}`,
    }));
}

function matchTools(query: string, registry: ToolTarget[]): AutocompleteSuggestion[] {
  return registry
    .filter((t) => t.name.toLowerCase().includes(query))
    .sort((a, b) => scoreMatch(a.name, query) - scoreMatch(b.name, query))
    .slice(0, MAX_SUGGESTIONS)
    .map((t) => ({
      label: `/${t.name}`,
      value: t.name,
      type: 'tool' as const,
      description: t.description,
    }));
}

function matchNodes(query: string, registry: NodeTarget[]): AutocompleteSuggestion[] {
  return registry
    .filter((t) => t.name.toLowerCase().includes(query))
    .sort((a, b) => scoreMatch(a.name, query) - scoreMatch(b.name, query))
    .slice(0, MAX_SUGGESTIONS)
    .map((t) => ({
      label: `#${t.name}`,
      value: t.name,
      type: 'node' as const,
      description: `${t.type} — ${t.status}`,
    }));
}

// ── Scoring ─────────────────────────────────────────────────────

/** Lower score = better match. Prefix matches rank highest. */
function scoreMatch(name: string, query: string): number {
  const lower = name.toLowerCase();
  if (lower === query) return 0; // exact
  if (lower.startsWith(query)) return 1; // prefix
  if (lower.includes(query)) return 2; // substring
  return 3;
}
