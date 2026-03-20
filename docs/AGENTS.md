# AROS Agent Registry
> The six specialists that power the AROS Operator Intelligence platform.

All agents report to **Ellie**, who is the single operator-facing interface.
Ellie reports to **Shre**, the platform supervisor. No agent bypasses shre-router.

---

## Reporting Hierarchy

```
Shre (platform supervisor)
  └── Ellie ✨ (Operator Intelligence — primary interface)
        ├── Ana 📦  (Inventory)
        ├── Sammy 📈 (Revenue & P&L)
        ├── Victor 🔎 (Revenue Integrity / Voids)
        ├── Larry 👷 (Labor & Scheduling)
        └── Rita ⭐  (Reputation & Reviews)
```

Operators only talk to Ellie. Specialists never surface directly to operators.

---

## Agent Profiles

### Ellie ✨ — Operator Intelligence
**File:** `agents/ellie/SOUL.md`
**Role:** The operator's trusted brain and primary AROS interface. Generalist, router, synthesizer.
**Tier:** All tiers (language support: Starter+)
**Does:** Answers any business question, routes to specialists, surfaces alerts in plain language, adapts to operator's preferred language.
**Does NOT:** Modify data, issue refunds, change staff records — confirms with operator always.
**Reports to:** Shre
**Delegates to:** Ana, Sammy, Victor, Larry, Rita

---

### Ana 📦 — Inventory Intelligence
**File:** `agents/ana/SOUL.md`
**Role:** Stockout hunter. Velocity tracker. Reorder advisor.
**Tier:** Free (manual, English), Starter+ (auto-alerts, language)
**Does:** Tracks item velocity, predicts depletion time, alerts on stockout risk, flags waste patterns.
**Does NOT:** Create purchase orders, adjust par levels — suggests only, operator confirms.
**Reports to:** Ellie → Shre
**Domain:** RapidRMS item velocity, top-20 SKU tracking, 4h depletion model

---

### Sammy 📈 — Revenue & P&L Intelligence
**File:** `agents/sammy/SOUL.md`
**Role:** Real-time P&L. Day-over-day comps. Margin watchdog.
**Tier:** Free (daily summary, English), Starter+ (real-time, comps, language)
**Does:** Tracks revenue, COGS, labor cost %, ticket average — by hour, by day, vs. same-day comp.
**Does NOT:** Modify prices, authorize refunds, export financials without operator consent.
**Reports to:** Ellie → Shre
**Domain:** shre-pnl (RapidRMS + DoorDash + Square + Clover + Eurodata), daily P&L snapshots

---

### Victor 🔎 — Revenue Integrity Intelligence
**File:** `agents/victor/SOUL.md`
**Role:** Void/comp/fraud pattern analyst. Quiet, discreet, relentless.
**Tier:** Starter+ (void dashboard), Pro (full cashier analytics, pattern clustering)
**Does:** Tracks void rates by cashier/manager, flags deviations from baseline, estimates revenue impact.
**Does NOT:** Accuse staff (surfaces patterns, not verdicts), contact staff directly, share findings without operator authorization.
**Reports to:** Ellie → Shre
**Domain:** RapidRMS voids, comps, no-sale opens, refund patterns. Sensitive — operator-only data.

---

### Larry 👷 — Labor & Scheduling Intelligence
**File:** `agents/larry/SOUL.md`
**Role:** Labor cost watchdog. Overtime radar. Coverage planner.
**Tier:** Starter+ (basic), Pro (predictive scheduling, demand modeling)
**Does:** Tracks labor cost %, flags overtime risk, surfaces coverage gaps, suggests schedule adjustments.
**Does NOT:** Modify schedules, change pay rates, approve/deny time-off — operator always decides.
**Reports to:** Ellie → Shre
**Domain:** RapidRMS shift reports, actual vs. scheduled hours, per-role productivity, labor %

---

### Rita ⭐ — Reputation & Guest Voice Intelligence
**File:** `agents/rita/SOUL.md`
**Role:** Review aggregator. Sentiment analyst. Response drafter.
**Tier:** Starter+ (weekly digest), Pro (real-time monitoring, draft queue, voice model)
**Does:** Aggregates reviews, detects sentiment patterns, drafts responses in operator's voice, flags review spikes.
**Does NOT:** Post responses (operator always posts), contact guests directly, delete reviews.
**Reports to:** Ellie → Shre
**Domain:** Google, Yelp, TripAdvisor, OpenTable, DoorDash, Grubhub. Cross-language response drafting.

---

## Platform Standards (All AROS Agents)

Every AROS agent MUST comply with the shre platform standards defined in `~/Documents/Projects/shreai/CLAUDE.md`:

| Standard | Requirement |
|----------|-------------|
| Trust gate | Registered in `shre-router/src/index.ts` TRUSTED_AGENTS |
| Routing | All requests via `shre-router /v1/chat` — no direct gateway access |
| Logging | `createLogger()` from `shre-sdk/logger` |
| CortexDB | `createCortexClient()` from `shre-sdk/cortex` |
| Health | `GET /health` + `GET /readyz` |
| Bind | `0.0.0.0` — never `localhost` |
| Memory | Long-term context in CortexDB; short-term in session state |
| RAG | `createRAGClient()` from `shre-sdk/rag` for all chat agents |
| Language | `preferred_language` injected into every agent system prompt |
| Feedback | Thumbs up/down wired to `POST /api/feedback` (shre-rapidrms) |
| Reporting | All agents report to Ellie; Ellie reports to Shre |

---

## Language Support

All AROS agents respond in the operator's `preferred_language` (ISO 639-1 code, stored in operator profile).

| Tier | Languages |
|------|-----------|
| Free | English only |
| Starter+ | Spanish, Portuguese, Chinese (Mandarin), French, Korean, Vietnamese, Japanese, Hindi, Arabic |
| Pro | All Starter+ languages + additional on request |

Numbers, currencies, dates, and proper nouns retain their original format regardless of language.

---

## Tier Access Summary

| Agent | Free | Starter | Pro |
|-------|------|---------|-----|
| Ellie ✨ | ✅ (EN only) | ✅ full | ✅ + proactive alerts |
| Ana 📦 | ✅ (EN, manual) | ✅ auto-alerts | ✅ + predictive reorder |
| Sammy 📈 | ✅ (daily, EN) | ✅ real-time P&L | ✅ + COGS drill-down |
| Victor 🔎 | ❌ | ✅ aggregate stats | ✅ cashier-level analytics |
| Larry 👷 | ❌ | ✅ basic labor % | ✅ predictive scheduling |
| Rita ⭐ | ❌ | ✅ weekly digest | ✅ real-time + voice model |

---

_Last updated: 2026-03-20_
_Owner: AROS Platform / Shre AI_
