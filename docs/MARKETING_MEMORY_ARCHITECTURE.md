# Marketing Memory — Architecture Review & Design

**Branch:** `project-magic-marketing-memory-architecture` (from latest `main`, post–PR #50)
**Date:** 2026-07-18
**Type:** Architecture review and design exercise. **No implementation.** No production code, schema migration, API, or Trigger.dev changes in this PR.
**Depends on:** [`MARKETING_DIRECTOR_ARCHITECTURE.md`](./MARKETING_DIRECTOR_ARCHITECTURE.md) and [`MARKETING_DIRECTOR_FOUNDATION.md`](./MARKETING_DIRECTOR_FOUNDATION.md) — the composition layer this design will eventually feed. Field-level schema companion: [`MARKETING_MEMORY_DATA_MODEL.md`](./MARKETING_MEMORY_DATA_MODEL.md).

---

## 1. Executive Summary

AJN Marketing's decision pipeline is deterministic, explainable, and outcome-tracked — but it has no durable memory. `getHistoricalRecommendationSignalsForUser` (`lib/recommendation-learning/signals.ts`) already computes real, evidence-based patterns (which action types, channels, categories, seasons, and times of day historically performed well for a business) — but it **recomputes this from scratch on every call**, scans the business's entire recommendation history each time, and only ever looks at outcome events already tied to a recommendation. It has no concept of *why* those recommendations existed — the weather that day, a local festival, a holiday, a customer's explicit "don't do this" instruction. Nothing today persists a named, reusable, auditable "learning." Nothing today lets a customer tell the system a preference and have it remembered. Nothing today distinguishes a real, evidence-backed pattern from a one-time coincidence.

Marketing Memory is the missing durable layer between raw evidence and Marketing Director decisions. This document proposes five conceptually separate layers — **Observations**, **Learnings**, **Customer Preferences**, **Decisions**, **Outcomes** — that must never collapse into one ambiguous record, plus a normalized **Context** model (timing, weather, calendar, community, sports/entertainment, political/civic, market conditions) that memory reasons over.

The design deliberately **extends** the existing adaptive-scoring/outcome infrastructure rather than replacing it, and is scoped so the first implementation phase requires **zero schema changes today** — this PR is design and analysis only.

---

## 2. Product Philosophy

A trusted Head of Marketing remembers what worked, admits what they're still learning, never overclaims, and always defers to what the owner explicitly told them. Marketing Memory exists to let AJN Marketing behave the same way:

- **Honest about uncertainty.** "Early signal" is a real, sayable state — not something to hide behind a confident-sounding number.
- **Correlation-aware, not causation-claiming.** "Posts on Thursday mornings have historically performed better" — never "Thursday mornings *cause* better performance."
- **Preferences outrank inference.** If the customer said "don't post on Sundays," no amount of historical Sunday-performance data should override that.
- **Recency- and season-aware.** A pattern from last December is not equally relevant in July — until December returns, when it should reappear on its own.
- **Politically neutral by construction.** The system never infers, stores, or acts on a customer's political beliefs, and civic/political context can be switched off entirely.
- **Auditable, not surveillance.** Memory records business marketing evidence (what was published, what the weather was, what happened) — never a behavioral profile of the business owner as a person.

---

## 3. Current-State Inventory

Every system below was read directly (service code and, where persisted, the exact migration) before writing this document — not assumed from prior summaries.

### 3.1 Already computing evidence-like signals (recomputed, not persisted)

| System | File | What it does today | Persisted? |
|---|---|---|---|
| Adaptive Recommendation Intelligence | `lib/recommendation-learning/adaptiveScoring.ts` | Adjusts a recommendation's base (current-market) score/confidence using historical signals, with structured, per-contribution reasons (`RecommendationReason[]`) | No — recomputed every time a recommendation is scored or presented |
| Historical signal aggregation | `lib/recommendation-learning/signals.ts` | `getHistoricalRecommendationSignalsForUser` scans **all** of a business's recommendation outcome history and buckets success rates by channel, action type, category, season, and UTC time-of-day | No — full recompute on every call, no caching, no stored "learning" row |
| Business preference profile | `lib/recommendation-learning/preferences.ts` (`BusinessPreferenceProfile` type) | Derives preferred channels/days/times/types from historical behavior | Defined but **unwired** — zero callers outside its own file (confirmed in `ARCHITECTURE_REVIEW_2026.md` §3.8; still true) |
| Recommendation explainability | `lib/recommendation-presentation/service.ts` | Composes `whyNow`, `supportingReasons`, `confidenceLabel` for one recommendation, reusing the adaptive breakdown | No — recomputed per request |
| Market Context relevance scoring | `lib/market-context/contextScoringService.ts` | Scores raw provider signals (weather/holiday/local event/competitor/news/trend/school-calendar) for inclusion in the weekly brief via a fixed `CATEGORY_PRIORITY` table | Only the *selected* items are persisted (`market_context_items`); the scoring itself is not stored |

### 3.2 Already persisted (durable tables — candidates to reference, not duplicate)

| Table | Migration | Role |
|---|---|---|
| `marketing_opportunities` | `017_marketing_opportunities.sql` | One row per detected opportunity (category, severity, confidence, evidence jsonb, dedupe key, expiry) |
| `marketing_recommendations` | `018_marketing_recommendations.sql` | One row per prioritized recommendation, grouping one or more opportunities (`related_opportunity_ids`), with `priority_score`/`urgency`/`confidence`/`reasoning` |
| `recommendation_outcome_events` | `021_recommendation_outcome_events.sql` | **Append-only**, uniquely-keyed lifecycle event log (`draft_created` → `draft_edited`/`draft_approved`/`draft_rejected` → `publishing_queued` → `publishing_succeeded`/`publishing_failed` → `performance_measured`, plus `do_more_like_this`) |
| `market_context_items` | `012_market_context.sql` | One row per selected context signal (category, relevance/confidence scores, `context_date`, `expires_at`, provenance in `metadata`) |
| `market_context_briefs` | `012_market_context.sql` | One row per weekly brief, referencing selected item ids |
| `content_approvals` | `004_content_approval_workflow.sql` (+`019`/`021` extensions) | Draft lifecycle, `rejection_reason_code` (structured), `marketing_recommendation_id` link |
| `publishing_jobs` / `publishing_history` | `013_publishing_engine.sql` | Execution state + an append-only action/status trail per job |
| `analytics_snapshots` / `content_performance` | `014_analytics_feedback.sql` | Daily GBP snapshot + per-content performance metrics |
| `ai_recommendations` | `014_analytics_feedback.sql` | Analytics' own isolated recommendation list (already flagged in `ARCHITECTURE_REVIEW_2026.md` §5.2 as a disconnected fourth system — **not** a Marketing Memory input; see §12) |
| `business_profiles` | `001_business_profiles.sql` | Master customer record. `marketing_goals text[]`, `voice_notes text`, `brand_voice_tone`, `preferred_words`/`avoid_words` are the **only** existing preference-like fields — free text/array, no structured, queryable preference model |

### 3.3 Transient / recomputed-only, confirmed by direct read

- **Season and time-of-day** — `seasonFromDate`/`timeOfDayFromDate` in `signals.ts` are pure calendar math, computed fresh every call. No stored "season" concept.
- **Historical success-rate buckets** (channel/action-type/category/season/time-of-day) — computed fresh from `recommendation_outcome_events` every call via `gatherRecommendationOutcomeDetails`. Correct today because history is still small; will become an increasing scan cost as tenants accumulate years of history (§16).
- **Market Context relevance/confidence scores** — computed at generation time, not re-derivable later without re-running the scorer against the same (now possibly-changed) provider data.
- **Marketing Health state** — `resolveMarketingHealth` (`lib/head-of-marketing/marketingHealth.ts`) is a pure threshold classifier over live counts; nothing about "why health is what it is over time" is stored anywhere.

### 3.4 Providers (context signal sources today)

`lib/market-context/providers/`: `weatherGovClient.ts`/`weatherProvider.ts` (weather.gov, live), `nagerDateClient.ts`/`holidayProvider.ts` (nager.date, live), `localEventsProvider.ts`/`localEventsSources.ts`, `newsProvider.ts`/`rssFeedClient.ts` (RSS, live), `schoolCalendarProvider.ts`, `trendsProvider.ts`, `competitorProvider.ts`/`competitorProfile.ts` (profile-based — from `business_profiles.competitors`, not a live feed), `geocoding.ts`. Confirmed via `lib/market-context/signal-source.ts`: every item's provenance already resolves to one of `live | profile-based | fallback | unknown`.

**No sports/entertainment provider exists. No political/civic provider exists.** This is why §10 designs a *general* event-impact model rather than a sports- or politics-specific one — nothing here proposes building those providers now.

### 3.5 Customer preferences / settings surface

Direct check of `components/dashboard/settings-hub.tsx`: **zero** references to "preference" anywhere. The only customer-editable "preference-like" fields today are `business_profiles.marketing_goals` (a flat text array) and `voice_notes` (free text, currently parsed only for social-platform skip flags via `parseDeferredConnections`). There is no structured, queryable, per-factor preference or override model anywhere in the codebase today. This is the single largest genuine gap Marketing Memory must fill — not a duplication risk.

---

## 4. Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         CONTEXT PROVIDERS                            │
│  weather.gov · nager.date · RSS/news · school calendar · competitor  │
│  (profile-based) · [future: sports/entertainment, political/civic]   │
└───────────────────────────────┬──────────────────────────────────┘
                                 │  normalized via a common Context Signal
                                 │  boundary (§14) — never provider payloads
                                 ▼
                    ┌──────────────────────────┐
                    │   market_context_items /    │  EXISTING, referenced not duplicated
                    │   market_context_briefs      │
                    └─────────────┬────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                                                    ▼
┌───────────────────┐                          ┌───────────────────────────┐
│ marketing_opportunities│  EXISTING              │   MARKETING MEMORY (new)    │
│ marketing_recommendations│                        │                            │
│ (opportunity/decision   │                        │  Observations →  Learnings  │
│  engines, unchanged)     │                        │       ↑              ↓      │
└───────────┬────────────┘                        │  Evidence Links   Preferences│
            │                                       │       ↑              ↓      │
            ▼                                       │  Decision Links ← Overrides │
┌───────────────────────┐                          └──────────────┬─────────────┘
│ recommendation_outcome_  │  EXISTING, append-only                 │
│ events (draft/approve/    │◄─────────────────────────────────────┘
│ reject/publish/measure)   │   outcomes become new Observations
└───────────┬────────────┘
            │
            ▼
┌───────────────────────┐        ┌─────────────────────────────┐
│ recommendation-learning │──────▶│  Marketing Memory Evidence     │
│ (adaptive scoring,        │      │  Package (§13) — deterministic,│
│  existing, unchanged)      │      │  client-safe-after-mapping     │
└───────────────────────┘        └───────────────┬─────────────┘
                                                    ▼
                                    ┌─────────────────────────────┐
                                    │   lib/marketing-director/       │  EXISTING, unchanged
                                    │   (single decision composer)    │
                                    └───────────────┬─────────────┘
                                                    ▼
                                    ┌─────────────────────────────┐
                                    │  Weekly Briefing / Monthly Focus │  EXISTING, unchanged
                                    │  / Proactive presence            │
                                    └─────────────────────────────┘
```

---

## 5. Data Flow Diagram

```
1. Context providers produce raw signals
   → normalized into market_context_items (EXISTING table, unchanged)

2. Opportunity detection reads context + business signals
   → marketing_opportunities (EXISTING, unchanged)

3. Decision engine + adaptive scoring produce a ranked recommendation
   → marketing_recommendations (EXISTING, unchanged)

4. Customer acts (approve/reject/edit) and content publishes
   → recommendation_outcome_events (EXISTING, append-only, unchanged)

5. [NEW] An Observation is recorded referencing:
   - the recommendation/outcome event(s) that occurred
   - the market_context_items active at that time (by reference, not copy)
   - the analytics snapshot delta observed afterward (by reference)

6. [NEW] Periodically (not per-request), Observations sharing a pattern
   are summarized into a Learning, with evidence links back to every
   contributing Observation, a confidence level, and an explicit
   evidence-summary (never a full copy of the underlying data)

7. [NEW] When the customer states a preference or overrides a
   recommendation, it is recorded as a Customer Preference / Override —
   never silently merged into a Learning

8. [NEW] Marketing Director (unchanged composition logic) requests a
   Marketing Memory Evidence Package for one candidate decision;
   Marketing Memory returns applicable Learnings + Preferences +
   Overrides, ranked by the precedence in §11 — Marketing Director still
   makes the final call, memory only supplies evidence

9. The Decision the Marketing Director makes is recorded as a
   [NEW] Decision Link back to the Learnings/Preferences that informed it

10. What actually happens next (customer follows it, overrides it,
    performance changes) becomes a [NEW] Outcome — and a new Observation,
    closing the loop
```

---

## 6. Memory Hierarchy

The core principle, restated as a hard rule for every future implementation PR: **these five layers are never stored in the same table, and a record in one layer is never silently reclassified into another.**

### Observations — what happened

Factual, attributable, low-interpretation records. An observation is a fact plus its surrounding context, not a conclusion. "A GBP post was published Thursday at 9:00 AM; it rained that afternoon; impressions were 12% above the trailing-4-week baseline" is an observation. "Thursday mornings perform better" is not — that's a Learning derived from *many* observations.

### Learnings — derived patterns, with evidence

A Learning is a claim, always carrying: the observations that support it (§9), a confidence level (§10, customer-safe language only), a recency marker, and explicit limitations ("based on 6 posts over 3 months"). Learnings are the only layer allowed to say anything pattern-like — and even then, only in correlation-aware language (§9).

### Customer Preferences — explicit instructions

Never inferred. Only ever created because the customer said so — through an explicit UI action or a structured statement (e.g., a settings toggle, an override annotated "remember my preference"). Preferences default to outranking Learnings (§11).

### Decisions — what the Marketing Director chose, and why

Not a new decision engine — a **record** of what `lib/marketing-director/resolveDecision.ts` already decided, plus which Learnings/Preferences/context it consulted. This is the audit trail for "why did the system recommend this," distinct from the ephemeral `MarketingDirectorDecision` value itself (which is recomputed per-request and not currently persisted at all).

### Outcomes — what followed

What actually happened after a Decision or a customer override: followed, overrode, ignored, and the resulting performance signal (if any). Outcomes are themselves a source of new Observations, closing the loop deterministically — never speculatively.

---

## 7. Proposed Entities (summary — see `MARKETING_MEMORY_DATA_MODEL.md` for field-level detail)

| Entity | Layer | First release? |
|---|---|---|
| `marketing_memory_observations` | Observations | **Yes** |
| `marketing_memory_context_snapshots` | Observations (context capture at decision time) | **Yes** |
| `marketing_memory_learnings` | Learnings | Phase 2 |
| `marketing_memory_evidence_links` | Evidence attribution (Observations → Learnings) | Phase 2 |
| `marketing_memory_preferences` | Customer Preferences | Phase 3 |
| `marketing_memory_overrides` | Customer Overrides (a specific, append-only Preference sub-type) | Phase 3 |
| `marketing_memory_decision_links` | Decisions (audit trail only) | Phase 4 |

No entity in this list duplicates `marketing_opportunities`, `marketing_recommendations`, `recommendation_outcome_events`, `market_context_items`, `analytics_snapshots`, or `content_performance` — every proposed table stores only what those tables do not, and references the rest by id (§9).

---

## 8. Naming and vocabulary decision

`marketing_memory_*` was chosen over alternatives (`memory_*`, `hom_memory_*`) to match this repository's established convention of prefixing tables by domain (`marketing_opportunities`, `marketing_recommendations`, `marketing_plans`) rather than by owning feature/team. "Memory" (not "learning system" or "AI memory") matches the product-philosophy framing in `MARKETING_DIRECTOR_ARCHITECTURE.md` and avoids implying a machine-learning system that doesn't exist (§10 is explicit that no ML model is proposed).

---

## 9. Evidence and Attribution

Every Learning must answer two questions on demand: **"What evidence supports this?"** and **"What evidence would weaken or overturn it?"**

Design principle: **reference, never copy.** A Learning never stores a duplicate of an analytics snapshot, a full recommendation row, or a market context item — it stores an id and a short, human-readable evidence summary (e.g., "6 of 7 Thursday-morning posts in the last 90 days outperformed the trailing baseline"). The full underlying data remains queryable from its authoritative table by following the reference.

`marketing_memory_evidence_links` is the join table making this explicit: `learning_id`, a polymorphic `source_type` (`observation | recommendation | outcome_event | analytics_snapshot | context_item | override`), `source_id`, and a `contribution` field (`supporting | contradicting | neutral`) — so a Learning can honestly carry evidence that *weakens* it, not just evidence that supports it. This is the concrete mechanism behind "what would change the recommendation" in the explainability experience (§15).

Every Learning also carries: `sample_size`, `date_range_start`/`date_range_end`, `business_profile_id` (tenant ownership, never cross-tenant), and a `comparison_baseline` description (what "better than normal" is being compared against — e.g., the same business's trailing 8-week average, never a cross-tenant benchmark in the first release, to avoid the appearance of comparing one customer's private performance data against another's).

---

## 10. Confidence Model

**No opaque ML score.** Every confidence level is a named, documented rule over countable inputs — consistent with the existing `recommendation-learning` module's own "deterministic, non-ML" convention (`adaptiveScoring.ts`'s own doc comment), which this design extends rather than replaces.

### Customer-safe levels (exactly four, matching the task's proposal)

| Level | Shown as |
|---|---|
| `early_signal` | "Early signal" |
| `developing_pattern` | "Developing pattern" |
| `strong_pattern` | "Strong historical pattern" |
| `confirmed_preference` | "Confirmed preference" (reserved for explicit Customer Preferences, never for an inferred Learning, no matter how strong) |

### Proposed rule set (documented, not implemented)

```
inputs:
  sample_size            -- count of supporting observations
  consistency             -- fraction of supporting observations that agree
                             (e.g. 6 of 7 Thursday posts outperformed baseline = 0.86)
  recency_days            -- age of the most recent supporting observation
  effect_size             -- magnitude of the difference from baseline (normalized)
  contradiction_count      -- count of contradicting evidence_links
  seasonal_recurrence_count -- number of distinct seasonal cycles this pattern has
                                reappeared in (0 for a first-season pattern)

level =
  if sample_size < 3:                         early_signal
  elif consistency < 0.6 or contradiction_count > supporting_count * 0.3:
                                                early_signal
  elif sample_size < 8 or recency_days > 120 (and no seasonal recurrence):
                                                developing_pattern
  elif sample_size >= 8 and consistency >= 0.7
       and (recency_days <= 120 or seasonal_recurrence_count >= 1):
                                                strong_pattern
  # confirmed_preference is never derived here -- it is set only when the
  # Learning is itself a restatement of an explicit Customer Preference,
  # which by definition has no sample-size requirement.
```

Thresholds (3, 8, 0.6, 0.7, 120 days) are illustrative starting points mirroring the existing `MIN_BUCKET_SAMPLE_SIZE_FOR_REASON = 3` and `COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE = 20` constants already in `lib/recommendation-learning/weights.ts` — the real values should be tuned during Phase 2 implementation against real tenant data, not fixed here. What matters architecturally is that the rule is a named, auditable function, not a trained model.

### Minimum evidence thresholds

A Learning below `early_signal`'s minimum (`sample_size < 2`, or fewer than 2 distinct dates) is **not created** — it remains an Observation only. This is the primary safeguard against low-sample "truth."

---

## 11. Correlation and Causation Safeguards

Every Learning's customer-facing text is generated from a small set of sentence templates keyed to its confidence level and evidence, never free-form generation claiming causation:

| Confidence | Template pattern |
|---|---|
| `early_signal` | "I'm noticing an early signal that {X} — I'll keep watching." |
| `developing_pattern` | "There's a developing pattern: {X} for your business." |
| `strong_pattern` | "{X} has historically performed better for this business." / "{X} may have contributed to {Y}, though the evidence is still limited." (for weaker-effect-size cases even at higher sample sizes) |
| `confirmed_preference` | "You've told me {X}." |

**Never**: "{X} caused {Y}." Causal language is disallowed at the template layer — there is no code path that can produce it, not just a style guideline. `MARKETING_DIRECTOR_FOUNDATION.md`'s existing `MARKETING_DIRECTOR_FOUNDATION_TERMS`-style forbidden-word test pattern (already used for `PROACTIVE_FORBIDDEN_TERMS`, `JOURNAL_FORBIDDEN_TERMS`) should be extended with a `MARKETING_MEMORY_FORBIDDEN_TERMS` list (`caused`, `guarantees`, `will definitely`, `proven to`) when this is implemented, tested the same way the existing forbidden-term suites already are.

---

## 12. Memory Decay and Expiration

Four distinct states, never conflated:

| State | Meaning | Example |
|---|---|---|
| **Active influence** | Currently eligible to inform a Marketing Director decision | A strong pattern observed in the last 120 days |
| **Historical record** | No longer actively weighted, but fully queryable and auditable | A pattern that hasn't recurred this season yet |
| **Expired context** | A one-time disruption that should never become a standing rule | "Road closure last April" |
| **Superseded learning** | Replaced by a newer, contradicting, or refined Learning — the old row is never deleted, only marked `superseded_by` | "Thursday mornings" refined to "Thursday mornings, excluding rainy days" |

Rules:

- **No row is ever deleted for decay.** `active_until` (nullable) and `status` (`active | historical | expired | superseded`) columns model decay without destroying audit history — mirroring `marketing_opportunities.status`'s existing `expired` state, which is the established precedent in this codebase for "no longer relevant but not deleted."
- **Explicit Customer Preferences never silently expire.** A preference's `active_until` is only ever set by an explicit customer action (§13), never a background decay job.
- **Seasonal Learnings** carry a `season` or `recurrence_pattern` field (§13) so a December pattern automatically becomes inactive in July and automatically reactivates the following November/December — without needing to be recomputed from scratch, and without a one-time April disruption masquerading as a seasonal pattern (distinguished by `recurrence_pattern: none` vs. a real named season/month).
- **Competitor observations decay fastest** — `context_snapshots` sourced from `category: competitor` should default to a short `active_until` (weeks, not months) given how quickly competitive activity data goes stale, consistent with the existing Market Context system's own weekly-brief cadence.

---

## 13. Seasonal Memory

A Learning's `recurrence_pattern` field distinguishes:

- **`none`** — one-time event evidence (a single road closure, a one-off supply issue). Never influences a future decision once its `active_until` passes.
- **`annual_month`** (e.g. `"december"`) or **`annual_range`** (e.g. `"nov_15..jan_05"`) — recurring seasonal evidence. Reactivates automatically when the calendar re-enters that window, using the same evidence (unless superseded by fresher same-season evidence).
- **`recurring_weekly`** (e.g. `"thursday"`) — non-seasonal but recurring (day-of-week patterns). Always active, decays only by staleness/contradiction, not by calendar season.

This directly satisfies "do not treat a pattern from last December as equally relevant in July": a `recurrence_pattern: annual_month` Learning's *active weight* is computed as a function of `(current_month, learning.recurrence_pattern)` at read time, not a static boolean — cheap, deterministic, no stored "is it currently active" flag to keep in sync.

---

## 14. Context Factors — Normalization Boundary

Marketing Memory (and future providers) never depend on provider-specific payload shapes. `market_context_items` already models most of this (`category`, `relevance_score`, `confidence_score`, `context_date`, `expires_at`, provenance in `metadata`) — the proposal extends, not replaces, that shape for the additional context types the task lists:

```
ContextSignal (normalized concept — not a new table; a shared interface every
provider-facing adapter must produce, matching market_context_items' existing
columns plus the fields below):
  contextType        -- "weather" | "holiday" | "local_event" | "school_calendar"
                       | "competitor" | "news" | "trend"
                       | "sports_entertainment" (future) | "political_civic" (future)
  source              -- provider identity, reusing signal-source.ts's existing
                          live | profile-based | fallback | unknown vocabulary
  locationScope        -- city/region the signal applies to (already implicit via
                          business_profiles.city/state; made explicit for a future
                          multi-location business)
  startTime / endTime   -- the signal's real-world window (a game, a holiday, a
                          weather event) -- distinct from context_date's "as of"
                          semantics
  relevance / confidence -- already existing market_context_items columns
  impactDirection       -- "positive" | "negative" | "neutral" | "unknown" --
                          NEW: does this context typically help or hurt attention/
                          engagement for a local service business (e.g. "major
                          televised sporting event" -> negative impact on same-day
                          promotional reach)
  observedVsForecast     -- "observed" | "forecast" -- weather and sports/civic
                          signals are often forecast at decision time and only
                          observed after the fact; Learnings must know which
  attributionUrl         -- already existing source_url
  expiresAt              -- already existing
```

**General event-impact model, not a Super Bowl rule.** The task's example ("don't compete with a major televised sporting event") is implemented as: any `sports_entertainment`-typed context signal with `impactDirection: negative` and sufficiently high `relevance_score` for the business's audience becomes ordinary Marketing Memory evidence, weighed by the same confidence/precedence rules as every other context type — there is no `if (event === "Super Bowl")` anywhere in this design. A future `sports_entertainment` provider (not built in this PR) would need to supply exactly this shape; the memory layer doesn't care which specific event it is.

**Political/civic is a first-class, cautious `contextType`**, not disabled by default but individually **switchable off per business** via a Customer Preference (§13, `marketing_memory_preferences` with `factor_type: "context_category"`, `factor_value: "political_civic"`, `action: "disable"`). No code path infers a customer's political beliefs from this data — political/civic signals, if ever surfaced, describe *disruption to normal marketing timing* (e.g. "local election day — expect lower attention to non-civic content"), never persuasive or partisan framing, and are always presented neutrally with the same forbidden-language safeguards as §11.

---

## 15. Explainability Experience

Progressive disclosure, matching the existing `HeadOfMarketingPage`/proactive-presence pattern — no data-science dashboard.

**Top layer (always visible when a decision has memory-backed evidence):**

> Why I'm recommending this
> "Your Tuesday morning posts have performed better than your recent average. Rain is expected this weekend, and outdoor-service promotions have historically underperformed during wet weather. I recommend publishing Tuesday instead."

**One tap deeper ("Tell me more"):**

- What evidence was used (plain-language Learning summaries, not raw numbers)
- Confidence label (one of the four levels in §10 — never a percentage)
- Relevant context (the specific weather/calendar/event signal, with its source)
- What alternatives were considered (the Marketing Director's existing `deferred[]` — already designed in `MARKETING_DIRECTOR_FOUNDATION.md`, now populated with memory-informed reasons)
- What would change the recommendation (contradicting evidence links from §9, phrased as "if X were different, I'd suggest Y instead")

**Controls (client actions, not raw data mutation):**

- Follow recommendation (existing flow, unchanged)
- Choose a different time (existing flow, unchanged)
- "Tell me more" (expands the above)
- "Don't use this factor" → creates a `marketing_memory_preferences` disable row scoped to that context type
- "Remember my preference" → promotes an override into a durable Customer Preference (§16)

---

## 16. Customer Overrides

Overrides are **evidence about how this customer wants to be managed**, never logged as errors. Every override is recorded once (append-only) in `marketing_memory_overrides`, referencing the Decision it responded to, with an `is_permanent` flag distinguishing a one-time "not today" from a standing preference. A permanent override is the mechanism by which an override *becomes* a Customer Preference — not a separate manual step.

### Precedence (highest to lowest)

1. **Legal or compliance constraints** — not modeled by Marketing Memory at all; these live in the existing publishing/content-approval safety rails and always win regardless of memory.
2. **Explicit customer preferences** (`marketing_memory_preferences`, active, not disabled)
3. **Current business goals** (`business_profiles.marketing_goals`, Monthly Focus priorities — existing systems, referenced not duplicated)
4. **Strong historical learnings** (`confidence_level: strong_pattern`)
5. **Developing patterns** (`confidence_level: developing_pattern` / `early_signal`)
6. **Generic best practices** (today's existing deterministic defaults in `marketing-decisions`/`recommendation-learning` — the fallback when no memory evidence exists at all; this is the cold-start path, §18)

This precedence is a **read-time ranking rule** the Marketing Director's evidence-consumption logic applies (§17) — it is not itself a new scoring formula; it's an ordinal sort over already-typed evidence categories.

---

## 17. Marketing Director Integration

Marketing Memory **provides evidence; it does not decide.** `lib/marketing-director/resolveDecision.ts` remains the single decision composer (per `MARKETING_DIRECTOR_FOUNDATION.md`'s already-shipped consolidation) — Marketing Memory must never become a second `resolveMarketingDirectorDecision`-equivalent, never independently pick a primary action, and never duplicate the precedence waterfall that already exists there.

### Proposed future interface (design only — not implemented)

```ts
// lib/marketing-memory/types.ts (future)
export type MarketingMemoryEvidencePackage = {
  businessProfileId: string;
  /** Applicable, currently-active Learnings for the candidate action being evaluated,
   * already filtered by recurrence/decay (§12-13) -- never raw rows. */
  learnings: MarketingMemoryLearningSummary[];
  /** Explicit preferences relevant to this candidate, already precedence-sorted. */
  preferences: MarketingMemoryPreferenceSummary[];
  /** Whether the customer has disabled the context category this candidate depends on. */
  disabledContextTypes: string[];
  /** True when there is not yet enough evidence to say anything beyond "still learning". */
  isColdStart: boolean;
  evaluatedAt: string;
};
```

This mirrors `MarketingDirectorTopRecommendationDetail`'s existing shape convention exactly (`lib/marketing-director/types.ts`) — a narrow, pre-computed, already-safe-to-reason-over package, not a raw data dump. `resolveMarketingDirectorDecision`'s existing precedence waterfall (connection gap → pending approvals → open recommendation → unanswered reviews → nothing-urgent branches) would, in a future phase, additionally consult `MarketingMemoryEvidencePackage.preferences` to check for a disabling override *before* selecting a candidate as primary, and would fold `learnings` into the `rationale`/`summary` text it already generates — extending the existing `topRecommendationDetail` optional-input pattern the Marketing Director foundation already established, not introducing a new parameter shape.

**Required properties**, matching the task's explicit list:

- **Deterministic** — same evidence in, same package out; no LLM call inside this interface.
- **Explainable** — every `learnings[]`/`preferences[]` entry carries its own evidence summary and confidence label, ready for §15's presentation.
- **Tenant-scoped** — `businessProfileId` required, every underlying query filtered by it (same RLS/defense-in-depth convention as every other `*ForUser` function in this codebase).
- **Client-safe only after presentation mapping** — mirrors `MarketingDirectorClientView`'s already-established pattern (`lib/marketing-director/types.ts`'s `toMarketingDirectorClientView`): the full internal package (with raw evidence-link ids, sample sizes, contradiction counts) stays server-side; only a presentation-mapped subset would ever be considered for a client boundary, and — as with the Marketing Director foundation — no such boundary exists yet, since `HeadOfMarketingPage` remains a Server Component.
- **Resilient when little or no memory exists** — see §18.

---

## 18. Cold-Start Behavior

When `isColdStart: true` (no Learnings meet even `early_signal`'s minimum evidence threshold, and no relevant Customer Preference exists):

- Marketing Director falls back entirely to today's existing behavior — current-market opportunity scoring (`marketing-decisions/scoring.ts`) and the existing deterministic defaults, completely unaffected by Marketing Memory's absence.
- The customer-facing copy explicitly says so, in the same calm voice already established: "I'm still learning your business's patterns — this recommendation is based on current signals and general best practices." Never a blank or a fabricated pattern.
- This is not a new fallback mechanism — it is memory being an **optional, additive input** the Marketing Director already tolerates being absent, exactly as `topRecommendationDetail: MarketingDirectorTopRecommendationDetail | null` already works today when no recommendation explainability is available (`MARKETING_DIRECTOR_FOUNDATION.md` §"Known limitations").

---

## 19. Failure and Missing-Data Behavior

| Condition | Behavior |
|---|---|
| Weather/local-event/any provider data unavailable | The `ContextSignal` for that window is simply absent — no fabricated "clear weather" default. Existing `market_context` fallback provenance (`isFallback: true`) already models "we used a fallback, say so" — Marketing Memory inherits this, never silently upgrading a fallback to `live` confidence. |
| Analytics incomplete for a period | That period contributes zero Observations for the missing metric — never interpolated or estimated. |
| Attribution ambiguous (multiple context signals active at once) | The Observation records all of them; the Learning-derivation step (Phase 2) is responsible for not overclaiming a single cause — evidence links can mark multiple `contributing` sources on one Learning. |
| Event impact unknown (no `impactDirection` yet classified) | Treated as `impactDirection: unknown` — contributes to Observations, never auto-promoted into a Learning until enough repeated instances establish a direction. |
| New business, no history | `isColdStart: true` — see §18. |
| Sample size too low | The Learning is never created (§10's minimum threshold) — remains Observations only, visible in audit history but not in `learnings[]`. |
| Customer disabled a factor | That context type is filtered out of the evidence package entirely before it ever reaches ranking — not merely down-weighted. |
| Evidence conflicts (a Learning has both supporting and contradicting links) | Confidence downgrades per §10's `contradiction_count` rule; the conflict itself becomes visible in "what would change the recommendation" (§15), not hidden. |
| A provider becomes unavailable after a Learning was built from it | The Learning remains valid (it's a summary of past evidence, not a live query) — but the `source` provenance stays visible on the underlying `context_snapshots` row so a future audit can see the data source that no longer exists. |

**In every case: absence of context never blocks a recommendation.** The recommendation pipeline's existing behavior (opportunity → decision → adaptive score) is completely independent of Marketing Memory's presence — this is enforced structurally by Marketing Memory being a strictly additive, optional evidence layer feeding the Marketing Director's already-existing optional-input pattern, not a new required dependency.

---

## 20. Phased Implementation Plan

Each phase is independently releasable, backward-compatible, and requires no change to any existing engine's behavior.

**Phase 1 — Observation and evidence foundation.** Create `marketing_memory_observations` and `marketing_memory_context_snapshots` only. Start recording observations from existing `recommendation_outcome_events` and `market_context_items` (a background job reading, not rewriting, existing tables). No Learnings, no customer-visible change. Purely additive audit data. **Exit criterion (added by the self-review in §24):** a retention/compaction policy for these two append-only tables must be designed and implemented before Phase 1 is considered complete — unbounded growth must not ship silently.

**Phase 2 — Learnings and confidence.** Add `marketing_memory_learnings` and `marketing_memory_evidence_links`. Implement the confidence rule set (§10) as a pure, tested function (mirroring `adaptiveScoring.ts`'s existing pure-function convention). Learnings are computed periodically (not per-request), from Phase 1's observations. Still no customer-visible change — Learnings exist but nothing consumes them yet.

**Phase 3 — Customer preferences and overrides.** Add `marketing_memory_preferences` and `marketing_memory_overrides`. Ship the minimal settings UI for explicit preferences and the override-capture flow (§16). This phase is the first with any new customer-facing surface, and it's additive-only (a new settings section, no change to existing pages).

**Phase 4 — Marketing Director consumption.** Implement `MarketingMemoryEvidencePackage` (§17) and wire it as a new optional input to `resolveMarketingDirectorDecision`, following the exact pattern `topRecommendationDetail` already established in the Marketing Director foundation. Full regression testing against the existing Marketing Director test suite required, exactly as PR #50 did for its own consolidation — cold-start (§18) must be verified to produce byte-identical output to today's behavior.

**Phase 5 — Customer-facing explainability.** Ship the progressive-disclosure UI (§15) inside the existing Weekly Briefing / recommendation surfaces — no new top-level nav destination, matching every prior Project Magic phase's navigation discipline.

**Phase 6 — Seasonal and community intelligence expansion.** Add `recurrence_pattern`-aware seasonal reactivation (§13) at scale, and evaluate whether a `sports_entertainment` or `political_civic` provider is warranted — a separate, future decision, not committed to by this document.

---

## 21. Privacy, Safety, and Retention

See `MARKETING_MEMORY_DATA_MODEL.md` for column-level detail. Principles:

- **Tenant isolation**: every proposed table carries `user_id` + `business_profile_id`, RLS-enabled with the same `auth.uid() = user_id` policy pattern used by every existing table in this schema (§3.2's migrations are the precedent) — no exceptions.
- **Data minimization**: Observations and Context Snapshots store business marketing facts (what was published, what the weather was, what a customer said) — never personal attributes of the business owner beyond what `business_profiles` already legitimately holds (name, contact info already collected for the product to function). No new PII fields are proposed anywhere in this design.
- **No behavioral surveillance framing.** Marketing Memory is scoped to *marketing evidence about the business*, not a profile of the owner's habits, mood, or personal life. A Learning like "Tuesday mornings perform better" is about the business's audience response, not the owner.
- **Retention**: nothing is force-deleted by decay (§12) — decay only changes *active weight*, never destroys the row, preserving full audit history. Actual deletion only ever follows the same account-deletion path every other tenant table already follows (cascade via `user_id`/`business_profile_id` foreign keys, already `on delete cascade` in every existing migration).
- **Exportability**: since every proposed table is a normal, tenant-scoped Postgres table with standard RLS, it is exportable via the same mechanism (if any exists) as every other tenant table — no new export mechanism is proposed or required.
- **Safe logging**: any diagnostic logging added in future phases must follow the existing `console.info("[ScopeName]", {...})` structured-log convention already used across `lib/marketing-decisions/service.ts`, `lib/recommendation-presentation/service.ts`, and `lib/head-of-marketing/service.ts` — ids and counts only, never full observation/learning text, never secrets.
- **Political-context safeguards**: restated from §14 — no belief inference, no persuasive framing, per-business opt-out, neutral disruption-only language.

---

## 22. Known Risks

- **Scan-cost growth.** `getHistoricalRecommendationSignalsForUser`'s existing full-history recompute-on-every-call pattern will only get more expensive as Marketing Memory adds more observation volume. Phase 2's periodic (not per-request) Learning computation is the mitigation — but the existing adaptive-scoring recompute pattern itself is *not* addressed by this design and should be revisited before Phase 2 ships at scale.
- **Confidence rule tuning risk.** §10's thresholds are illustrative; shipping them un-tuned against real tenant data could produce Learnings that feel either overconfident or under-eager. Recommend a dry-run/shadow-mode Phase 2 (compute Learnings, never surface them) before Phase 4 wires them into real decisions.
- **Cold-start plateau.** Many small-business tenants may never accumulate enough sample size for `strong_pattern` — the design must keep "still learning" a permanently acceptable, non-broken state, not a temporary embarrassment to engineer around.
- **Preference-UI scope creep.** Phase 3's settings surface is easy to over-build into a "data science dashboard" the task explicitly warns against — the explainability experience (§15) must stay progressive-disclosure by discipline, not by accident.
- **Political/civic sensitivity.** Even with the safeguards in §14, this is the single highest-scrutiny surface in the whole design — recommend a dedicated review (product + legal, not just engineering) before any Phase 6 political/civic provider work begins.

## 23. Open Questions

- Should `marketing_memory_learnings` support cross-business (agency/multi-location) pattern sharing in the future, or should every Learning remain strictly single-tenant forever? This design assumes strictly single-tenant for the foreseeable future (§9's "never a cross-tenant benchmark") but the question is worth revisiting once a multi-location agency console (already flagged as future scope in `ARCHITECTURE_REVIEW_2026.md`) exists.
- Should Phase 2's Learning computation run as a new Trigger.dev task, or piggyback on an existing scheduled job? No Trigger.dev changes are proposed in this PR; this is a Phase 2 implementation decision, not an architecture decision.
- What is the right default `active_until` window for non-seasonal Learnings (§12)? Illustrative only in this document (120 days) — should be validated against real outcome-event volume once Phase 1 data exists.
- Should customers be able to see *other* customers' anonymized aggregate patterns ("businesses like yours...") in a future phase? Explicitly out of scope for this design (§9, §22) — flagged here only so it isn't silently designed-in later without a deliberate decision.

---

## 24. Architecture Self-Review

Performed against the full checklist before this design was finalized. Each item's finding — and, where the first draft had a gap, the resulting revision — is recorded here rather than silently fixed, so the review is itself auditable.

| Check | Finding |
|---|---|
| Duplicate analytics storage | Not present. §9 makes "reference, never copy" a hard rule; `marketing_memory_observations.metric_summary` is a small derived delta (e.g. `impressions_delta_pct`), never a copy of an `analytics_snapshots` row. |
| Duplicate recommendation logic | Not present. No proposed entity or function scores, ranks, or selects a primary action. `marketing_memory_learnings` only ever *describes* a pattern; it has no `priority_score`-equivalent column. |
| Another hidden prioritization system | Not present. §17 states the precedence ranking in §16 is an ordinal sort over evidence *categories* the Marketing Director already receives — not a second numeric scorer running in parallel to `marketing-decisions`/`recommendation-learning`. |
| Provider-specific coupling | Not present. §14's `ContextSignal` normalization boundary is provider-agnostic; no proposed table or type references `weather.gov`, `nager.date`, or any specific provider by name in a column type or constraint. |
| Weak evidence attribution | Mitigated. `marketing_memory_evidence_links` (data model §4) requires every Learning to carry at least one linked source with an explicit `contribution` (`supporting/contradicting/neutral`); §10 refuses to create a Learning below `sample_size < 2`. |
| Correlation presented as causation | Mitigated structurally, not just stylistically. §11 restricts all Learning text to a fixed template set with no causal-language code path, extending the existing `*_FORBIDDEN_TERMS` test pattern already enforced for Marketing Director/Proactive/Journal copy. |
| Unjustified confidence | Mitigated. §10's four-level vocabulary is rule-based over countable inputs (sample size, consistency, recency, contradiction count) — the same "documented, non-ML" convention `recommendation-learning/weights.ts` already established — not a trained score. |
| Customer overrides being ignored | Not present. §16 places explicit preferences above all inferred Learnings in precedence; §6 of the data model makes every override append-only evidence, with `is_permanent` as the explicit path to promotion into a durable preference — never silently dropped. |
| Stale memories retaining too much weight | Mitigated. §12/§13 define `active_until` and `recurrence_pattern` as read-time weight modifiers; a non-recurring Learning past its window contributes zero active weight without being deleted. |
| Political-context misuse | Mitigated. §14 restricts political/civic signals to neutral "disruption to normal timing" framing only, with a mandatory per-business disable switch (`marketing_memory_preferences`, `factor_type: "political_civic"`) and no code path that reads or infers belief. Flagged in §22 as still warranting a dedicated product/legal review before Phase 6, not just an engineering sign-off. |
| Excessive personal data collection | Not present. §21 confirms no new PII columns are proposed anywhere in the data model; every column is either a reference id, a small structured metric, or plain-language pattern text about business marketing performance. |
| **Unbounded storage growth** | **Gap found and addressed.** The first draft of §1/§2 (Observations, Context Snapshots) proposed pure append-only tables with no retention bound, growing indefinitely with every outcome event and context snapshot — unlike `recommendation_outcome_events`, which stays small in practice because it fires only on discrete lifecycle transitions. Revision: Phase 1 implementation must include a retention/compaction policy (e.g. roll up Observations older than N months into their already-derived Learnings' evidence summaries and drop the raw row, or partition by `business_profile_id`/`occurred_at`) before Phase 1 ships — this is now a required Phase 1 exit criterion (§20), not deferred indefinitely. No compaction mechanism is designed in this document; it is scoped as required future work, not solved here. |
| Missing tenant isolation | Not present. Every proposed table in the data model carries both `user_id` and `business_profile_id` with the same RLS policy shape as every existing table (§0 of the data model doc). |
| Premature complexity | Mitigated by phasing. Only 2 of 7 proposed tables (`observations`, `context_snapshots`) are in scope for Phase 1; `learnings`/`evidence_links` wait for Phase 2; `preferences`/`overrides` for Phase 3; `decision_links` for Phase 4 — each independently releasable per §20. |
| Tables not required for first release | Explicitly labeled. Data model §9's summary table marks phase for every entity; nothing outside Phase 1 is proposed for immediate implementation. |

**Net effect of this pass:** one genuine gap (unbounded append-only growth) was found and is now recorded as a required Phase 1 exit criterion rather than left implicit; every other checklist item was already addressed by the initial design and is cross-referenced above for auditability. No entity, column, or interface was removed as a result of this review — the design was already scoped to first-release-minimal (2 tables) before this pass, and the pass did not surface unnecessary complexity to cut.
