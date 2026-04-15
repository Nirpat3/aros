// ── Shortcut System ─────────────────────────────────────────────

export type {
  ShortcutType,
  ParsedShortcut,
  MentionTarget,
  ToolTarget,
  NodeTarget,
  AutocompleteSuggestion,
  SessionContext,
  ShortcutHandlerResult,
} from './types.js';

export {
  parseShortcuts,
  extractMentions,
  extractTools,
  extractNodes,
  stripShortcuts,
} from './parser.js';

export { resolveMention, resolveTool, resolveNode } from './resolver.js';

export { handleShortcuts } from './handler.js';
export { getSuggestions } from './autocomplete.js';
