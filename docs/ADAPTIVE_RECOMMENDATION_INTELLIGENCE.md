# Adaptive Recommendation Intelligence

- **Status:** Implemented
- **Date:** 2026-07-14
- **Scope:** Historical recommendation outcomes (PR #27) now influence future
  recommendation scoring for the same tenant/business, deterministically and
  explainably. No machine learning, no OpenAI prompt changes, no autonomous publishing,
  no auto-approval. No production schedules were activated by this work.

---

## 1. Investigation: where scoring/ranking/weighting already live

Before writing any code, the following were read in full: `lib/marketing-decisions/
scoring.ts`, `decisionEngine.ts`, `service.ts`, `types.ts`, `actionTypeMapping.ts`,
`actionTypeContentMapping.ts`; `lib/recommendation-outcomes/{types,persistence,service}.ts`
(PR #27); `lib/market-context/contextScoringService.ts`; `lib/publishing-queue/
persistence.ts`'s `inferPlatformFromContentType`.

**Every current score input**, precisely:

| Field | Computed by | Inputs |
|---|---|---|
| Opportunity score (0-100) | `scoreOpportunity` | 50% severity, 30% confidence, 20% time-to-expiry urgency |
| Recommendation `priority_score` | `aggregatePriorityScore` | max(opportunity scores in the merged group) + a capped (+15) group-size bonus |
| Recommendation `confidence` | `aggregateConfidence` | plain average of the group's opportunity confidences |
| Recommendation `urgency` | `urgencyFromPriorityScore` | fixed thresholds on `priority_score` (85/65/40) |
| `business_impact` / `estimated_effort` | `ACTION_TYPE_IMPACT` / `ACTION_TYPE_EFFORT` (`actionTypeMapping.ts`) | static, hand-authored per action type — not computed from evidence at all |
| Ranking order | `buildMarketingRecommendationDrafts`'s own sort | `priority_score` desc, tie-broken by action type then dedupe key |
| Recommendation filtering | `isContentSupportedActionType` | 4 of 8 action types support content drafting (unrelated to priority) |

**Existing deterministic scoring utilities** (must not be duplicated): `scoreOpportunity`,
`aggregatePriorityScore`, `aggregateConfidence`, `urgencyFromPriorityScore`
(`lib/marketing-decisions/scoring.ts`) and `rankOpportunities` /
`buildMarketingRecommendationDrafts` (`decisionEngine.ts`) are **pure, I/O-free
functions**. There is no existing configurable-weights system anywhere in `lib/` — the
closest precedent is static, exported constant lookup tables (`ACTION_TYPE_IMPACT`,
`CATEGORY_PRIORITY` in `contextScoringService.ts`), which this feature's own
`lib/recommendation-learning/weights.ts` follows.

**Insertion point, chosen for minimal architectural disruption:** `scoring.ts` and
`decisionEngine.ts` are completely unchanged. Historical signals require a database
read, which the pure decision engine deliberately never does — so the adjustment is
applied one layer up, in `lib/marketing-decisions/service.ts::runMarketingDecisionEngineForUser`,
between `buildMarketingRecommendationDrafts(...)` (produces the base, current-market-only
drafts) and the existing upsert loop. This is the only touch point in the pre-existing
decision-engine code path.

## 2. Architecture

```
buildMarketingRecommendationDrafts(opportunities)   <- UNCHANGED, pure, current-market only
        |
        v  base drafts (priorityScore, confidence, urgency)
getHistoricalRecommendationSignalsForUser(userId, businessProfileId)   <- ONE fetch per run
        |
        v
applyAdaptiveScoringToDrafts(baseDrafts, categoriesByDedupeKey, signals, now)
        |  computeAdaptiveRecommendationScore() per draft -- pure, deterministic
        v  adjusted drafts (priorityScore/confidence/urgency overwritten, reasons available)
upsertMarketingRecommendation(...)   <- UNCHANGED persistence, now receives adjusted values
```

`lib/recommendation-learning/`:

| File | Responsibility |
|---|---|
| `types.ts` | `HistoricalRecommendationSignals`, `BusinessPreferenceProfile`, `RecommendationReason`, `AdaptiveScoreBreakdown` |
| `weights.ts` | Named, exported weighting constants (see §3) |
| `signals.ts` | `getHistoricalRecommendationSignalsForUser` — the historical aggregation service (Phase 2) |
| `preferences.ts` | `getBusinessPreferenceProfileForUser` — the business preference model (Phase 3) |
| `adaptiveScoring.ts` | `computeAdaptiveRecommendationScore` (pure) + `applyAdaptiveScoringToDrafts` (batch orchestration helper) |
| `debug.ts` | `getRecommendationLearningDebugForUser` — recomputes the full breakdown for every active recommendation, for the admin debug route |

Every historical/preference function reuses PR #27's `summarizeRecommendationOutcomeForUser`
per recommendation — none of them re-derive lifecycle status or usefulness-signal logic.
`gatherRecommendationOutcomeDetails` (in `signals.ts`) gathers the shared
per-recommendation detail set once; both the signals aggregation and the preference
profile build on top of it without a second round of duplicate queries.

## 3. Weighting strategy

No configurable-weights system existed to extend, so `lib/recommendation-learning/
weights.ts` introduces named, exported constants (matching the existing
`ACTION_TYPE_IMPACT`-style convention) rather than inline magic numbers:

```ts
CURRENT_MARKET_WEIGHT = 0.7          // confidence blend only (see below)
HISTORICAL_WEIGHT = 0.3              // confidence blend only
MAX_HISTORICAL_ADJUSTMENT_POINTS = 30 // 100 * HISTORICAL_WEIGHT -- score adjustment cap
COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE = 20
HEAVY_EDIT_RATE_THRESHOLD = 0.5
MIN_BUCKET_SAMPLE_SIZE_FOR_REASON = 3
```

**Score**: additive, bounded adjustment, not a blend. Each available historical
dimension (action type, channel, category, season) contributes a signed points value;
the sum is clamped to `±MAX_HISTORICAL_ADJUSTMENT_POINTS` (30 points out of 100) — the
70/30 language becomes "history can move the score by at most 30 of its 100 points,"
scaled down further by `confidenceInHistory` (cold start, §7). `finalScore = clamp(baseScore
+ historicalAdjustment, 0, 100)`.

**Confidence**: a direct 70/30 blend, `finalConfidence = baseConfidence *
CURRENT_MARKET_WEIGHT + historicalConfidence * HISTORICAL_WEIGHT` — this is the more
literal reading of "70% market / 30% history" and is used specifically for confidence
(§6), while score uses the bounded-adjustment model above (chosen so history can nudge
rank order without ever being able to invert it purely on its own).

**Edit intensity is negative-only**: a rarely-edited category is never rewarded, only a
heavily-edited one (`categoryEditRates[category] > HEAVY_EDIT_RATE_THRESHOLD`) is
penalized — there is no "increase score because rarely edited" rule, matching the
product requirement precisely ("decrease when category heavily edited").

## 4. Historical signal aggregation (Phase 2)

`getHistoricalRecommendationSignalsForUser(userId, businessProfileId, supabaseClient?)`
returns exactly the fields the milestone asked for, computed only from information
already available (never inferred):

`historicalSampleSize`, `confidenceInHistory`, `overallApprovalRate`,
`overallRejectionRate`, `overallEditRate`, `overallPublishSuccessRate`,
`overallPerformanceRate` (a **coverage** rate — see §9 — not a quality judgment),
`averageUsefulScore`, `channelSuccessRates`, `actionTypeSuccessRates`,
`categorySuccessRates`, `seasonalSuccessRates`, `timeOfDaySuccessRates`,
`categoryEditRates`, `averageTimeToApprovalHours`, `averageEditIntensity`.

A bucket with zero eligible observations is **omitted entirely** from its rate map —
never fabricated as 0 or 50. `timeOfDaySuccessRates`/`preferredPostingTimes` are UTC-based
(`business_profiles` has no stored timezone column) — a documented, honest limitation,
not silently presented as local time.

## 5. Business preference model (Phase 3)

`getBusinessPreferenceProfileForUser` builds on the same per-recommendation details:
`preferredChannels`, `preferredRecommendationTypes`, `preferredCategories`,
`preferredPostingDays`/`preferredPostingTimes` (from actual `publishing_jobs.published_at`
values), `frequentlyRejectedTypes`, `frequentlyEditedTypes`, `highestPerformingTypes`,
`highestPerformingChannels`, `lowestPerformingChannels`, `approvalRate`, `sampleSize`.
Every "frequently X" / "highest/lowest performing" list is gated on real per-bucket
sample size (`MIN_BUCKET_SAMPLE_SIZE_FOR_REASON` = 3 observations) — a single data point
never produces a named preference.

## 6. Confidence model (Phase 6)

Two components, combined:

- **Base (current-opportunity) confidence** — unchanged, `aggregateConfidence`'s own
  output (market context / opportunity confidence, already existing).
- **Historical confidence** — `50 + confidenceInHistory * overallSignal * 50`, where
  `overallSignal` is the average of this recommendation's available dimension signals
  (see §8). Zero history → exactly 50 (neutral/uninformative, not 0 — "no data" should
  never look like "bad data").
- **Final confidence** — the 70/30 blend from §3.

## 7. Cold-start behavior (Phase 7)

`confidenceInHistory = min(1, historicalSampleSize / COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE)`,
i.e. saturates at exactly 20 recommendations. Worked examples (all with a hypothetically
strong 95%+ signal in one direction, to isolate the scaling effect):

| Sample size | `confidenceInHistory` | Effect |
|---|---|---|
| 0 | 0 | No adjustment at all — `finalScore === baseScore` exactly, a `cold_start` reason explains why. |
| 5 | 0.25 | A small nudge — at most ~25% of what the same signal would produce at full confidence. |
| 20 | 1.0 | Full weight — the adjustment reaches its full, uncapped-by-confidence magnitude (still bounded by `MAX_HISTORICAL_ADJUSTMENT_POINTS`). |
| 100 | 1.0 (saturated) | Identical adjustment magnitude to 20 — more history beyond the saturation point doesn't further amplify the adjustment, avoiding overfitting to an ever-growing history. |

This directly implements "avoid overfitting": once a business has enough history to
trust the signal at all, more history refines *which* buckets have data (finer-grained
category/channel/season breakdowns become populated), not how strongly any single
signal is weighted.

## 8. Explainability / reason generation (Phase 5)

`computeAdaptiveRecommendationScore` returns `reasons: RecommendationReason[]` —
`{reasonType, reasonWeight, reasonDescription, reasonSource}` — generated by pure string
templates, **never an AI call**. Exactly one `market_opportunity` reason (`reasonSource:
"market"`) always appears, summarizing the base score. Every other reason
(`reasonSource: "history"`) only appears if the corresponding bucket actually has data —
`action_type_performance`, `channel_performance`, `category_performance` (one per related
category), `seasonal_performance`, `edit_intensity` (only above the heavy-edit
threshold), or `cold_start` (zero history, or history exists but no bucket matches this
recommendation at all).

**Scope boundary, explicitly**: this milestone's market-side reasoning is limited to a
summary of the existing opportunity-derived score. Richer per-evidence reasons like the
brief's own example ("Local competitor activity detected", "Weather relevance high")
would require instrumenting the opportunity detectors themselves — out of scope here,
since this milestone's mandate is historical learning, not re-deriving market evidence
that `lib/marketing-opportunities/*` already owns.

## 9. Provider-failure neutrality (critical correctness detail)

PR #27's `usefulnessSignal` uses `"neutral"` for **both** in-progress states (approved-
not-yet-published, publishing, publishing_queued) **and** provider/OAuth publishing
failures. An early version of this feature's success-rate eligibility only excluded
`"unknown"`, which would have let a `publish_failed` recommendation count as "not
positive" and drag down its action type/channel/category's success rate — directly
violating "never reduce scores solely because publishing failed from OAuth/provider
problems." This was caught before shipping (see `hasConcreteVerdict` in `signals.ts`) and
fixed: **every** success-rate/average-useful-score computation is eligible only for a
concrete `"positive"` or `"negative"` verdict, excluding `"neutral"` and `"unknown"`
entirely. A provider failure is therefore invisible to score adjustment, not merely
non-negative — it simply isn't counted as an observation for that rate at all.
`overallPublishSuccessRate` is the one deliberate exception: it measures *publishing
mechanics* (did the attempt succeed), which a provider failure legitimately is part of —
just never folded into a category/action-type/channel *quality* signal.

## 10. Deterministic scoring / decision-engine integration (Phase 8)

`applyAdaptiveScoringToDrafts` is a pure function: identical inputs (drafts + signals +
`now`) always produce identical output, in the same order as the input array — no
randomness anywhere in this feature. Urgency is recomputed from the *adjusted*
`priorityScore` via the existing `urgencyFromPriorityScore` (never left stale from the
base score). Ranking itself is unchanged: recommendations are still read back ordered by
`priority_score desc, created_at desc` at the SQL level
(`getActiveMarketingRecommendationsForUser`) — since the adjusted score is what gets
persisted, that ordering now reflects the adjustment automatically, with no changes
needed to any read-path query.

## 11. Debug/admin visibility (Phase 9)

`GET /api/admin/recommendation-learning-debug?userId=...&businessProfileId=...`
(admin-allowlist-gated, mirrors every other admin route in this codebase) returns, for
every currently-active recommendation: `storedFinalScore`, `storedFinalConfidence`, and
a freshly `recomputed` `AdaptiveScoreBreakdown` (base score, historical adjustment, final
score, confidence, historical confidence, reasons, sample size).

**No new schema.** The debug view recomputes rather than reads a stored snapshot — base
score is re-derived by re-running `scoreOpportunity`/`aggregatePriorityScore`/
`aggregateConfidence` (the same unchanged pure functions) over the recommendation's still-
persisted `related_opportunity_ids`, and the historical adjustment is recomputed fresh
against *current* signals. This means "recomputed" may differ slightly from "stored" if
history has grown since the recommendation was last generated — a deliberate tradeoff
(no denormalized, staleness-prone cache), consistent with PR #27's own "recompute, don't
cache" philosophy.

## 12. Observability (Phase 10)

`lib/marketing-decisions/service.ts` logs one structured, secret-free line per draft via
`console.info("[AdaptiveRecommendationIntelligence]", {...})`: `userId`,
`businessProfileId`, `dedupeKey` (recommendation identity before it has a DB id),
`actionType`, `baseScore`, `historicalAdjustment`, `finalScore`, `historicalSampleSize`,
`finalConfidence`, and a compact `reasonSummary` (`"reasonType:weight"` strings). Never
logs opportunity/recommendation prompt text, service-role secrets, or OAuth tokens.

## 13. Tests

449 total unit tests now pass (397 pre-existing + 52 new added by this feature) across:

- `unit-tests/recommendation-learning-adaptive-scoring.test.ts` (21) — cold start (zero
  history, no matching bucket), cold-start scaling (5 vs 20 vs 100), per-dimension
  weighting (action type, channel, category, edit intensity — both directions),
  provider-failure neutrality, adjustment bounds, confidence model, determinism, channel
  resolution, urgency recompute, ordering preservation.
- `unit-tests/recommendation-learning-signals.test.ts` (18) — no history, small/large
  sample cold-start scaling, approval/rejection/edit rates, publish success, provider-
  failure neutrality end-to-end through the full aggregation, category/channel/seasonal
  bucketing, multi-recommendation aggregation, tenant-scoping, shared primitives.
- `unit-tests/recommendation-learning-preferences.test.ts` (3), `recommendation-learning-
  debug.test.ts` (3), `admin-recommendation-learning-debug.test.ts` (5) — validator,
  minimum-sample gating, debug output shape, cookie-bound wrapper contracts.
- `unit-tests/marketing-decisions-adaptive-integration.test.ts` (2) — end-to-end proof
  that a real historical rejection pattern lowers the *persisted* `priority_score` below
  the base market score, and that urgency stays consistent.

All existing pre-existing tests (397) pass unmodified — zero history is the default in
every prior test fixture, and this feature's cold-start passthrough (`finalScore ===
baseScore` exactly at zero history) guarantees no behavior change for any test that
doesn't explicitly configure historical data.

## 14. Verification results

- `npm run lint` — clean; 0 new errors/warnings (3 pre-existing errors + 11 pre-existing
  warnings in untouched files, unchanged baseline).
- `npm run test:unit` — **449/449 pass** (397 pre-existing + 52 new).
- `npm run build` — production build succeeds; TypeScript compiles cleanly (two real
  type errors were caught and fixed during this work — see commit history — both were
  `as const` misuse on non-literal property accesses, fixed with explicit return-type
  annotations instead).
- `npx playwright test` — existing `tests/homepage.spec.ts` passes.
- Client bundle scan (`.next/static/`) — no match for `SUPABASE_SECRET_KEY`,
  `createServiceRoleClient`, or any `lib/recommendation-learning` symbol.
- No Trigger.dev files were touched at all in this feature (confirmed via `git status`);
  `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

## 15. Manual verification

1. Generate recommendations for a business with no history yet (`runMarketingDecisionEngineForUser`
   or the pipeline's `decision_engine` stage) — confirm `priority_score`/`confidence`
   exactly match what they'd have been before this feature (no adjustment).
2. Approve, reject, edit, publish, and let analytics capture run for several
   recommendations of the same action type/category over time (or seed
   `recommendation_outcome_events` directly for faster iteration).
3. Re-run recommendation generation for the same business — confirm `priority_score`
   for that action type/category now differs from the raw market score, in the
   direction matching the historical pattern (up for approved/published, down for
   rejected/heavily-edited).
4. Call `GET /api/admin/recommendation-learning-debug?userId=...&businessProfileId=...`
   — confirm the response's `recomputed.baseScore` matches step 1's original score, and
   `recomputed.reasons` lists the specific historical dimensions that moved the score.
5. Confirm a recommendation whose only publishing history is an OAuth/provider failure
   produces **no** action-type/channel/category adjustment either direction.

## 16. Known limitations

- `timeOfDaySuccessRates`/`preferredPostingTimes` are UTC-based; `business_profiles` has
  no stored timezone, so these do not reflect the business's actual local time yet.
- `overallPerformanceRate` is a coverage rate (did performance data become available),
  not a quality judgment — performance *magnitude* is deliberately not folded into
  scoring in this milestone, since the underlying `content_performance` records are
  still an aggregate-allocation estimate (PR #27), not true per-post analytics.
- The debug view recomputes live rather than showing a frozen snapshot of the score at
  generation time (§11) — by design, but worth knowing when comparing "stored" vs
  "recomputed" values days apart.
- `getRecommendationLearningDebugForUser` and `getHistoricalRecommendationSignalsForUser`
  loop per-recommendation (reusing `summarizeRecommendationOutcomeForUser`); fine at
  today's scale, a candidate optimization if a tenant's history grows very large.
- "Category" reasoning treats a merged recommendation as contributing to every
  constituent opportunity category, which is a reasonable but approximate attribution
  when several categories are merged into one action (e.g. holiday + weather + local
  event all merging into `create_timely_content`).

## 17. Future ML extension points

Everything in this milestone is deterministic and rule-based by design. If a future
milestone introduces actual learned weighting (e.g. a per-tenant logistic model over the
same bucketed signals), the natural extension points are: (1) replace
`signalFromRate`/the fixed per-dimension point caps in `adaptiveScoring.ts` with a
learned weight per dimension, keeping the same `HistoricalRecommendationSignals` input
contract; (2) `confidenceInHistory`'s linear saturation curve could become a model-
calibrated confidence estimate; (3) the reason-generation templates could be preserved
as human-readable explanations of whichever features a future model actually weights
most heavily (explainability doesn't have to be sacrificed just because scoring becomes
learned). None of this is started or assumed by the current implementation.
