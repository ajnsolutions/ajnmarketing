# Customer Voice — Phase 1 Foundation

**Status:** Shipped (intelligence foundation)  
**Branch:** `project-magic/customer-voice-phase1-foundation`  
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

Customer Voice is **not a feature page**. It is a reusable intelligence source for the Business Brain.

Phase 1 builds the architecture only. Phase 2 will wire Growth Advisor, Marketing Health, Content Generator, and any customer-facing surfaces.

Companion design intent (pre-implementation): the sections below supersede the earlier aspirational draft for **as-built Phase 1**. Product principles in [`PRODUCT_PRINCIPLES.md`](../PRODUCT_PRINCIPLES.md) still apply: never simply `COUNT()`/`AVG()` reviews.

---

## Architecture

```
Provider (Google Business Reviews today; more later)
        ↓
Evidence Normalization
        ↓
Theme Extraction + Clustering
        ↓
Confidence + Business Impact
        ↓
Customer Voice Intelligence package
        ↓
Business Brain service (getCustomerVoiceIntelligence)
        ↓
(future) Growth Advisor / Content / Health / Market Radar / agents
```

**Generate once. Reuse everywhere.** No consumer should re-analyze raw reviews.

Business Brain consumers must never branch on provider-specific payloads — only on `CustomerVoiceIntelligence` / `NormalizedCustomerEvidence`.

---

## Provider interface

`lib/customer-voice/provider.ts`

```ts
interface CustomerVoiceProvider {
  readonly id: CustomerVoiceProviderId;
  readonly label: string;
  fetchEvidence(context): Promise<CustomerVoiceProviderResult>;
}
```

**Implemented (Phase 1):** `google_business_reviews` → `createGoogleBusinessReviewsProvider`

**Designed, not implemented:**

| Provider id | Intent |
|---|---|
| `facebook_reviews` | Facebook recommendations / ratings |
| `yelp_reviews` | Yelp public reviews |
| `bbb` | Better Business Bureau feedback |
| `website_testimonials` | On-site testimonials |
| `customer_surveys` | Structured survey responses |
| `nps` | NPS comments |
| `support_tickets` | Support ticket bodies |
| `live_chat` | Chat transcripts |
| `email_feedback` | Customer email feedback |

Adding a provider = implement `CustomerVoiceProvider` + register it. No Business Brain consumer changes required.

---

## Evidence normalization

`lib/customer-voice/normalize.ts`

Every provider maps to `NormalizedCustomerEvidence`:

- Source (opaque provider id + human source label)
- Date
- Sentiment
- Confidence
- Original text (bounded)
- Extracted themes (canonical keys)
- Referenced services / employees
- Language
- Evidence weight (recency + text richness)

Duplicate themes across providers land in the **same canonical theme key**, increasing evidence count, provider count, and confidence.

Example:

- Google: “Fast service”
- Facebook (future): “Quick turnaround”
- Survey (future): “Same-day response”  
→ theme `fast_service` / **Fast Service** with higher confidence

---

## Theme extraction

`lib/customer-voice/themes.ts` + `themeLexicon.ts`

Deterministic Phase 1 extraction (no new AI engine):

- Recurring praise / complaints / requests / differentiators
- Emotional tone from text + rating
- Customer language snippets (short phrases, not summaries)
- Service and employee mentions
- Synonym clustering (`fast` / `quick` / `same-day` → Fast Service)

Isolated single reviews stay low-confidence and are de-emphasized in top lists.

---

## Confidence model

`lib/customer-voice/confidence.ts`

Levels: **Low / Medium / High**

Inputs:

- Supporting evidence count
- Percentage of reviews
- Multi-provider support
- Recency share
- Sentiment consistency

Never exaggerates: `<2` supporting evidence or `<5%` coverage → Low.

Stored on each theme: `confidence`, `evidenceCount`, `percentageOfReviews`, `evidenceIds`.

---

## Business Impact model

`lib/customer-voice/impact.ts`

Levels: **Low / Medium / High**

Considers acquisition, conversion, repeat, referrals, and reputation hints — **not frequency alone**. A rare conversion-critical concern can outrank a very common soft-praise theme.

---

## Customer Voice Score (internal)

`lib/customer-voice/score.ts`

- Numeric **0–100** for internal reliance only — **never shown to customers**
- Breakdown: volume, freshness, coverage, confidence, theme consistency, sentiment stability
- Natural language only:
  - “Customer feedback is well established.”
  - “Customer feedback is still limited.”
  - “The advisor is continuing to learn.”

Intended future consumers of the *internal* score: Growth Advisor confidence, Content Generator confidence, recommendation confidence, autonomous action gating — **not wired in Phase 1**.

---

## Business Brain service

`lib/customer-voice/service.ts`

```ts
getCustomerVoiceIntelligence({ userId, businessProfileId, ... })
getCustomerVoiceIntelligenceForCurrentUser(businessProfileId)
```

Loads provider evidence (Google reviews today), normalizes, composes `CustomerVoiceIntelligence`.

Future consumers (Phase 2+): Growth Advisor, Content Generator, Marketing Health, Market Radar, Smart Uploads, agents.

---

## Domain package shape

`CustomerVoiceIntelligence` includes:

Strengths · Concerns · Opportunities · Frequently Mentioned Services · Frequently Mentioned Employees · Common Customer Language · Requests · Sentiment Trends · Confidence · Business Impact · Evidence Count · Percentage Covered · Trend Direction · Last Updated · Internal Score · Empty state

---

## Extension guide

1. Add a `CustomerVoiceProviderIds` value if needed.
2. Implement `CustomerVoiceProvider.fetchEvidence` → `ProviderEvidenceInput[]`.
3. Pass the provider into `getCustomerVoiceIntelligence({ providers: [...] })` or extend `defaultProviders`.
4. Do **not** teach Growth Advisor about the new provider — it only reads `CustomerVoiceIntelligence`.

---

## Explicit Phase 1 non-goals

- No Customer Voice UI / page
- No Growth Advisor integration
- No Marketing Health integration
- No Content Generator integration
- No new AI theme model
- No schedule activation

---

## Module map

| Module | Role |
|---|---|
| `types.ts` | Domain model |
| `provider.ts` | Provider contract + registry |
| `providers/googleBusinessReviews.ts` | Initial provider |
| `normalize.ts` | Evidence normalization |
| `themeLexicon.ts` / `themes.ts` | Extraction + clustering |
| `confidence.ts` / `impact.ts` / `score.ts` | Models |
| `compose.ts` | Intelligence composition |
| `service.ts` | Business Brain entrypoint |
| `index.ts` | Public pure exports |
