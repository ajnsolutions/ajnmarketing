# External Intelligence — Foundation

**Status:** Shipped (intelligence foundation)  
**Branch:** `project-magic/external-intelligence-foundation`  
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

External Intelligence is **not a feature page**. It is a reusable intelligence source for the Business Brain — understanding the world *around* the business (seasonality, events, search demand, competitors, industry/regulatory updates, weather, holidays).

Phase 1 builds the architecture only. Phase 2 will implement live providers and wire Growth Advisor / Recommendation Engine / Marketing Health.

Companion: [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md) · [`MARKET_RADAR.md`](./MARKET_RADAR.md) · [`PRODUCT_PRINCIPLES.md`](../PRODUCT_PRINCIPLES.md)

---

## Architecture

```
Provider (designed: Trends, Weather, Events, News, GBP Insights,
          Competitors, Holidays, Search Console)
        ↓
Signal Normalization
        ↓
Confidence + Business Impact (+ corroboration across providers)
        ↓
External Intelligence package (BusinessInsight[])
        ↓
Business Brain service (getExternalIntelligence)
        ↓
(future) Recommendation Engine / Growth Advisor / Health / agents
```

**Generate once. Reuse everywhere.** No consumer should re-analyze raw provider payloads.

Business Brain consumers must never branch on provider-specific responses — only on `ExternalIntelligence` / `BusinessInsight` / `NormalizedExternalSignal`.

---

## BusinessInsight contract

`lib/business-brain/insight.ts`

Shared interface all Business Brain intelligence sources implement (or adapt to):

| Field | Purpose |
|---|---|
| `id` | Stable insight id |
| `category` | Source-specific category key |
| `insight` | Customer-safe sentence |
| `confidence` | Low / Medium / High |
| `businessImpact` | Low / Medium / High |
| `timeHorizon` | immediate / near_term / this_season / ongoing / unknown |
| `evidence` | Opaque supporting evidence (never raw provider payloads) |
| `possibleActions` | Suggestions only — never prioritized here |
| `relatedGoals` | Known goal keys only — never invented |
| `lastUpdated` | ISO timestamp |

Customer Voice keeps its theme model unchanged and adapts via `customerVoiceThemeToBusinessInsight` when a shared contract is needed. Confidence / Business Impact level *values* match the shared Business Brain vocabulary (`low` / `medium` / `high`).

---

## Provider interface

`lib/external-intelligence/provider.ts`

```ts
interface ExternalIntelligenceProvider {
  readonly id: ExternalIntelligenceProviderId;
  readonly label: string;
  fetchSignals(context): Promise<ExternalIntelligenceProviderResult>;
}
```

**Designed, not implemented (empty signals until Phase 2):**

| Provider id | Intent |
|---|---|
| `google_trends` | Search interest / demand shifts |
| `weather` | Near-term weather affecting demand |
| `local_events` | Local events relevant to marketing |
| `industry_news` | Industry & regulatory updates |
| `google_business_insights` | GBP performance / insight signals |
| `competitor_monitoring` | Public competitor activity |
| `holiday_calendar` | Holiday moments |
| `search_console` | Owned search demand evidence |

Adding a provider = implement `ExternalIntelligenceProvider` + register it. No Business Brain consumer changes required.

---

## Normalization

`lib/external-intelligence/normalize.ts`

Every provider maps to `NormalizedExternalSignal`:

- Opaque provider id + human source label
- Category
- Title / summary
- Dates / expiry
- Signal strength → evidence weight (reliability + recency + richness)
- Goal / action hints (validated later)

**Corroboration:** identical cluster keys across providers merge into one insight and increase confidence (`clusterKeyForSignal`).

---

## Confidence model

`lib/external-intelligence/confidence.ts`

Levels: **Low / Medium / High**

Inputs:

- Evidence count
- Provider corroboration count
- Average provider reliability
- Recency share
- Average evidence quality

Never exaggerates: single thin, single-source signals stay Low.

---

## Business Impact model

`lib/external-intelligence/impact.ts`

Levels: **Low / Medium / High**

Considers:

- Revenue opportunity
- Lead generation
- Customer impact
- Marketing urgency
- Operational importance

Frequency alone does not imply high impact. Category base weights + time horizon + confidence gates apply.

---

## External Intelligence Score (internal)

`lib/external-intelligence/score.ts`

- Numeric **0–100** for internal reliance only — **never shown to customers**
- Breakdown: signal volume, freshness, coverage, confidence, corroboration, category breadth
- Natural language only:
  - “Market conditions are well understood.”
  - “Market signals are still developing.”
  - “Monitoring for stronger trends.”

---

## Business Brain service

`lib/external-intelligence/service.ts`

```ts
getExternalIntelligence({ userId, businessProfileId, providers?, knownGoalKeys? })
```

Default providers are designed stubs (empty). Inject real providers in Phase 2 / tests.

Future consumers: Recommendation Engine, Growth Advisor, Marketing Health, Smart Uploads, agents.

---

## Categories (External Intelligence model)

External insights implement `BusinessInsight` with categories:

- Seasonal Opportunities
- Local Events
- Search & Demand Trends
- Competitor Activity
- Industry & Regulatory Updates
- Weather
- Holiday Calendar

Each insight includes: Insight · Confidence · Business Impact · Time Horizon · Evidence · Possible Actions · Related Goals · Last Updated.

---

## Extension guide

1. Add an `ExternalIntelligenceProviderIds` value if needed.
2. Implement `ExternalIntelligenceProvider.fetchSignals` → `ProviderSignalInput[]`.
3. Pass the provider into `getExternalIntelligence({ providers: [...] })` or extend defaults.
4. Do **not** teach Growth Advisor about the new provider — it only reads `ExternalIntelligence` / `BusinessInsight`.

---

## Explicit foundation non-goals

- No External Intelligence UI / dashboard
- No “What I'm Watching” surface
- No Growth Advisor / Marketing Health / Recommendation Engine wiring
- No live provider API integrations
- No schedule activation

---

## Module map

| Module | Role |
|---|---|
| `lib/business-brain/insight.ts` | Shared BusinessInsight contract |
| `types.ts` | External Intelligence domain model |
| `provider.ts` | Provider contract + registry |
| `providers/designed.ts` | Designed-but-empty providers |
| `normalize.ts` | Signal normalization + clustering |
| `confidence.ts` / `impact.ts` / `score.ts` | Models |
| `possibleActions.ts` | Suggestion lists by category |
| `compose.ts` | Intelligence composition |
| `service.ts` | Business Brain entrypoint |
| `index.ts` | Public pure exports |
