# Shortcut / Mention System

AROS uses three shortcut symbols to give users fast, inline control over routing, tools, and context scoping.

## Symbols

### @ — Mention / Direct Communication
```
@aros       → talk directly to AROS AI agent
@nir        → tag/notify a specific user
```
**Use case:** Route a message, notify someone, address specific agent in multi-agent setup.

### / — Tool Activation
```
/sales      → pull up sales tool
/pricing    → activate pricing tool
/inventory  → open inventory tool
```
**Use case:** Explicitly invoke a tool rather than letting the agent decide.

### # — Node / App Focus
```
#storepulse → focus all queries on StorePulse node
#rapidrms   → scope context to RapidRMS app
```
**Use case:** When working with multiple nodes, # pins context to one until changed.

## How It Works

1. **Parser** (`parser.ts`) — scans message text for `@word`, `/word`, `#word` patterns and extracts all matches with positions.
2. **Resolver** (`resolver.ts`) — maps shortcut targets to actual registry objects (agents, tools, nodes). Supports exact, prefix, and fuzzy matching.
3. **Handler** (`handler.ts`) — orchestrates parse + resolve in one call. Returns routing target, active tool, active node, and the clean message.
4. **Autocomplete** (`autocomplete.ts`) — provides ranked suggestions as the user types. Returns top 5 matches.

## Usage

```typescript
import { handleShortcuts } from './shortcuts/index.js';

const result = handleShortcuts('@aros /sales #storepulse show me today\'s numbers', context);
// result.routeTo     → { id: '...', name: 'aros', type: 'agent' }
// result.activeTool  → { id: '...', name: 'sales', ... }
// result.activeNode  → { id: '...', name: 'storepulse', ... }
// result.cleanMessage → "show me today's numbers"
```

## Autocomplete

```typescript
import { getSuggestions } from './shortcuts/index.js';

getSuggestions('ni', 'mention', { mentions });
// → [{ label: '@nir', value: 'nir', type: 'mention', description: 'User (online)' }]
```
