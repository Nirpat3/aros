# AROS Model Selector / BYOM

AROS supports multiple LLM providers. By default, requests route through MIB007 hosted models (metered). Operators can bring their own model (BYOM) to use any OpenAI-compatible provider.

## Providers

| Provider | Type | Notes |
|----------|------|-------|
| `mib007` | Hosted (default) | MIB007 managed models, metered per request |
| `openai` | BYOM | OpenAI API, operator's own key |
| `anthropic` | BYOM | Anthropic Claude API, operator's own key |
| `ollama` | BYOM | Local Ollama instance, no external calls |
| `custom` | BYOM | Any OpenAI-compatible endpoint |

## Configuration

### Default (MIB007 metered)

```json
{
  "models": {
    "provider": "mib007",
    "metered": true,
    "byom": {
      "enabled": false,
      "provider": "",
      "apiKey": "",
      "model": "",
      "endpoint": ""
    }
  }
}
```

### OpenAI BYOM

```json
{
  "models": {
    "provider": "mib007",
    "metered": false,
    "byom": {
      "enabled": true,
      "provider": "openai",
      "apiKey": "sk-...",
      "model": "gpt-4o",
      "endpoint": ""
    }
  }
}
```

### Anthropic BYOM

```json
{
  "models": {
    "provider": "mib007",
    "metered": false,
    "byom": {
      "enabled": true,
      "provider": "anthropic",
      "apiKey": "sk-ant-...",
      "model": "claude-opus-4-6",
      "endpoint": ""
    }
  }
}
```

### Ollama (local)

```json
{
  "models": {
    "provider": "mib007",
    "metered": false,
    "byom": {
      "enabled": true,
      "provider": "ollama",
      "apiKey": "",
      "model": "llama3",
      "endpoint": "http://localhost:11434"
    }
  }
}
```

### Custom (any OpenAI-compatible endpoint)

```json
{
  "models": {
    "provider": "mib007",
    "metered": false,
    "byom": {
      "enabled": true,
      "provider": "custom",
      "apiKey": "your-api-key",
      "model": "your-model-name",
      "endpoint": "https://your-provider.example.com/v1"
    }
  }
}
```

## How It Works

1. `getModelConfig()` reads model settings from `aros.config.json`
2. `resolveProvider()` returns the correct `LLMProvider` instance:
   - If `byom.enabled` is `false` → MIB007 hosted provider (metered)
   - If `byom.enabled` is `true` → operator's chosen provider (no MIB007 metering)
3. `trackUsage(tokens, model)` posts consumption to MIB007 meter endpoint when metered

## Metering

When using MIB007 hosted models (`byom.enabled: false`):
- Every request is logged with token count, model, and timestamp
- Usage is posted to `meter.mib007.io` for consumption-based billing
- Metering failures are non-blocking (logged but don't break requests)

When using BYOM (`byom.enabled: true`):
- No MIB007 metering occurs
- Operator manages their own provider costs
