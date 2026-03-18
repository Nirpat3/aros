# AROS Licensing

AROS uses a tiered licensing model that controls user limits, whitelabel access, and model metering.

## Tiers

| Tier | Users | Whitelabel | BYOM | MIB007 Metered | Use Case |
|------|-------|------------|------|----------------|----------|
| **Free** | 1 | No | Yes | Yes (default) | Solo operator, evaluation |
| **Business** | Unlimited | No | Yes | Yes (default) | Multi-user teams, SLA, audit trails |
| **Enterprise** | Unlimited | No | Yes | Yes (default) | Custom integrations, priority support |
| **OEM** | Unlimited | Yes | Yes | Yes (default) | Full UI customization, agent rename, domain branding |

## BYOM (Bring Your Own Model)

All tiers support BYOM. When BYOM is enabled:

- The operator provides their own API key for OpenAI, Anthropic, Ollama, or any OpenAI-compatible endpoint
- MIB007 metering stops — no per-request billing from AROS
- The operator is responsible for their own model costs

When BYOM is disabled, requests route through MIB007 hosted models and usage is metered per request per tenant.

## MIB007 Metering

When `models.metered` is `true` in `aros.config.json`:

- Every LLM request is logged with token count, model, and tenant ID
- Usage is posted to the MIB007 meter endpoint for consumption-based billing
- Metering is transparent — operators can view usage in their dashboard

## License Key Format

```
AROS-XXXX-XXXX-XXXX-XXXX
```

Keys are validated on startup. Free tier does not require a key.

## Configuration

In `aros.config.json`:

```json
{
  "licensing": {
    "tier": "free",
    "maxUsers": 1,
    "whitelabel": false,
    "licenseKey": "",
    "expiresAt": null
  }
}
```

## API

```typescript
import { getLicense, checkUserLimit, isWhitelabelAllowed, enforceUserLimit } from '../licensing/index.js';

// Read current license
const license = getLicense();

// Check before adding a user
if (!checkUserLimit(currentUserCount)) {
  // show upgrade prompt
}

// Enforce — throws if over limit
enforceUserLimit(currentUserCount);

// Check whitelabel access
if (isWhitelabelAllowed()) {
  // enable brand customization UI
}
```
