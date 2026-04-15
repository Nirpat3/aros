// ── Shortcut Runtime Handler ────────────────────────────────────
// Parses, resolves, and applies shortcuts in a single pass.

import type {
  SessionContext,
  ShortcutHandlerResult,
  MentionTarget,
  ToolTarget,
  NodeTarget,
} from './types.js';
import { parseShortcuts, stripShortcuts } from './parser.js';
import { resolveMention, resolveTool, resolveNode } from './resolver.js';

// ── Handler ─────────────────────────────────────────────────────

/**
 * Process all shortcuts in a message:
 *  - @mention → route message to agent/user
 *  - /tool   → pre-activate a tool for the agent
 *  - #node   → scope session to a specific node/app
 *
 * Returns resolved targets and the clean (shortcut-free) message.
 */
export function handleShortcuts(message: string, context: SessionContext): ShortcutHandlerResult {
  const shortcuts = parseShortcuts(message);

  let routeTo: MentionTarget | undefined;
  let activeTool: ToolTarget | undefined;
  let activeNode: NodeTarget | undefined;

  for (const shortcut of shortcuts) {
    switch (shortcut.type) {
      case 'mention': {
        const target = resolveMention(shortcut.target, context.mentions);
        if (target) routeTo = target;
        break;
      }
      case 'tool': {
        const target = resolveTool(shortcut.target, context.tools);
        if (target) activeTool = target;
        break;
      }
      case 'node': {
        const target = resolveNode(shortcut.target, context.nodes);
        if (target) activeNode = target;
        break;
      }
    }
  }

  return {
    routeTo,
    activeTool,
    activeNode,
    cleanMessage: stripShortcuts(message),
  };
}
