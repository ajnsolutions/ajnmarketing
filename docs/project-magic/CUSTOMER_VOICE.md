# Customer Voice — Experience

**Status:** Shipped (customer-facing experience over Phase 1 foundation)  
**Branch:** `project-magic/customer-voice-experience`  
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

Customer Voice is reusable Business Brain intelligence. This sprint makes that intelligence **visible** throughout the product — like talking to an experienced Head of Marketing, not reading an analytics report.

The Phase 1 foundation (providers → normalize → themes → confidence/impact → score → `getCustomerVoiceIntelligence`) is unchanged. Experience layers **consume** the package; they do not re-analyze raw reviews.

Companion: product principles in [`PRODUCT_PRINCIPLES.md`](../PRODUCT_PRINCIPLES.md).

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
┌───────────────────────────────────────────────────┐
│ Experience consumers (this sprint)                │
│  • Customer Voice page                            │
│  • Possible Actions (suggestions only)            │
│  • Marketing Copy Suggestions                     │
│  • Growth Advisor (natural references)            │
│  • Customer Voice Health (Marketing Health strip) │
│  • Content Generator (authentic language)         │
└───────────────────────────────────────────────────┘
```

**Generate once. Reuse everywhere.**

---

## Customer-facing experience

Route: `/dashboard/customer-voice`  
UI: `components/dashboard/customer-voice-page.tsx`  
Model: `buildCustomerVoicePageModel` in `lib/customer-voice/presentation.ts`

Conversational sections (not a dashboard):

1. What customers consistently love
2. Opportunities to improve
3. Words customers naturally use
4. Services customers mention most
5. Recent customer trends
6. Suggested marketing opportunities

Each insight shows:

- Confidence
- Business Impact
- Supporting review count
- Trend
- **Why I believe this** (explainability — evidence counts + language, never chain-of-thought)

Empty / low-review states stay honest (“still establishing a baseline”) and never invent praise.

Nav: listed under More tools next to Reviews; also in `HOM_ADVANCED_NAV_HREFS`.

---

## Possible Actions

`lib/customer-voice/possibleActions.ts`

Every insight exposes **Insight → Possible Actions** (e.g. highlight on homepage, Google Business profile, social, email).

- Suggestions only
- **Never prioritized here**
- Recommendation Engine / Marketing Director remain responsible for prioritization

---

## Marketing Copy Suggestions

`lib/customer-voice/copySuggestions.ts`

Reusable service that builds concise suggestions **only** from recurring Customer Voice themes:

| Surface | Example use |
|---|---|
| Website headline | Homepage hero |
| Google Business description | GBP about text |
| Social post opener | Organic social |
| Email subject | Campaign subject |
| About page wording | Website about |

Rules:

- Never fabricate claims
- Only themes with recurring support (`evidenceCount` + confidence gate)
- Returns `[]` when evidence is too thin

Also exports `formatCustomerVoiceForContentPrompt` for Content Generator.

---

## Growth Advisor integration

`buildGrowthAdvisorBriefing(..., { customerVoice })`

- Reuses the existing recommendation pipeline
- Still exactly **one** primary recommendation
- Adds natural Customer Voice context on the recommendation (e.g. “Customers consistently praise…”)
- May surface a Customer Voice line in “What I noticed”
- Does **not** re-rank or invent recommendations

Dashboard home loads Customer Voice alongside Business Discovery and passes it into the briefing transform.

---

## Marketing Health integration

`lib/customer-voice/health.ts` → `resolveCustomerVoiceHealth`

Customer Voice Health is a **separate** strip from Marketing Health. States:

| State | Meaning |
|---|---|
| Healthy | Recurring feedback is well established |
| Emerging Concerns | High-impact concerns with support |
| Limited Feedback | Themes exist but coverage is thin |
| Establishing Baseline | No / insufficient evidence |

Never fabricates trends. Shown on the Customer Voice page and in Growth Advisor supporting context.

---

## Content Generator integration

`loadGenerationContext` loads Customer Voice and attaches `customerVoicePromptBlock`.

`buildContentGenerationPrompt` / marketing-plan prompts instruct the model to:

- Weave recurring customer phrases and authentic strengths **naturally**
- Never keyword-stuff
- Never invent praise when the block is absent or thin

---

## Explainability

Every insight explains (customer-safe only):

- Why the AI believes this (evidence + language variants)
- Confidence
- Business Impact
- Supporting review count
- Trend

**Never** expose chain-of-thought or internal numeric Customer Voice Score.

---

## Provider interface (foundation)

`lib/customer-voice/provider.ts`

```ts
interface CustomerVoiceProvider {
  readonly id: CustomerVoiceProviderId;
  readonly label: string;
  fetchEvidence(context): Promise<CustomerVoiceProviderResult>;
}
```

**Implemented:** `google_business_reviews`

**Designed, not implemented:** Facebook, Yelp, BBB, website testimonials, surveys, NPS, support tickets, live chat, email feedback.

---

## Evidence normalization / themes / confidence / impact / score

Unchanged from Phase 1 — see modules:

| Module | Role |
|---|---|
| `normalize.ts` | Evidence normalization |
| `themes.ts` + `themeLexicon.ts` | Theme extraction + clustering |
| `confidence.ts` | Low / Medium / High |
| `impact.ts` | Business Impact (not frequency alone) |
| `score.ts` | Internal 0–100 + maturity copy |
| `compose.ts` | Intelligence package |
| `service.ts` | Business Brain entry |

---

## Extension guide

1. Add a `CustomerVoiceProviderIds` value if needed.
2. Implement `CustomerVoiceProvider.fetchEvidence` → `ProviderEvidenceInput[]`.
3. Pass the provider into `getCustomerVoiceIntelligence({ providers: [...] })` or extend `defaultProviders`.
4. Do **not** teach Growth Advisor about the new provider — it only reads `CustomerVoiceIntelligence`.

---

## Explicit non-goals (this sprint)

- No redesign of the application shell
- No automatic prioritization of Possible Actions
- No new recommendation ranking / scoring
- No schedule activation (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` stays false)
- No merge / deploy from this branch alone

---

## Module map (experience additions)

| Module | Role |
|---|---|
| `possibleActions.ts` | Insight → Possible Actions |
| `copySuggestions.ts` | Marketing Copy Suggestions + CG prompt block |
| `health.ts` | Customer Voice Health states |
| `presentation.ts` | Page model, explainability, GA lines |
| `app/dashboard/customer-voice/page.tsx` | Route |
| `components/dashboard/customer-voice-page.tsx` | Conversational UI |
