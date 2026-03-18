// ── Shortcut / Mention System Types ─────────────────────────────

export type ShortcutType = "mention" | "tool" | "node";

export interface ParsedShortcut {
  type: ShortcutType;
  symbol: "@" | "/" | "#";
  target: string;           // agent name, tool name, or node/app name
  raw: string;              // original text e.g. "@aros", "/search", "#storepulse"
  position: number;         // char position in message
}

export interface MentionTarget {
  id: string;
  name: string;
  type: "agent" | "user";
  online?: boolean;
}

export interface ToolTarget {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface NodeTarget {
  id: string;
  name: string;
  type: "node" | "app";
  status: "active" | "inactive" | "installing";
  description: string;
}

export interface AutocompleteSuggestion {
  label: string;
  value: string;
  type: ShortcutType;
  description?: string;
}

export interface SessionContext {
  tenantId: string;
  userId: string;
  activeNode?: NodeTarget;
  activeTool?: ToolTarget;
  mentions: MentionTarget[];
  tools: ToolTarget[];
  nodes: NodeTarget[];
}

export interface ShortcutHandlerResult {
  routeTo?: MentionTarget;
  activeTool?: ToolTarget;
  activeNode?: NodeTarget;
  cleanMessage: string;
}
