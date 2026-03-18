# AROS Plugin Specification

A plugin extends the AROS platform with new UI, agent behaviors, or platform features. Unlike connectors (which pull data), plugins can add pages, modify how the agent responds, add new tools, and hook into platform events.

---

## 1. AROSPlugin Interface

Every plugin must implement this TypeScript interface:

```typescript
export interface AROSPlugin {
  /**
   * Plugin metadata (from manifest.json, injected by AROS).
   */
  readonly meta: PluginMeta;

  /**
   * Called when the user installs the plugin.
   * Use for setup, creating initial config, registering tools.
   */
  install(context: PluginContext): Promise<void>;

  /**
   * Called when the user uninstalls the plugin.
   * Clean up any registered tools, routes, or stored data.
   */
  uninstall(context: PluginContext): Promise<void>;

  /**
   * Optional: render a UI component for a registered page or widget.
   * Return a URL (iframe) or a React component path.
   */
  render?(slot: PluginSlot): PluginRenderResult;

  /**
   * Optional: hook into agent messages.
   * Called before the agent processes each user message.
   * Return modified context or null to pass through unchanged.
   */
  onAgentMessage?(
    message: AgentMessage,
    context: PluginContext,
  ): Promise<AgentMessage | null>;

  /**
   * Optional: called after the agent responds.
   * Use for logging, analytics, or post-processing.
   */
  onAgentResponse?(
    response: AgentResponse,
    context: PluginContext,
  ): Promise<void>;
}
```

### Supporting Types

```typescript
export interface PluginMeta {
  id: string;
  name: string;
  version: string;
}

export interface PluginContext {
  /** Current user's tenant ID */
  tenantId: string;
  /** Plugin's own config (from configSchema, secrets as vaultRefs) */
  config: Record<string, unknown>;
  /** Register a new page in the AROS sidebar */
  registerPage(spec: PageSpec): void;
  /** Register a new agent tool */
  registerTool(tool: AgentTool): void;
  /** Read/write plugin-scoped storage (isolated from other plugins) */
  storage: PluginStorage;
  /** Logger (never logs secrets) */
  log: PluginLogger;
}

export interface PageSpec {
  id: string;
  label: string;              // Sidebar label
  icon?: string;              // Emoji or icon name
  path: string;               // Route: /plugins/my-plugin/page
  component: string;          // Path to React component
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

export type PluginSlot =
  | 'sidebar-widget'     // Small widget in the sidebar
  | 'dashboard-card'     // Card on the main dashboard
  | 'settings-page'      // Full settings page
  | 'agent-panel';       // Panel shown alongside agent chat

export interface PluginRenderResult {
  type: 'url' | 'component';
  value: string;          // iframe URL or React component path
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse extends AgentMessage {
  role: 'assistant';
  toolCalls?: unknown[];
}

export interface PluginStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export interface PluginLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
```

---

## 2. Adding New Pages to AROS UI

Use `context.registerPage()` in your `install()` method:

```typescript
async install(context: PluginContext): Promise<void> {
  context.registerPage({
    id: 'loyalty-dashboard',
    label: 'Loyalty',
    icon: '🎁',
    path: '/plugins/my-loyalty-plugin/dashboard',
    component: './pages/LoyaltyDashboard.tsx',
  });
}
```

Your React component receives the plugin's config as props:

```typescript
// pages/LoyaltyDashboard.tsx
export default function LoyaltyDashboard({ config }: { config: Record<string, unknown> }) {
  return <div>Loyalty Dashboard</div>;
}
```

### UI Constraints

- Pages render inside an iframe sandbox (see Plugin Isolation below)
- Available UI kit: `@aros/ui-kit` (buttons, cards, tables, charts)
- Styling: Tailwind CSS classes are available
- Navigation: use AROS router via `window.parent.postMessage`

---

## 3. Adding New Agent Tools/Behaviors

Register tools in `install()`. The agent can call them during conversations:

```typescript
async install(context: PluginContext): Promise<void> {
  context.registerTool({
    name: 'get_loyalty_points',
    description: 'Get the loyalty points balance for a customer by their phone number.',
    parameters: {
      phoneNumber: {
        type: 'string',
        description: 'Customer phone number in E.164 format',
        required: true,
      },
    },
    execute: async (params) => {
      const points = await this.loyaltyApi.getPoints(params.phoneNumber as string);
      return { phoneNumber: params.phoneNumber, points };
    },
  });
}
```

The agent will automatically call this tool when a user asks about loyalty points.

### onAgentMessage Hook

Inject context before the agent processes a message:

```typescript
async onAgentMessage(message: AgentMessage, context: PluginContext) {
  // Add loyalty summary to every user message
  const summary = await this.loyaltyApi.getSummary(context.tenantId);
  return {
    ...message,
    content: `[Loyalty context: ${summary.totalMembers} members, ${summary.pointsIssued} points issued today]\n\n${message.content}`,
  };
}
```

---

## 4. Plugin Isolation

AROS sandboxes all plugins for security:

| What plugins CAN do | What plugins CANNOT do |
|---------------------|----------------------|
| Read their own config | Read other plugins' config |
| Use their own storage | Access vault directly |
| Register pages and tools | Execute arbitrary shell commands |
| Make outbound HTTP requests | Access the AROS core database |
| Log via `context.log` | Write to the filesystem outside plugin storage |
| Declare explicit capabilities | Invoke agent tools from other plugins |

### Capability Declarations

Plugins must declare capabilities in `manifest.json`. AROS enforces these at runtime:

```json
{
  "capabilities": [
    "agent-tools",        // Can register agent tools
    "ui-pages",           // Can add UI pages
    "agent-hooks",        // Can use onAgentMessage/onAgentResponse
    "outbound-http",      // Can make HTTP requests
    "local-storage"       // Can use plugin storage
  ]
}
```

---

## 5. manifest.json for Plugins

Same as connector manifest, with these additions:

```json
{
  "id": "com.acmecorp.loyalty-plugin",
  "name": "Acme Loyalty",
  "version": "1.0.0",
  "description": "Add loyalty program management to AROS.",
  "category": "loyalty",
  "author": "Acme Corp",
  "packageName": "@acmecorp/plugin-loyalty",
  "type": "plugin",
  "capabilities": [
    "agent-tools",
    "ui-pages",
    "agent-hooks",
    "outbound-http"
  ],
  "pricing": { "model": "subscription", "price": 9.99, "interval": "monthly" },
  "requiredPlatformVersion": "0.2.0",
  "configSchema": {
    "apiKey": { "type": "string", "required": true, "label": "Loyalty API Key", "secret": true },
    "programName": { "type": "string", "required": true, "label": "Program Name" }
  }
}
```

---

## 6. Marketplace Submission Checklist

- [ ] `manifest.json` is valid, `type: "plugin"` is set
- [ ] All capabilities are declared in `manifest.json`
- [ ] Secrets use `secret: true` — no plain-text secrets in code
- [ ] `install()` and `uninstall()` are implemented
- [ ] `uninstall()` cleans up all registered tools and pages
- [ ] TypeScript compiles cleanly
- [ ] README.md explains: what it adds, how to configure, screenshots
- [ ] Tested locally with `aros dev --plugin ./my-plugin`
- [ ] Privacy note: if plugin collects user data, disclose in README
