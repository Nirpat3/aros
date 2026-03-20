# AROS Industry Taxonomy
> Segments, verticals, agent relevance, and onboarding configuration.

---

## Two-Level Taxonomy

AROS uses a two-level system: **Segment** (broad category) → **Vertical** (specific business type).

Operators select their vertical during onboarding. Verticals drive:
- Which agents surface first in the marketplace
- Which agents are pre-installed at signup
- Which onboarding checklist is shown
- Which demo data and benchmarks are used
- How Ellie's default context is framed

---

## Segments

| Segment | Code | Description |
|---------|------|-------------|
| Food Service | `food-service` | Food/drink prepared and sold on-premise or delivery |
| Retail | `retail` | Physical goods sold to consumers |
| Fuel & Convenience | `fuel-convenience` | Gas stations, c-stores, hybrid formats |
| Specialty | `specialty` | Niche verticals with unique compliance/inventory needs |

---

## Verticals

| Vertical | Code | Segment | Notes |
|----------|------|---------|-------|
| Quick Service Restaurant | `qsr` | food-service | Counter service, fast-casual, drive-through |
| Full Service Restaurant | `fsr` | food-service | Table service, dine-in focus |
| Bar / Nightclub | `bar-nightclub` | food-service | High void risk, late-shift labor focus |
| Coffee & Smoothie Bar | `coffee-smoothie` | food-service | High ticket velocity, low avg ticket |
| Bakery | `bakery` | food-service | Strong inventory/perishable focus |
| Food Truck | `food-truck` | food-service | Often owner-operated, mobile, events-driven |
| Catering | `catering` | food-service | Event-based, batch inventory, labor spikes |
| Convenience Store | `c-store` | fuel-convenience | High SKU count, tobacco/age-gated items |
| Gas Station | `gas-station` | fuel-convenience | Fuel + c-store combo, high shrink risk |
| Liquor Store | `liquor-store` | specialty | Age-gated, high-value SKUs, compliance-heavy |
| Tobacco / Smoke Shop | `tobacco` | specialty | Age-gated, high shrink, compliance-heavy |
| Gift Store | `gift-store` | retail | Seasonal demand spikes, low staff complexity |
| General Retail | `retail-general` | retail | Broad SKU, standard retail patterns |
| Pharmacy | `pharmacy` | specialty | Regulated inventory, prescription gating |
| Grocery | `grocery` | retail | High SKU velocity, perishables, deli |

Operators can have **multiple verticals** (e.g. a gas station with an attached c-store and deli → `["gas-station", "c-store", "qsr"]`). The `primaryVertical` field drives default agent config and onboarding flow.

---

## Agent Relevance by Vertical

### Relevance Scale
- **Core** — Built for this vertical. Pre-installed at signup. Highlighted in marketplace.
- **Supported** — Works well. Available and recommended.
- **Limited** — Partial fit. Available but with caveats.
- **N/A** — Not applicable. Hidden from marketplace for this vertical.

| Agent | qsr | fsr | bar-nightclub | coffee-smoothie | bakery | food-truck | catering | c-store | gas-station | liquor-store | tobacco | gift-store | retail-general |
|-------|-----|-----|---------------|-----------------|--------|------------|----------|---------|-------------|--------------|---------|------------|----------------|
| **Ellie ✨** | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core |
| **Ana 📦** | Core | Core | Supported | Core | Core | Core | Core | Core | Supported | Core | Core | Supported | Supported |
| **Sammy 📈** | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core | Core |
| **Victor 🔎** | Core | Core | Core | Supported | Supported | Limited | Supported | Core | Core | Core | Core | Supported | Supported |
| **Larry 👷** | Core | Core | Core | Core | Core | Supported | Core | Supported | Supported | Supported | Supported | Supported | Supported |
| **Rita ⭐** | Core | Core | Supported | Core | Supported | Core | Supported | Limited | N/A | Supported | Limited | Supported | Supported |

### Relevance Notes

**Ellie** — Universal. Every operator gets Ellie regardless of vertical.

**Ana** — Strongest in food service (perishable velocity, 86 risk). For retail/c-store: high SKU count makes her more important, not less — but the stockout model adjusts (no perishable urgency, but shrink matters more).

**Victor** — Especially critical for liquor/tobacco/c-store/gas/bar — highest shrink and void abuse risk. Food trucks: limited because most are owner-operated with minimal cashier variance.

**Larry** — Strong everywhere staffed. Weakens on food trucks (typically 1-2 person operations) and retail (simpler shift structures). Still valuable for coverage gap detection even in lighter-staffed verticals.

**Rita** — Gas stations don't get Google reviews for their pump experience. Tobacco shops rarely either. Coffee/food truck operators actively live and die by reviews — Rita is Core there.

---

## Onboarding Configuration by Primary Vertical

When an operator selects their `primaryVertical`, AROS configures:

### Pre-installed Agents (auto-added to workspace)

| Primary Vertical | Pre-installed Agents |
|-----------------|---------------------|
| `qsr` | Ellie, Ana, Sammy, Victor, Larry, Rita |
| `fsr` | Ellie, Ana, Sammy, Victor, Larry, Rita |
| `bar-nightclub` | Ellie, Sammy, Victor, Larry |
| `coffee-smoothie` | Ellie, Ana, Sammy, Larry, Rita |
| `bakery` | Ellie, Ana, Sammy, Larry |
| `food-truck` | Ellie, Ana, Sammy, Rita |
| `catering` | Ellie, Ana, Sammy, Larry |
| `c-store` | Ellie, Ana, Sammy, Victor |
| `gas-station` | Ellie, Sammy, Victor |
| `liquor-store` | Ellie, Ana, Sammy, Victor |
| `tobacco` | Ellie, Ana, Sammy, Victor |
| `gift-store` | Ellie, Sammy |
| `retail-general` | Ellie, Sammy, Ana |

### Ellie's Default Context Framing by Vertical

Ellie's system prompt adjusts her framing based on `primaryVertical`:

| Vertical | Ellie's Opening Frame |
|----------|----------------------|
| `qsr` | "Your business is throughput and consistency. I track speed, labor, and margin." |
| `fsr` | "Your business is experience and table economics. I track covers, check avg, and labor." |
| `bar-nightclub` | "Your business is late-night revenue with high void risk. I watch pour cost and voids closely." |
| `coffee-smoothie` | "Your business is ticket velocity and product consistency. I track hourly sales and item mix." |
| `bakery` | "Your business is perishables and morning rush. I watch what's selling and what's spoiling." |
| `food-truck` | "Your business is event-driven and lean. I track your best days and help you replicate them." |
| `catering` | "Your business is batch and event-based. I help you plan labor and inventory per event." |
| `c-store` | "Your business is high-SKU, high-traffic. I watch your top sellers, shrink, and void patterns." |
| `gas-station` | "Your business is margin-thin and high-volume. I watch fuel margin, c-store mix, and shrink." |
| `liquor-store` | "Your business is high-value, age-gated inventory. I watch your top movers and shrink closely." |
| `tobacco` | "Your business is compliance-heavy with high shrink risk. I watch your void and shrink patterns." |
| `gift-store` | "Your business is seasonal and margin-driven. I watch your top sellers and seasonal trends." |
| `retail-general` | "Your business is inventory breadth. I watch turnover, margin, and your best-performing categories." |

---

## Operator Profile Schema

```typescript
interface OperatorProfile {
  operatorId: string;
  tenantId: string;

  // Industry
  segment: 'food-service' | 'retail' | 'fuel-convenience' | 'specialty';
  verticals: VerticalCode[];         // can be multi (e.g. gas station + c-store + deli)
  primaryVertical: VerticalCode;     // drives onboarding + default agent config

  // Language
  preferredLanguage: string;         // ISO 639-1 (e.g. "es", "en", "pt")
  fallbackLanguage: 'en';

  // Locale
  timezone: string;                  // IANA tz (e.g. "America/New_York")
  currency: string;                  // ISO 4217 (e.g. "USD")
  unitSystem: 'imperial' | 'metric';

  // AROS tier
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  locationCount: number;

  // Agent config (populated at onboarding from primary vertical defaults)
  installedAgents: AgentId[];
  agentConfig: Record<AgentId, AgentConfig>;
}

type VerticalCode =
  | 'qsr' | 'fsr' | 'bar-nightclub' | 'coffee-smoothie'
  | 'bakery' | 'food-truck' | 'catering'
  | 'c-store' | 'gas-station'
  | 'liquor-store' | 'tobacco'
  | 'gift-store' | 'retail-general'
  | 'pharmacy' | 'grocery';
```

---

## Agent Manifest Schema

Each agent's config file declares its vertical relevance. Used by the marketplace to filter and rank agents.

```typescript
interface AgentManifest {
  agentId: string;
  name: string;
  emoji: string;
  description: string;
  tier: ('free' | 'starter' | 'pro' | 'enterprise')[];  // tiers where available

  verticalRelevance: Partial<Record<VerticalCode, 'core' | 'supported' | 'limited' | 'n/a'>>;
  // omitted verticals default to 'supported'

  languages: string[];   // ISO 639-1 codes; ['*'] = all
  reportingChain: string[];  // agentIds this agent reports through (e.g. ['ellie', 'shre'])
}
```

---

## Agent Manifests

### Ellie ✨
```json
{
  "agentId": "ellie",
  "name": "Ellie",
  "emoji": "✨",
  "description": "Your primary business intelligence interface. Answers any question about your operations.",
  "tier": ["free", "starter", "pro", "enterprise"],
  "verticalRelevance": {},
  "languages": ["*"],
  "reportingChain": ["shre"]
}
```
*(All verticals Core by default — omitted = supported, but Ellie is explicitly universal)*

### Ana 📦
```json
{
  "agentId": "ana",
  "name": "Ana",
  "emoji": "📦",
  "description": "Inventory intelligence. Tracks item velocity, predicts stockouts, surfaces waste patterns.",
  "tier": ["free", "starter", "pro", "enterprise"],
  "verticalRelevance": {
    "qsr": "core", "fsr": "core", "coffee-smoothie": "core",
    "bakery": "core", "food-truck": "core", "catering": "core",
    "c-store": "core", "liquor-store": "core", "tobacco": "core",
    "gas-station": "supported", "gift-store": "supported",
    "retail-general": "supported"
  },
  "languages": ["*"],
  "reportingChain": ["ellie", "shre"]
}
```

### Sammy 📈
```json
{
  "agentId": "sammy",
  "name": "Sammy",
  "emoji": "📈",
  "description": "Revenue and P&L intelligence. Real-time margin tracking, day-over-day comps, financial clarity.",
  "tier": ["free", "starter", "pro", "enterprise"],
  "verticalRelevance": {},
  "languages": ["*"],
  "reportingChain": ["ellie", "shre"]
}
```
*(Universal — all verticals Core)*

### Victor 🔎
```json
{
  "agentId": "victor",
  "name": "Victor",
  "emoji": "🔎",
  "description": "Revenue integrity. Tracks void patterns, comp anomalies, and potential fraud — discreetly.",
  "tier": ["starter", "pro", "enterprise"],
  "verticalRelevance": {
    "qsr": "core", "fsr": "core", "bar-nightclub": "core",
    "c-store": "core", "gas-station": "core",
    "liquor-store": "core", "tobacco": "core",
    "coffee-smoothie": "supported", "bakery": "supported",
    "catering": "supported", "gift-store": "supported",
    "retail-general": "supported",
    "food-truck": "limited"
  },
  "languages": ["*"],
  "reportingChain": ["ellie", "shre"]
}
```

### Larry 👷
```json
{
  "agentId": "larry",
  "name": "Larry",
  "emoji": "👷",
  "description": "Labor and scheduling intelligence. Tracks labor cost, overtime risk, and coverage gaps.",
  "tier": ["starter", "pro", "enterprise"],
  "verticalRelevance": {
    "qsr": "core", "fsr": "core", "bar-nightclub": "core",
    "coffee-smoothie": "core", "bakery": "core", "catering": "core",
    "food-truck": "supported",
    "c-store": "supported", "gas-station": "supported",
    "liquor-store": "supported", "tobacco": "supported",
    "gift-store": "supported", "retail-general": "supported"
  },
  "languages": ["*"],
  "reportingChain": ["ellie", "shre"]
}
```

### Rita ⭐
```json
{
  "agentId": "rita",
  "name": "Rita",
  "emoji": "⭐",
  "description": "Reputation and guest voice. Aggregates reviews, detects patterns, drafts responses in your voice.",
  "tier": ["starter", "pro", "enterprise"],
  "verticalRelevance": {
    "qsr": "core", "fsr": "core",
    "coffee-smoothie": "core", "food-truck": "core",
    "bar-nightclub": "supported", "catering": "supported",
    "liquor-store": "supported", "gift-store": "supported",
    "retail-general": "supported",
    "bakery": "supported",
    "c-store": "limited", "tobacco": "limited",
    "gas-station": "n/a"
  },
  "languages": ["*"],
  "reportingChain": ["ellie", "shre"]
}
```

---

## Marketplace Discovery Logic

When an operator browses the AROS marketplace:

1. **Filter by relevance** — `core` agents surface first, `n/a` agents hidden
2. **Sort within tier** — Core → Supported → Limited
3. **Tier gate** — Agents above operator's tier show as "upgrade to unlock"
4. **Pre-installed badge** — Agents already in the operator's workspace show as installed
5. **Language filter** — Operators can filter by language support (future: developer-declared per-agent language support)

---

*Last updated: 2026-03-20*
*Owner: AROS Platform / Shre AI*
