// ── Shortcut Resolver ───────────────────────────────────────────
// Resolves parsed shortcut targets to actual registry objects.

import type { MentionTarget, ToolTarget, NodeTarget } from './types.js';

// ── Mention Resolver ────────────────────────────────────────────

/** Resolve @name to a MentionTarget (case-insensitive exact match). */
export function resolveMention(name: string, registry: MentionTarget[]): MentionTarget | null {
  const lower = name.toLowerCase();
  return registry.find((t) => t.name.toLowerCase() === lower) ?? null;
}

// ── Tool Resolver ───────────────────────────────────────────────

/** Resolve /name to a ToolTarget (fuzzy prefix match). */
export function resolveTool(name: string, registry: ToolTarget[]): ToolTarget | null {
  const lower = name.toLowerCase();

  // Exact match first
  const exact = registry.find((t) => t.name.toLowerCase() === lower);
  if (exact) return exact;

  // Prefix / fuzzy match — e.g. /sal → "sales"
  const prefixMatches = registry.filter((t) => t.name.toLowerCase().startsWith(lower));
  if (prefixMatches.length === 1) return prefixMatches[0];

  // If multiple prefix matches, pick shortest name (most specific)
  if (prefixMatches.length > 1) {
    return prefixMatches.sort((a, b) => a.name.length - b.name.length)[0];
  }

  // Substring match as last resort
  const substringMatch = registry.find((t) => t.name.toLowerCase().includes(lower));
  return substringMatch ?? null;
}

// ── Node Resolver ───────────────────────────────────────────────

/** Resolve #name to a NodeTarget (case-insensitive, prefix-tolerant). */
export function resolveNode(name: string, registry: NodeTarget[]): NodeTarget | null {
  const lower = name.toLowerCase();

  // Exact match
  const exact = registry.find((t) => t.name.toLowerCase() === lower);
  if (exact) return exact;

  // Prefix match
  const prefixMatches = registry.filter((t) => t.name.toLowerCase().startsWith(lower));
  if (prefixMatches.length >= 1) {
    return prefixMatches.sort((a, b) => a.name.length - b.name.length)[0];
  }

  return null;
}
