# Marketing Memory Learnings — Phase 2 Implementation

**Branch:** `project-magic-marketing-memory-learnings` (from latest `main`, post–PR #52)
**Depends on:** [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md) (design blueprint), [`MARKETING_MEMORY_DATA_MODEL.md`](./MARKETING_MEMORY_DATA_MODEL.md) (schema, now updated for Phase 2), [`MARKETING_MEMORY_FOUNDATION.md`](./MARKETING_MEMORY_FOUNDATION.md) (the Phase 1 observation/evidence foundation this phase builds on).

This document records what Phase 2 ("learnings and confidence") actually implements, exactly as it exists in code — not aspirational scope. See §14 for what is deliberately *not* included yet.

---

## 1. Phase 2 Scope

Two new pieces of schema and one new server-only module family:

| Piece | What it is |
|---|---|
| `supabase/migrations/025_marketing_memory_learnings.sql` | `marketing_memory_learnings` (new table) + an additive `ALTER` on `marketing_memory_evidence_links` (migration 024, unmodified — only extended) |
| `lib/marketing-memory/learning*.ts` | `learningConfig.ts`, `learningTypes.ts`, `learningMath.ts`, `seasonality.ts`, `rationale.ts`, `cohorts.ts`, `learningEvaluation.ts`, `learningPersistence.ts`, `learningService.ts` |
| `app/api/admin/trigger-marketing-memory-learning-evaluation/route.ts` | Admin-only, manually-invoked, tenant-scoped evaluation entry point |

**Learnings do not influence any recommendation, the Marketing Director, or any customer-facing surface in this PR.** Every file this PR touches beyond `lib/marketing-memory/` and its own tests is the single new admin route above — `git diff --stat main -- app/ components/ lib/marketing-director/ lib/marketing-decisions/ lib/recommendation-learning/` is empty except for that one new admin-only file (verified in §13).

---

## 2. Deviations from the Architecture Documents, and Why

1. **`marketing_memory_evidence_links` is extended, not duplicated.** `MARKETING_MEMORY_FOUNDATION.md`'s Phase 1 write-up explicitly promised: *"A future Phase 2 migration can add a nullable `learning_id` column without breaking this shape."* Migration 025 does exactly that: `observation_id` becomes nullable, a nullable `learning_id` FK is added, a `contribution` column (`supporting | contradicting | neutral | excluded`) is added, `source_type`'s check constraint gains `'observation'`, and a new `exactly-one-anchor` check constraint (`observation_id` XOR `learning_id`) replaces the old `observation_id not null` requirement. Every Phase 1 row (`observation_id` set, `learning_id` null by construction) remains valid under the new constraints — live-verified in §12.

2. **Evidence-link `contribution` is not updated in place when a re-evaluation reclassifies an observation.** If an observation was linked as `supporting` on one evaluation run and a later run's fresh baseline reclassifies it as `contradicting`, the existing link row is **not** rewritten — `marketing_memory_evidence_links` stays append-only by design (matching Phase 1's own philosophy), so a new row with the same `(learning_id, observation_id)` pair would need a different idempotency key to coexist, which this implementation does not attempt. The **learning row's own `supporting_count`/`contradicting_count`/`confidence_components`** are the single current-state source of truth; `evidence_links` is a supplementary traceability trail that may contain a stale `contribution` value for an older link. Documented here rather than silently accepted — see §11 (Known Limitations).

3. **Only two learning families are implemented**, not the five candidate families the architecture doc's "Learning Families" section lists. See §3 for the full honesty argument — weather association and event-attention association are explicitly **not** implemented, because Phase 1 never classifies `impact_direction` beyond `'unknown'` for any context item, so there is no honest directional signal to learn from yet. Building a family on top of free-text `market_context_items.title`/`summary` parsing would be exactly the "placeholder logic that fabricates insights from missing fields" the task explicitly forbids.

4. **No Trigger.dev task was added.** The architecture doc anticipated an optional, unscheduled, manually-triggerable Trigger.dev task. This implementation uses only a manually-invoked admin API route (mirroring `app/api/admin/trigger-recommendation-outcome-reconciliation/route.ts` exactly), which already satisfies "a safe, tenant-scoped, manually-invoked evaluation entry point" without the added surface area of a task definition that would need its own "never scheduled" guarantee. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains untouched and `false`.

---

## 3. Learning Families — What's Implemented and Why Only These Two

### `timing_performance` (implements the architecture's "Timing performance" + "Calendar and seasonal association" families)

Source: `performance_measured` observations (Phase 1), whose `metric_summary` was confirmed by direct code inspection to contain `{ windowKey, views, clicks, engagement, conversions, performanceScore }` — a flat, all-primitive object that survives Phase 1's `sanitizeMetricSummary` intact (see `lib/recommendation-outcomes/service.ts`'s `recordPerformanceMeasuredOutcome`). `performanceScore` is the canonical metric: a single, pre-normalized 0–100 composite, avoiding the "must use the same outcome metric" cohort-comparability trap that mixing raw views/clicks/engagement across different content would create.

Time dimension: `day_of_week`, `month`, and `season` — all three already computed and stored on `marketing_memory_context_snapshots.context_summary` by Phase 1 (`dayOfWeek`, `month`, `season`), joined via `observations.context_snapshot_id`. No new computation, no new join beyond what Phase 1 already stores.

**Structural confidence ceiling — the single most important honesty guardrail in this PR.** `lib/analytics/analyticsEngine.ts`'s `syncContentPerformanceRecords` allocates a day's aggregate GBP views/clicks evenly across that day's published posts ("aggregate allocation"), confirmed by reading that function directly during this PR's research — it is **not** a true per-post measurement. Every `performanceScore` this codebase produces today inherits that estimation. `timing_performance` can therefore never honestly reach `strong_pattern` confidence — `PERFORMANCE_ESTIMATION_CONFIDENCE_CEILING` in `learningConfig.ts` caps it at `developing_pattern`, applied as the final step of `evaluateCohort` in `learningEvaluation.ts`, and every such Learning's `confidence_components.confounderCodes` includes `estimated_performance_metric`. This ceiling lifts automatically, with no code change, once the analytics engine measures true per-post performance.

### `recommendation_action_outcome` (implements the architecture's "Content or action outcome" family)

Source: `recommendation_approved`/`recommendation_rejected` observations, joined with their recommendation's `recommended_action_type` via the `marketing_memory_evidence_links` row of `source_type: 'recommendation'` that every such observation already carries (written by Phase 1's `recordObservationForOutcomeEvent`). Subject: the `recommended_action_type` value (e.g. `request_reviews`, `upload_photos`). Baseline: the business's overall approval rate across all action types. No `time_dimension` — this family answers "does this kind of recommendation get approved," not a timing question.

This family has **no structural confidence ceiling** — approval/rejection is a direct, unestimated fact (a human clicked approve or reject), unlike `performanceScore`.

### Families explicitly NOT implemented

- **Weather association**, **event-attention association**: Phase 1's `marketing_memory_context_snapshots.impact_direction` is *always* `'unknown'` (documented explicitly in `MARKETING_MEMORY_FOUNDATION.md` §4) — there is no typed, directional signal anywhere in Phase 1's schema to build "precipitation hurt engagement" or "the game competed for attention" from. The raw data exists (`context_item_ids` → `market_context_items`), but deriving a direction would require parsing untyped, provider-specific `title`/`summary` free text — exactly the fabrication this task explicitly forbids. Reserved for a future phase once a context provider or Phase 1 extension classifies impact direction honestly.

---

## 4. Cohort Rules — What Counts as Comparable

A cohort is (business, learning family, time dimension if applicable, subject value) — e.g. `(biz-1, timing_performance, day_of_week, thursday)` or `(biz-1, recommendation_action_outcome, none, request_reviews)`. `lib/marketing-memory/cohorts.ts`'s `buildCohorts` enforces:

- **Same business** — every fetch function (`fetchPerformanceEvidenceRows`, `fetchActionOutcomeEvidenceRows`) filters by `user_id` + `business_profile_id`; cross-tenant data never enters a cohort.
- **Same outcome metric** — `timing_performance` cohorts only ever compare `performanceScore` to `performanceScore`; `recommendation_action_outcome` cohorts only ever compare approval (0/1) to approval rate. The two families' metrics are never mixed.
- **Same observation type family** — `timing_performance` draws only from `performance_measured`; `recommendation_action_outcome` draws only from `recommendation_approved`/`recommendation_rejected`. GBP impressions are never compared against review approvals, and website calls are never compared against content-generation completion — the two families' data never overlap.
- **Compatible time period** — bounded by `EVALUATION_WINDOW_DAYS` (180 days, see §9).
- **Normalized context dimension** — `timing_performance`'s three time dimensions (day_of_week/month/season) are evaluated **independently**; a business's Thursday pattern and December pattern are separate cohorts, never conflated into one.
- **Minimum data quality** — `MIN_SAMPLE_SIZE_TO_CREATE = 2` (a group with fewer members is dropped entirely, never produces a Learning); rows with an unresolvable action type or non-numeric `performanceScore` are dropped before cohort-building, not guessed.
- **Baseline availability** — see §5; a cohort with no reliable baseline never produces a directional Learning.

Invalid comparisons the architecture doc names explicitly (GBP impressions vs. review approvals; website calls vs. content-generation completion; summer HVAC vs. winter retail without seasonal adjustment) are structurally impossible here: the two families never share a metric, and the seasonal case is handled by evaluating month/season as independent cohorts rather than a single undifferentiated pool.

---

## 5. Baseline Strategy

Both families use the same baseline type: **recent business average** — the mean value across *all* comparable evidence for that business within the evaluation window (`buildCohorts`'s `overallAverage`), not a copied dataset. `timing_performance`'s baseline is described to the customer as *"trailing rolling average performance score for this business"*; `recommendation_action_outcome`'s as *"overall approval rate across all recommendation types for this business."*

No duplicate analytics warehouse is created: the baseline is computed in memory from the same `performance_measured`/`recommendation_approved`/`recommendation_rejected` observations already fetched for cohort-building — a compact `baseline_value` (a single number) and `comparison_baseline` (a human-readable description) are stored on the Learning row, never a copy of the underlying `analytics_snapshots`/`content_performance` rows.

**When no reliable baseline exists, no directional Learning is derived**: `MIN_EFFECT_SIZE_FOR_DIRECTION = 0.05` means any cohort whose relative difference from baseline is under 5% is classified `neutral`, not guessed positive or negative; a cohort with fewer than 2 members never becomes a Learning at all (§4).

---

## 6. Supporting and Contradictory Evidence

Every observation within a cohort is individually classified relative to the cohort's own net direction, via `lib/marketing-memory/learningMath.ts`'s `classifyEvidenceItem` — the single shared function both families use:

- **Supporting**: the item's own relative effect points the same direction as the cohort's net direction.
- **Contradicting**: the item's own relative effect points the *opposite* direction — e.g. a "weak Thursday" (a below-baseline performance score on a day the cohort overall reads as above-baseline) is contradicting evidence, not silently dropped.
- **Neutral**: the item's own effect is inside the noise band (`MIN_EFFECT_SIZE_FOR_DIRECTION`).
- **Excluded**: rows dropped before cohort-building even runs (unresolvable action type, non-numeric metric, insufficient group size) — tracked as `excluded_count` on the Learning row, distinct from neutral.

`supporting_count`, `contradicting_count`, `neutral_count`, `excluded_count`, `consistency` (supporting / (supporting + contradicting), excluding neutral from the denominator — the exact convention already established by `lib/recommendation-learning/signals.ts`'s `successRateByBucket`), and `contradictionRate` are all stored directly on the Learning row, not recomputed on read.

**Negative outcomes remain first-class evidence** — a `recommendation_rejected` observation is not discarded or down-weighted at the evidence layer; it participates in cohort math exactly like an approval, and a consistently-rejected action type produces a genuine `negative`-direction Learning with its own confidence level, not a missing or suppressed row.

---

## 7. Confidence Model

Deterministic, rule-based, documented — never an LLM call or opaque ML model. Every threshold lives in `lib/marketing-memory/learningConfig.ts`, the single centralized configuration file (`classifyConfidence` in `learningMath.ts` is the only function that reads them):

```
if sampleSize < 3:                                             -> early_signal
elif consistency < 0.6 or contradictionRate > 0.3:               -> early_signal
elif sampleSize >= 8 and consistency >= 0.7
     and (recencyDays <= 120 or seasonalRecurrenceCount >= 1):    -> strong_pattern
else:                                                             -> developing_pattern
```

Customer-safe levels: `early_signal` / `developing_pattern` / `strong_pattern` only — `confirmed_preference` is reserved for a future phase (explicit customer preferences don't exist yet) and is **excluded from the database's own `check` constraint**, not just unused by application code (see migration 025).

Every example in the task's own "Example Confidence Behavior" section is a passing test in `unit-tests/marketing-memory-learning-math.test.ts`: one observation never reaches Strong; three inconsistent observations stay Early signal; several recent, moderately consistent observations become Developing; repeated, highly consistent, recent evidence becomes Strong; strong older evidence contradicted repeatedly in the last 90 days becomes Weakening (§8).

---

## 8. Confounders, Decay, and Weakening

### Confounders (`ConfounderCodes` in `learningConfig.ts`)

A closed vocabulary of structured reason codes — never generated speculation:

| Code | Trigger |
|---|---|
| `small_sample` | cohort sample size below `STRONG_PATTERN_MIN_SAMPLE` |
| `estimated_performance_metric` | always set for `timing_performance` (see §3's structural ceiling) |
| `mixed_evidence` | consistency below 0.5 with at least 3 supporting+contradicting items |
| `insufficient_recency` | most recent evidence older than the evaluation window itself |
| `low_baseline_quality` | the *overall* comparable sample (not just this cohort) is small |

Confounders reduce confidence (via the rules above) or, for `estimated_performance_metric`, cap it outright — they never attempt full causal inference.

### Recency and decay

`RECENT_WEAKENING_WINDOW_DAYS = 90` and `RECENT_CONTRADICTION_RATE_FOR_WEAKENING = 0.5` are the only two decay-adjacent constants Phase 2 needs: `buildCohorts` computes a **separate** contradiction rate using only evidence within the last 90 days (`recentContradictionRate`), independent of the full-window statistics. If that recent-window contradiction rate meets or exceeds 50%, the Learning's status becomes `weakening` even if its full-history sample would otherwise read `strong_pattern` — and its confidence is pulled back to, at most, `developing_pattern` (never reported with unearned confidence while actively weakening). This lets Phase 2 detect "a previously strong pattern has weakened over the last 90 days" (the task's own example) **within a single evaluation pass**, without needing to compare against a previously stored row.

No row is ever deleted for decay — Learnings only transition `status`, and superseded rows remain fully queryable (§10).

### Seasonality

`lib/marketing-memory/seasonality.ts` maps each `time_dimension` to a `recurrence_pattern` (`day_of_week → recurring_weekly`, `month → annual_month`, `season → annual_range`, no dimension → `none`) and counts distinct calendar years represented in a month/season cohort's evidence (`seasonalRecurrenceCount`, requiring at least 2 distinct years before counting as "recurring" — `MIN_YEARLY_OCCURRENCES_FOR_RECURRENCE`). A December pattern seen in only one year is *not* yet a confirmed recurring pattern; the same pattern observed across two different Decembers is. This is what lets a stale (>120-day-old) seasonal Learning still reach `strong_pattern` (the confidence formula's `seasonalRecurrenceCount >= 1` branch) — "a December pattern should not have equal active weight in July, but should reappear when December returns" is satisfied by recency + seasonal-recurrence being interchangeable inputs to the same formula, not by a separate always-on/always-off toggle.

---

## 9. Reconciliation and Supersession

`lib/marketing-memory/learningService.ts`'s `evaluateLearningsForBusiness` is the single entry point. For every cohort evaluated:

1. **No existing live row for this `learning_key`** (a row in `emerging`/`active`/`weakening`/`inconclusive` status — the four "currently representing this pattern" states) → **insert** a new row, then link its supporting/contradicting evidence.
2. **An existing live row with the same or compatible direction** (anything except a genuine positive↔negative reversal) → **update in place**: same row id, refreshed counts/confidence/status/`evaluated_at`. Running the identical evaluation twice against unchanged evidence produces the identical update — idempotent by construction, not by a separate deduplication check.
3. **A genuine direction flip** (`positive → negative` or `negative → positive`) → **supersede**: the old row's `status` becomes `superseded` and its `superseded_by_learning_id` is set; a brand-new row is inserted for the reversed conclusion. This is the only case that creates a second row for the same `learning_key` — matching the architecture's "supersede rather than silently overwrite materially changed conclusions" rule exactly. A transition into or out of `neutral`/`inconclusive` is **not** treated as a flip (it's the same pattern, now measured as flat) — only an unambiguous sign reversal triggers supersession.

`marketing_memory_learnings_live_key_idx` (a partial unique index on `(business_profile_id, learning_key)` scoped to the four live statuses) is the database-level guarantee that step 1 vs. steps 2/3 is a real race-free decision, not just an application-level convention — live-verified in §12 (a second insert attempt for the same live key fails with `23505`, and updating the old row to `superseded` correctly frees the slot for a new row).

---

## 10. RLS and Tenant Isolation

`marketing_memory_learnings` carries `user_id` + `business_profile_id`, both `not null`, both FK'd `on delete cascade`. Unlike Phase 1's purely append-only tables, this table is **mutable** (reconciliation updates a live row in place) — so its RLS policy set is `select`/`insert`/`update`, still with **no `delete` policy for any authenticated role**: a Learning is never deleted, only superseded, at the database level, not just by convention. A `set_marketing_memory_learnings_updated_at` trigger (matching the exact per-table trigger-function naming convention already established for every other mutable table in this schema, e.g. `006_google_business_profile_connections.sql`) keeps `updated_at` current on every reconciliation.

Live-verified against the real database (§12): anonymous `select` returns an empty array; anonymous `insert` is rejected with Postgres `42501`.

---

## 11. Evaluation Triggering

**Deliberately not wired into Phase 1's observation-ingestion hooks.** The task allowed a "bounded best-effort evaluation" to be enqueued from observation recording, but this implementation chose not to, for a concrete reason found during this PR's own research: Phase 1's two ingestion hooks (`insertRecommendationOutcomeEvent`, `captureSnapshotForUser`) are already awaited (not fire-and-forget) inside request-serving paths — an approval/rejection API call, a scheduled analytics capture. Adding a *third* layer of awaited work (a full learning evaluation, which fetches and processes up to `MAX_OBSERVATIONS_PER_EVALUATION` rows) directly in that same call chain would add meaningful, unbounded-feeling latency to an already-sensitive hot path for a benefit (freshly re-evaluated Learnings) that has no consumer yet in this PR anyway (§1). Instead:

- `evaluateLearningsForBusiness(supabase, userId, businessProfileId)` is the safe, tenant-scoped, bounded entry point.
- `POST /api/admin/trigger-marketing-memory-learning-evaluation` is its only caller in this PR — admin-authenticated (`requireAdminUser`), ownership-verified (the target `business_profiles` row must belong to the given `userId`), synchronous, never scheduled. Mirrors `app/api/admin/trigger-recommendation-outcome-reconciliation/route.ts` exactly.
- No Trigger.dev task exists for this in Phase 2 (§2, deviation 4). `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` and untouched.

This is explicitly revisitable in a future phase — e.g. a genuinely fire-and-forget (never-awaited, error-swallowed) trigger, or a scheduled-but-manually-approved batch job — once Phase 4 gives Learnings an actual consumer worth keeping fresh automatically.

---

## 12. Migration Verification

Applied via `supabase db push` against the same linked "AJN marketing" remote project used throughout this PR series (already fully in sync through migration 024 from the prior PR). Live-verified via direct PostgREST calls (no Docker available in this environment):

| Check | Result |
|---|---|
| `marketing_memory_learnings` reachable | HTTP 200 |
| `marketing_memory_evidence_links.learning_id`/`contribution` columns reachable | HTTP 200 |
| Valid learning insert, correct defaults (`status: emerging`, `confidence_level: early_signal`, `recurrence_pattern: none`) | HTTP 201 |
| Partial unique index rejects a second live row for the same `(business_profile_id, learning_key)` | HTTP 409, Postgres `23505` (`marketing_memory_learnings_live_key_idx`) |
| `confidence_level` check rejects `'confirmed_preference'` | HTTP 400, Postgres `23514` |
| `status` check rejects an invalid value | HTTP 400, Postgres `23514` |
| Evidence link: learning-anchored insert (`observation_id: null`, `learning_id` set, `contribution: supporting`) | HTTP 201 |
| Evidence link: exactly-one-anchor check rejects both `observation_id` and `learning_id` null | HTTP 400, Postgres `23514` |
| Supersession integrity: updating a row to `status: superseded` frees its live-key slot; a new insert with the same `learning_key` then succeeds | HTTP 200 then HTTP 201 |
| `updated_at` trigger fires on update | confirmed (`updated_at` changed, `created_at` did not) |
| RLS blocks unauthenticated `select`/`insert` on `marketing_memory_learnings` | HTTP 200 (empty array) / HTTP 401, Postgres `42501` |
| Phase 1 observation-anchored evidence-link shape still works, unaffected by the `ALTER` | confirmed (a fabricated `observation_id` correctly hits the real FK constraint, `23503` — proving the row passed the new exactly-one-anchor check exactly as a Phase 1 row always did) |

All test rows (two `marketing_memory_learnings` rows, one `marketing_memory_evidence_links` row) were deleted via the service-role client immediately after; a follow-up `select ... where learning_key like 'verify-test%'` / `idempotency_key like 'verify-test%'` confirmed zero rows remain. **Migration 024 was not modified** — confirmed via `git status`/`git diff` against `main` showing only `025_marketing_memory_learnings.sql` as new.

---

## 13. Performance

**Expected Phase 2 workload**: one evaluation run per business, invoked manually (§11) — not per-request, not per-observation. Each run is bounded by `EVALUATION_WINDOW_DAYS = 180` and `MAX_OBSERVATIONS_PER_EVALUATION = 500` (defense in depth alongside the window), applied identically to both fetch functions.

**Indexes** (all in migration 025):

- `marketing_memory_learnings_live_key_idx` — the partial unique index doubling as the primary "does a live learning already exist for this key" lookup (§9).
- `marketing_memory_learnings (business_profile_id, status)` and `(business_profile_id, learning_family)` — the two filters `getLearningsForBusiness` and any future consumer will use.
- `marketing_memory_learnings (learning_key)`, `(confidence_level)` — secondary lookup/filtering paths.
- `marketing_memory_evidence_links_learning_id_idx` (partial, `where learning_id is not null`) — cheap because most rows remain Phase 1's observation-anchored shape.

**No partitioning, materialized summaries, or archival** are implemented or proposed in this PR. **Revisit threshold**: once a business's `performance_measured` + `recommendation_approved`/`recommendation_rejected` observation count within a 180-day window approaches `MAX_OBSERVATIONS_PER_EVALUATION` regularly (at which point the hard cap, not the window, starts silently truncating evidence), or once evaluation is invoked frequently enough that repeated 180-day scans across many businesses become a real aggregate cost — neither condition is close at Phase 2's expected pilot-stage volume.

Confirmed via `git diff --stat main -- app/ components/ lib/marketing-director/ lib/marketing-decisions/ lib/recommendation-learning/`: **empty** except for the one new admin route — no dashboard route, no recommendation-scoring path, and no Marketing Director path does any additional work because of this PR.

---

## 14. Testing

79 new tests across seven files (`marketing-memory-learning-math`, `-cohorts`, `-rationale`, `-evaluation`, `-persistence`, `-service`, plus the admin route's request-parser test), all passing alongside the full pre-existing 687-test suite (766 total, zero regressions):

- **Cohorts and baselines**: comparable observations grouped correctly; groups below the minimum sample size excluded entirely; unrelated groups never contaminate each other's baseline; consistent evidence classifies every item as supporting; mixed evidence produces real contradicting items; negative outcomes remain usable, not discarded; seasonal cohort matching (a single-year December is not yet recurring; two distinct Decembers are).
- **Evidence classification**: supporting/contradicting/neutral via the shared `classifyEvidenceItem`; binary (approval) items classify cleanly against a fractional baseline; excluded rows (unresolvable action type, non-numeric metric) tracked distinctly from neutral.
- **Confidence**: every example from the task's own "Example Confidence Behavior" section, plus contradiction-rate capping, stale-non-seasonal capping, and seasonal-recurrence forgiveness of staleness.
- **Language safeguards**: an exhaustive sweep of every confidence level × direction × family combination proving zero forbidden causal/absolute terms ever appear in a generated summary; template-shape assertions per confidence level; the recommendation-action-outcome family uses the customer-safe action label, never the raw enum value.
- **Reconciliation**: repeated evaluation of unchanged evidence is idempotent (no duplicate insert for an unchanged cohort); new supporting evidence strengthens a Learning (update path); new contradicting evidence weakens it (§8's recent-window mechanism, verified end-to-end); a genuine direction flip supersedes correctly, including the `superseded_by_learning_id` link.
- **RLS and persistence**: tenant-isolation contract tests (`userIdsQueried`) on every read function; live database verification (§12) for the parts a fake client can't prove (real constraint enforcement, real RLS denial).
- **Integration**: the admin route's request-body parser (valid/invalid shapes); `evaluateLearningsForBusiness` never throws even when every `marketing_memory_learnings` write fails or every fetch fails outright; the bounded evaluation window (`gte`/`limit`) is actually applied to the observation query.

---

## 15. Self-Review

Performed against the full checklist before this PR was finalized, each finding verified directly against code (and, where noted, the live database) rather than asserted:

| Check | Finding |
|---|---|
| Learning records that are really raw observations | Not present. A Learning is always a cohort aggregate (`sample_size >= 2`, a computed `effect_size`/`direction`/`confidence_level`) — never a 1:1 copy of a single observation. |
| Correlation presented as causation | Not present. Verified exhaustively: `unit-tests/marketing-memory-learning-rationale.test.ts` sweeps every confidence level × direction × learning-family combination through `buildCustomerSafeSummary` and asserts zero forbidden terms; `learningEvaluation.ts`'s summaries are template-generated only, with no free-form code path. |
| Confidence inflation | Not present. A single observation never exceeds `early_signal` (tested); the `timing_performance` family has a hard structural ceiling (`developing_pattern`) since its only metric (`performanceScore`) is an aggregate-allocation estimate, not a true measurement (§3). |
| Weak or missing baselines | Not present. `MIN_SAMPLE_SIZE_TO_CREATE = 2` — a group below this is dropped, never becomes a Learning; `LOW_BASELINE_QUALITY` confounder code flags a small overall comparable sample. |
| Contradictory evidence ignored | Not present. First-class throughout: `contradicting_count`/`contradictionRate` on every Learning; `classifyEvidenceItem` treats a disagreeing observation as real evidence, not noise; the recent-window weakening mechanism (§8) exists specifically to let contradiction pull confidence down. |
| Stale evidence carrying too much weight | Not present. `recencyDays` gates `strong_pattern` directly; the separate recent-90-day contradiction check (§8) can demote an otherwise-strong Learning to `weakening` independent of its full historical sample. |
| Seasonal patterns applied outside their period | Not applicable yet — no consumer reads or displays a Learning anywhere in this PR (confirmed below), so there is no surface where an out-of-season pattern could be misapplied. `seasonalRecurrenceCount` is stored as a confidence input only, not as a live in-season/out-of-season toggle. |
| Duplicate analytics storage | Not present. Baselines are computed in memory from observations already fetched for cohort-building; only a single `baseline_value` number and a description are stored, never a copy of `analytics_snapshots`/`content_performance` rows. |
| Another recommendation or prioritization engine emerging | Not present. `marketing_memory_learnings` has no priority/ranking column, no "primary action" concept, and is never consulted by any recommendation or Marketing Director code path (confirmed by grep, next row). |
| Learning evaluation blocking source workflows | Not present, by the strongest possible construction: evaluation is **not wired into Phase 1's ingestion hooks at all** (§11) — `git diff main -- lib/recommendation-outcomes/persistence.ts lib/analytics/analyticsEngine.ts` shows no changes in this PR. |
| Weak RLS | Not present. Live-verified (§12): anonymous select/insert on `marketing_memory_learnings` behave exactly as every other tenant table. |
| Cross-tenant evidence access | Not present. Every fetch/persistence function filters by `userId`, contract-tested via `userIdsQueried`. |
| Client imports of server-only modules | Not present. Every new file starts with `import "server-only"` (verified directly, all ten new `lib/marketing-memory/learning*.ts` + `cohorts.ts`/`seasonality.ts`/`rationale.ts` files, plus the admin request-parser). |
| Unbounded historical scans | Not present. `EVALUATION_WINDOW_DAYS` + `MAX_OBSERVATIONS_PER_EVALUATION` bound every fetch; verified via a test asserting the `gte`/`limit` calls are actually issued. |
| Premature abstractions | Not present. No separate "evaluation run" tracking table (the Learning row's own `evaluated_at` suffices); no Trigger.dev task (the admin route alone satisfies the requirement); exactly two learning families, not five. |
| Unsupported learning families | Not present. Weather and event-attention are explicitly excluded with a concrete, code-verified reason (Phase 1's `impact_direction` is always `'unknown'`) rather than built on shaky free-text parsing. |
| Hidden customer-facing behavior changes | Not present. `git diff --stat main -- app/ components/` is empty. |

**Search for every new learning consumer** (the task's explicit final check): `grep -rl "learningService\|evaluateLearningsForBusiness\|marketing_memory_learnings"` across the repository, excluding `lib/marketing-memory/` itself, `unit-tests/`, `supabase/migrations/`, and `docs/`, returns exactly one match: `app/api/admin/trigger-marketing-memory-learning-evaluation/route.ts` — the one admin-only, manually-invoked entry point this PR adds. **No customer-facing route and no Marketing Director file consumes a Learning anywhere in this PR.**

---

## 16. Known Limitations

- **Evidence-link `contribution` can go stale** on reconciliation (§2, deviation 2) — the Learning row's own aggregate counts remain authoritative; an individual link row is a point-in-time citation, not guaranteed current.
- **`timing_performance` can never reach `strong_pattern`** until the analytics engine stops using aggregate-allocation estimation for per-post performance (§3) — an honest, structural limitation, not a bug.
- **No automatic evaluation triggering** (§11) — Learnings only refresh when the admin route is manually invoked; a business's Learnings can go stale between invocations with no automatic freshness guarantee in this PR.
- **No backfill** — evaluation only considers observations already recorded by Phase 1's ingestion hooks going forward; no historical reconstruction beyond what Phase 1 has already captured since its own deploy.
- **Two families only** (§3) — weather, event-attention, and any content-theme-beyond-action-type family remain unimplemented until Phase 1 (or a future phase) provides an honest typed directional signal to learn from.
- **No archival/partitioning** (§13) — not needed yet at expected volume, explicitly revisited at the threshold described there.

---

## 17. Next Phase

Per `MARKETING_MEMORY_ARCHITECTURE.md` §20's phased plan, the next phase is **Phase 3 — Customer preferences and overrides**: add `marketing_memory_preferences` and `marketing_memory_overrides` (both independent of this phase's Learnings — see the data model doc's dependency table), and ship the minimal settings surface for explicit preferences. **Phase 4 — Marketing Director consumption** — the first phase where a `MarketingMemoryEvidencePackage` actually reaches `resolveMarketingDirectorDecision` — remains explicitly out of scope until Preferences exist, since the architecture's override precedence order (legal → explicit preferences → business goals → strong learnings → developing patterns → generic best practices) requires Preferences to be meaningful before Learnings can safely influence a decision.
