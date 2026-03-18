# Onboarding — Blank Slate

New AROS tenants start with a completely blank slate: no connectors, no credentials, no pre-loaded data.

## Flow

1. **Welcome** — Choose license tier (free / business)
2. **License** — Enter license key if business (or proceed with free tier)
3. **Model** — Use MIB007 default model or configure BYOM (Bring Your Own Model)
4. **Connectors** — Add Azure DB and/or RapidRMS API connector
   - Blank form — user must enter their own credentials
   - Use `*` prefix for passwords (auto-encrypted)
5. **Verify** — Test all configured connectors
6. **Complete** — Tenant ready to use

## Blank Slate Guarantee

- No demo data pre-loaded
- No default credentials
- No sample connectors
- User owns all their data from the start

## Usage

```typescript
import { initTenant, advanceStep, isOnboardingComplete } from './onboarding/index.js';

const state = initTenant('tenant-123');
// state.step === 'welcome'

const next = advanceStep(state, 'welcome');
// next.step === 'license'

isOnboardingComplete(next); // false
```
