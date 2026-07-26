# Business Discovery Engine

**Status:** Backend orchestration only — no UI, no new data collection, no schema change
**Branch:** `project-magic/2-0-wave1-business-discovery`
**Part of:** [Project Magic 2.0, Wave I](./project-magic/IMPLEMENTATION_ROADMAP.md#wave-i--free-marketing-snapshot--business-brain-foundation)
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched by this work

---

## What this is

AI Business Discovery is the new orchestration layer that composes AJN Marketing's *existing* intelligence — website analysis, the AI Marketing Profile, Google Business Profile connection state, public Google reviews, and Market Context — into one honest, explainable read of a business.

It is the backend foundation for the future **Free Marketing Snapshot** ([`project-magic/FREE_MARKETING_SNAPSHOT.md`](./project-magic/FREE_MARKETING_SNAPSHOT.md)): the "What Customers See" experience a prospect will eventually see before signup. This wave builds the orchestration and domain model only — no UI, and no public/pre-auth entry point yet (this runs against an existing authenticated business profile).

**What it is not:** a new decision engine, a new data source, or a redesign of anything it reads from. It introduces zero new database tables and zero new external calls — every fact it surfaces comes from a system that already exists and was already reviewed.

## Product goal

> "This system already understands my business" — not "I have another long setup form."

Business Discovery achieves this by reading what the product already knows (from onboarding, a connected website, a connected Google Business Profile) and presenting it back as understanding, honestly labeling anything it can't yet confirm, rather than asking the owner to re-enter information the product could infer or already has.

## Product Decision Filter — verified

Per [`project-magic/PRODUCT_DECISION_FILTER.md`](./project-magic/PRODUCT_DECISION_FILTER.md), every yes is required:

| Question | Answer |
|---|---|
| Makes the product simpler? | **Yes.** It replaces "ask the owner" with "read what we already have and say so honestly" — the eventual Free Marketing Snapshot removes onboarding questions the Business Brain can already answer. |
| Helps the business grow? | **Yes.** A more complete, honest understanding of the business is the direct input to better recommendations, forecasts, and the Free Marketing Snapshot's first proof moment. |
| AI performs meaningful work? | **Yes.** It reads and reconciles multiple real sources, resolves conflicts, and produces plain-language explanations — not a raw data dump. |
| Easy for non-technical owners? | **Yes, by design, even though this wave ships no UI.** Every insight is structured so a future screen can render it as a plain sentence with a source and a reason — the architecture is what makes that easy, and is reviewed here specifically for that. |
| Fits the Growth Engine vision? | **Yes.** This *is* the Business Brain composition layer described in [`project-magic/BUSINESS_BRAIN.md`](./project-magic/BUSINESS_BRAIN.md) — understanding the business better than it has time to understand itself. |

## Architecture

```
lib/business-discovery/
  types.ts         Domain model — sources, confidence tiers, observations,
                   UnifiedBusinessProfile, BusinessDiscoveryResult. Pure data.
  confidenceLabels.ts
                   Plain-language Business Confidence Score labels — mirrors
                   the existing rule in lib/recommendation-presentation/
                   confidenceLabels.ts: never a raw percentage, always a label
                   + honest explanation.
  collectors.ts    Pure functions: one per existing source, each turning
                   already-fetched data into BusinessDiscoveryObservation[].
                   No I/O. Fully unit tested without a database.
  normalize.ts     Pure: observations[] -> UnifiedBusinessProfile. Merges and
                   deduplicates across sources; a verified fact always wins
                   over an AI inference for scalar fields; list fields union
                   and case-insensitively dedupe.
  buildResult.ts   Pure: UnifiedBusinessProfile -> BusinessDiscoveryResult.
                   Assigns Known/Assumed/Missing tiers, builds the
                   Source + Confidence + Reason explanation for every insight,
                   computes the Business Confidence Score, and lists missing
                   information with a suggested next action.
  gather.ts        The only I/O — fetches every existing source in parallel
                   for one user (server-only).
  service.ts       Orchestrates gather -> collect -> normalize -> build
                   (server-only). Exposes runBusinessDiscoveryForUserId and
                   runBusinessDiscoveryForCurrentUser.
```

### The First Impression flow (backend only, per this wave's scope)

```
Business Discovery (gather + collect)
        │
        ▼
Unified Business Profile (normalize)
        │
        ▼
Business Discovery Result (buildResult)
        │
        ▼
(future) Free Marketing Snapshot UI
```

No step in this pipeline writes anything. No step triggers a website analysis, an AI Marketing Profile generation, or any other side-effecting job — Business Discovery only reads what already exists. If a source hasn't run yet (e.g. no website analysis), Business Discovery reports that honestly as **Missing**; it never triggers the underlying job itself. Wiring "Business Discovery noticed X is missing, so let's kick off Y" is an intentional Phase 2 decision, not something this wave does silently.

## Existing components reused

| Component | How it's reused |
|---|---|
| `lib/business-profile-server.ts` (`getBusinessProfileForUserId`) | Owner-entered profile fields — the highest-trust source (Known tier) |
| `lib/website-analysis/persistence.ts` (`getWebsiteAnalysisForUser`) | AI-extracted website content — read only when `analysis_status === "completed"` |
| `lib/ai-marketing-profile/persistence.ts` (`getAiMarketingProfileForUser`) | The synthesized AI Marketing Profile — read only when `profile_status === "active"` |
| `lib/google-business-profile/service.ts` (`getGoogleBusinessProfileConnectionStatusForUser`) | Real connection state (connected/not connected), reusing the existing customer-safe status model |
| `lib/google-business/persistence.ts` (`getGoogleBusinessReviewsForUser`) | Real public review data — rating and count, honestly summarized (full theme/sentiment analysis is Customer Voice, a separate future wave — see below) |
| `lib/market-context/marketContextService.ts` (`getLatestMarketContextBriefForUser`) | Existing competitor signals, already scored and evidence-linked |

No new Supabase tables, no new external API integrations, no new auth flow. Every accessor above already existed, was already reviewed, and already enforces tenant isolation the same way the rest of the product does — Business Discovery adds no new trust boundary.

## New abstractions created

- **`DiscoverySourceType`** — an extensible, named set of source categories (website, Google Business Profile, public reviews, social presence, AI website analysis, AI Marketing Profile, Market Context, future connector, Smart Upload). Adding a new source is additive: a new value here, plus one new collector function — no existing collector, or either downstream type, needs to change.
- **`DiscoveryConfidenceTier`** (Known / Assumed / Missing) — the vocabulary this whole engine is built around, per this wave's explicit requirement.
- **`BusinessDiscoveryObservation`** — the raw, source-tagged fact layer; this *is* the "raw observations" layer of the Business Brain (see [`project-magic/BUSINESS_BRAIN.md`](./project-magic/BUSINESS_BRAIN.md)).
- **`UnifiedBusinessProfile`** — the normalized, deduplicated midpoint between raw observations and narrative output.
- **`DiscoveryInsight<T>`** — the explainability unit: every discovered value carries `sources`, `confidenceTier`/`confidenceScore`, and a plain-language `reason`, satisfying this wave's explainability requirement (e.g. *"We believe your primary audience is homeowners because your website repeatedly references residential HVAC installation."*).
- **`BusinessDiscoveryResult`** — the final output, organized around business understanding (Business Summary, Primary Services, Target Customers, Brand Personality, Unique Strengths, Customer Perception, Competitive Position, Online Presence, Growth Opportunities, Missing Information, Business Confidence Score) rather than marketing metrics.

## Where discovered information lives — the Business Brain, made explicit

This wave does not add a new persistent store. It composes from data that already lives in existing tables (`business_profiles`, `website_analysis`, `ai_marketing_profiles`, Google Business Profile/reviews tables, `market_context_items`). The Business Discovery *result* itself is computed on demand and not persisted — the same pattern already established by `buildMarketingMemoryEvidencePackage` (Marketing Memory's evidence composition, also computed on demand rather than stored redundantly).

Mapped onto the four-layer Business Brain model from [`project-magic/BUSINESS_BRAIN.md`](./project-magic/BUSINESS_BRAIN.md):

| Business Brain layer | Where it lives today | Business Discovery's relationship to it |
|---|---|---|
| **Raw observations** | The existing source tables themselves (`business_profiles`, `website_analysis`, `ai_marketing_profiles`, Google Business Profile/review tables, `market_context_items`) | `BusinessDiscoveryObservation[]` is a *read-time reshaping* of these rows — it does not duplicate them into a new table |
| **AI reasoning** | `website_analysis.raw_summary`, `ai_marketing_profiles.*` (already AI-generated) | Read as-is; Business Discovery adds a further reasoning step (merging + explaining), but does not regenerate or second-guess the underlying AI output |
| **User-confirmed facts** | `business_profiles.*` (owner-entered via onboarding/Settings) | Always tiered as **Known** and always wins over an AI inference in `normalize.ts` |
| **Future learned knowledge** | Not yet built — this is Marketing Memory's `learnings` layer (see [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md)) | Out of scope for this wave. Business Discovery is a *read* composition; it does not write a learning, and does not compete with Marketing Director as a decision-maker. A future wave may feed Business Discovery Result *into* Marketing Memory as a new observation type — not attempted here. |

## Explainability

Every `DiscoveryInsight` carries:

- **Source** — which existing system(s) contributed (`sources: DiscoverySourceType[]`)
- **Confidence** — `confidenceTier` (Known/Assumed/Missing) plus an internal `confidenceScore`, never shown to a customer as a raw number (see [`confidenceLabels.ts`](../lib/business-discovery/confidenceLabels.ts), which mirrors the existing rule in `lib/recommendation-presentation/confidenceLabels.ts`)
- **Reason** — a plain-language sentence, e.g. *"We believe your primary audience is homeowners because your website repeatedly references residential HVAC installation."*

This is enforced structurally, not by convention: `BusinessDiscoveryResult`'s type makes it impossible to add a field without also supplying a reason.

## Honest placeholders (explicit, not silent gaps)

Per this wave's explicit allowance ("include placeholders, or initial implementations where data exists"):

- **Customer Perception** ships an initial implementation (real review count + average rating from connected Google Business reviews), explicitly *not* the full theme/sentiment analysis described in [`project-magic/CUSTOMER_VOICE.md`](./project-magic/CUSTOMER_VOICE.md) — that remains Wave III work. The reason text says so plainly rather than implying a richer analysis happened.
- **Social Presence** always resolves to Missing today — no social connector exists yet (confirmed via [`project-magic/EXISTING_SYSTEM_AUDIT.md`](./project-magic/EXISTING_SYSTEM_AUDIT.md)). The `DiscoverySourceTypes.SOCIAL_PRESENCE` value exists in the model so a future collector slots in without a breaking change.
- **Future Connectors** and **Smart Uploads** exist only as recognized `DiscoverySourceType` values with no collector yet — reserved extension points, not implemented sources.

## Testing

37 new unit tests across four files (`unit-tests/business-discovery-*.test.ts`), covering:

- Every collector's behavior on realistic fixtures, on null/empty sources, and on non-terminal statuses (`pending`/`running`/`failed` website analysis; non-`active` AI Marketing Profile) — confirming each degrades to an empty result rather than guessing
- Verified-fact-wins-over-inference and case-insensitive array dedupe in `normalize.ts`
- Known/Assumed/Missing tier assignment, reason-text presence, the Business Confidence Score's boundaries (all-Missing → 0 / "Just getting started"; a real mix → a mid-range score), and the missing-information list in `buildResult.ts`
- Confidence-label determinism and the "never a raw percentage in the label text" rule

`gather.ts` and `service.ts` are the only files with real I/O and are intentionally left to integration-level testing (not unit tests), consistent with this codebase's existing convention of keeping pure logic separately testable from Supabase-touching orchestration.

## Regression

No existing file was modified. This is a pure addition (`lib/business-discovery/`, its tests, and this documentation). Marketing Director, the recommendation pipeline, Campaign Intelligence, Experimentation, Decision Intelligence, Strategic Calendar, publishing/approval, Google OAuth, billing, and the Trigger.dev/cron gate are all untouched.

## Recommended Phase 2

1. **Public, pre-auth entry point.** Today's `runBusinessDiscoveryForCurrentUser` requires an authenticated session. The Free Marketing Snapshot needs a pre-auth path — likely a lightweight, public-safe variant of `gather.ts` that runs against a submitted business name/URL rather than a `userId`, per [`project-magic/FREE_MARKETING_SNAPSHOT.md`](./project-magic/FREE_MARKETING_SNAPSHOT.md).
2. **Presentation layer.** Render `BusinessDiscoveryResult` as the actual "What Customers See" UI — approve/edit/comment/correct actions per finding, per the Snapshot's wireframe ([`project-magic/WIREFRAMES.md`](./project-magic/WIREFRAMES.md#free-marketing-snapshot)).
3. **Correction feedback loop.** When an owner edits or corrects an Assumed insight, that correction should become a new, owner-authoritative observation — the mechanism by which Business Discovery's Assumed tier converts to Known over time. Not built in this wave.
4. **Customer Voice depth.** Replace the Customer Perception placeholder's rating/count summary with real theme/sentiment extraction once a Communication connector exists (see [`project-magic/CUSTOMER_VOICE.md`](./project-magic/CUSTOMER_VOICE.md)).
