# Auth Plugin

Authentication and identity management for the AROS platform. Supports two providers:

- **ShreProvider** — delegates auth to an external Shre service endpoint (MIB007 ecosystem)
- **ArosProvider** — fully self-contained local auth with zero external dependencies

## Modes

### Shre Enabled (default)

When `shre.enabled` is `true` in `aros.config.json`, the platform delegates authentication and vault operations to a running Shre service endpoint.

Requirements:
- A reachable Shre service at the configured endpoint
- Valid API credentials
- Network access from the AROS deployment to the Shre endpoint

### Standalone Mode (Shre Disabled)

When `shre.enabled` is `false`, the platform uses `ArosProvider` — a fully self-contained auth and vault implementation with zero external dependencies.

ArosProvider provides:
- **JWT-based authentication** with locally generated signing keys
- **Encrypted local vault** using AES-256-GCM for secrets storage
- **Session management** with configurable TTL
- **User CRUD** against a local database

There is no feature gap for operators. The provider interface is identical — application code does not know or care which provider is active.

## Configuration

In `aros.config.json`:

```json
{
  "shre": {
    "enabled": true,
    "endpoint": "https://shre.internal:5455",
    "fallback": "local"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Whether to use Shre for auth/vault |
| `endpoint` | string | Shre service URL (required when enabled) |
| `fallback` | string | Fallback provider when Shre is unreachable. `"local"` = ArosProvider, `"error"` = fail hard |

## Switching Modes

To go from Shre-enabled to standalone:

1. Set `shre.enabled` to `false` in `aros.config.json`
2. Restart the platform
3. Existing Shre-issued sessions will expire naturally; new sessions use ArosProvider

To enable Shre on a standalone deployment:

1. Ensure the Shre service is running and reachable
2. Set `shre.enabled` to `true` and configure `shre.endpoint`
3. Restart the platform
4. Run the migration utility to sync local users to Shre (if needed)

## Provider Interface

Both `ShreProvider` and `ArosProvider` implement the same `AuthProvider` interface:

```typescript
interface AuthProvider {
  authenticate(credentials: Credentials): Promise<AuthResult>;
  validate(token: string): Promise<TokenPayload>;
  refresh(token: string): Promise<AuthResult>;
  revoke(token: string): Promise<void>;
  createUser(user: CreateUserInput): Promise<User>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, update: UpdateUserInput): Promise<User>;
  deleteUser(id: string): Promise<void>;
}
```

Application code imports from `plugins/auth/index.ts`, which returns the correct provider based on configuration. No conditional logic needed at the call site.
