# Marketing Memory Foundation — Phase 1 Implementation

**Branch:** `project-magic-marketing-memory-foundation` (from latest `main`, post–PR #51)
**Depends on:** [`MARKETING_MEMORY_ARCHITECTURE.md`](./MARKETING_MEMORY_ARCHITECTURE.md) (the design blueprint this PR implements), [`MARKETING_MEMORY_DATA_MODEL.md`](./MARKETING_MEMORY_DATA_MODEL.md) (field-level schema, now updated to match what actually shipped), [`MARKETING_DIRECTOR_FOUNDATION.md`](./MARKETING_DIRECTOR_FOUNDATION.md) (the composition layer this evidence will eventually feed — unchanged by this PR).

This document records what Phase 1 ("observation and evidence foundation") actually implements, exactly as it exists in code today — not aspirational scope. See §14 for what is deliberately *not* included yet.

---

## 1. Implemented Phase 1 Scope

Three new tables, one new server-only module, two new ingestion hooks into already-authoritative code paths. Nothing else changed.

| Piece | What it is |
|---|---|
| `supabase/migrations/024_marketing_memory_foundation.sql` | `marketing_memory_context_snapshots`, `marketing_memory_observations`, `marketing_memory_evidence_links` |
| `lib/marketing-memory/` | `types.ts`, `mapping.ts`, `idempotency.ts`, `metadata.ts`, `contextNormalization.ts`, `persistence.ts`, `service.ts` |
| `lib/recommendation-outcomes/persistence.ts` | +1 hook: records an observation after every successfully-inserted outcome event |
| `lib/analytics/analyticsEngine.ts` | +1 hook: records an observation after every successful analytics snapshot capture |

No Learnings, confidence scores, customer preferences, overrides, or Marketing Director consumption exist in this PR. No new provider, no new LLM call, no schedule, no customer-facing UI.

---

## 2. Deviations from `MARKETING_MEMORY_DATA_MODEL.md`, and why

The original data-model document (merged in PR #51) scoped `marketing_memory_evidence_links` to **Phase 2**, anchored on a `marketing_memory_learnings` row. This implementation task explicitly elevated evidence-links into **Phase 1**, anchored on `marketing_memory_observations` instead, since no Learnings exist yet. Three concrete schema changes follow from that:

1. **`evidence_links.observation_id` replaces `evidence_links.learning_id`.** A future Phase 2 migration can add a nullable `learning_id` column without breaking this shape or requiring a rename.
2. **`observations` has exactly two typed "primary source" FKs** (`source_outcome_event_id`, `source_analytics_snapshot_id` — a database `check` constraint enforces exactly one is set per row) instead of the original doc's five nullable FK columns (`source_recommendation_id`, `source_outcome_event_id`, `source_content_approval_id`, `context_snapshot_id`, plus an implied publishing/analytics reference). Every other related record — the recommendation itself, a content approval, a publishing job — is captured as a `marketing_memory_evidence_links` row (`link_type: 'related_source'`) instead of an additional nullable column. This keeps the observations table narrow and strongly typed for its one dominant reference, while evidence_links becomes the actual general-purpose "everything this observation is evidenced by" mechanism the architecture doc's §9 ("evidence and attribution") describes — and gives evidence_links real, populated, tested Phase 1 content rather than shipping an empty table.
3. **`'monthly_focus'` is a reserved, unused value in the `evidence_links.source_type` vocabulary.** The task's source list includes "observation → Monthly Focus," but Monthly Focus (`lib/head-of-marketing/monthlyFocus.ts`) is currently a pure computed-on-demand value with **no persisted row and no id** — there is nothing to reference. The enum value exists for forward compatibility; no Phase 1 ingestion path populates it.

One further, smaller deviation: **"observation → publishing history"** from the task's relationship list is implemented as a reference to `publishing_jobs` (via `recommendation_outcome_events.publishing_job_id`, already available at the ingestion hook), not to a specific `publishing_history` row. `publishing_jobs` is the stable, singular anchor per publishing attempt; `publishing_history` entries are numerous per job and would need additional coupling to resolve "which one" without adding real value in Phase 1.

Everything else (table names, `idempotency_key` strategy, RLS shape, append-only lifecycle, retention-classification vocabulary) matches the original data-model document as written.

---

## 3. Observation Model

`marketing_memory_observations` — append-only, one row per factual event.

- **Tenant/business ownership**: `user_id`, `business_profile_id` (both `not null`, both FK'd with `on delete cascade`, matching every existing table's convention).
- **Observation type**: `observation_type` — a closed, ten-value vocabulary (`MarketingMemoryObservationTypes` in `lib/marketing-memory/types.ts`, mirrored by the migration's `check` constraint): `recommendation_drafted`, `recommendation_edited`, `recommendation_approved`, `recommendation_rejected`, `recommendation_do_more_like_this`, `publishing_queued`, `publishing_succeeded`, `publishing_failed`, `performance_measured`, `analytics_snapshot_captured`.
- **Source system**: `source_system` — `recommendation-outcomes` or `analytics`, diagnostic/filtering only.
- **Source entity**: exactly one of `source_outcome_event_id` / `source_analytics_snapshot_id` (database-enforced).
- **Occurred-at vs. recorded-at**: `occurred_at` is the real-world event time (the outcome event's or snapshot's own `created_at`); the row's own `created_at` is when Marketing Memory recorded it. In Phase 1's synchronous ingestion these are seconds apart; the distinction exists for a future backfill/reconciliation pass.
- **Objective/outcome category**: `outcome_direction` — `positive | negative | neutral | mixed | unknown`, assigned by a fixed, non-inferential rule table (§6), never computed from a baseline comparison.
- **Location/market scope**: `location_scope`, always `null` in Phase 1 — every `business_profiles` row today is single-location; reserved for a future multi-location business.
- **Structured facts**: `metric_summary jsonb`, bounded and sanitized (§9) — never a raw copy of `recommendation_outcome_events.metadata` or `analytics_snapshots`.
- **Schema version**: `schema_version smallint default 1`, for future format evolution without a data migration.
- **Retention classification**: `retention_classification` (§8).
- **Idempotency**: `idempotency_key` (§7).

---

## 4. Context Snapshot Model

`marketing_memory_context_snapshots` — append-only, **one row reused per business per UTC calendar day**, regardless of how many observations occur that day (an idempotent get-or-create, not one snapshot per observation).

- `context_item_ids uuid[]` — references into existing `market_context_items`, **never copied**. Bounded to at most 5 items (`MAX_CONTEXT_ITEMS` in `contextNormalization.ts`), selected from a ±3-day window around the observation's `occurred_at`, ordered by `relevance_score` descending. This keeps the array from growing unboundedly and avoids "copying every available context item into every observation" (the architecture doc's explicit warning).
- `context_summary jsonb` — small, deterministically computed calendar facts only: `dayOfWeek`, `month`, `season` (reusing `lib/recommendation-learning/signals.ts`'s existing, already-tested `seasonFromDate`, rather than re-deriving season logic), and `contextItemCount`. Never a derived pattern or claim.
- `impact_direction` — always `'unknown'` in Phase 1. Classifying whether a weather/event/community signal helped or hurt requires interpretation, which is explicitly Learning-layer work (Phase 2+). The column exists now so Phase 2 can populate it without a schema change.
- `observed_vs_forecast` — always `'observed'` in Phase 1 (the snapshot-linking action itself is observed, independent of whether an underlying `market_context_items` row is itself forecast data).
- `valid_from` / `valid_until` / `expires_at` — the snapshot's validity window and hard retention boundary (§8).

Missing or unavailable context (a provider query error, an empty result set) never blocks the calling observation — `resolveContextSnapshotForObservation` catches every failure internally and returns `null`, leaving `observations.context_snapshot_id` unset rather than failing the observation insert.

---

## 5. Evidence Links

`marketing_memory_evidence_links` — append-only, polymorphic join from an observation to every source record it references.

Central, closed vocabulary (`MarketingMemorySourceEntityTypes`, mirrored by a migration `check` constraint — this is the single place that "prevents arbitrary unvalidated source-type strings from spreading through the codebase," as required): `recommendation`, `recommendation_outcome_event`, `content_approval`, `publishing_job`, `analytics_snapshot`, `market_context_item` (reserved — see below), `monthly_focus` (reserved, §2).

`link_type` is `primary_source` (the one record that directly caused the observation — mirrors the observation's own typed FK) or `related_source` (every other record the observation is evidenced by or connected to).

**What Phase 1 actually populates**, per observation:

- Outcome-event-derived observations: `recommendation_outcome_event` (primary), `recommendation` (related, always — every outcome event has one), `content_approval` (related, when the event carries one), `publishing_job` (related, when the event carries one).
- Analytics-snapshot-derived observations: `analytics_snapshot` (primary) only.

**Why `market_context_item` links are not populated via this table**: that relationship is already fully captured by `context_snapshots.context_item_ids`, and duplicating it as individual evidence-link rows would be exactly the "duplicate storage" pattern the architecture self-review warns against. The enum value stays reserved for a case where a *specific* observation (not the day's whole context snapshot) needs to cite one particular context item directly — no such case exists in Phase 1.

Batch inserts use `.upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true })`, not a plain multi-row insert — a plain insert fails the entire batch if any single row's idempotency key already exists (e.g., a partially-succeeded retry); upserting with `ignoreDuplicates` makes each row's idempotency independent.

---

## 6. Negative and Contradictory Evidence

`outcome_direction` is a purely factual category, assigned by one fixed, exhaustively-tested rule table (`lib/marketing-memory/mapping.ts`, `outcomeDirectionForObservationType`) — never an interpretation of *why* something happened:

| Observation type | `outcome_direction` |
|---|---|
| `recommendation_drafted` | `neutral` |
| `recommendation_edited` | `neutral` |
| `recommendation_approved` | `positive` |
| `recommendation_rejected` | `negative` |
| `recommendation_do_more_like_this` | `positive` |
| `publishing_queued` | `neutral` |
| `publishing_succeeded` | `positive` |
| `publishing_failed` | `negative` |
| `performance_measured` | `unknown` |
| `analytics_snapshot_captured` | `neutral` |

`performance_measured` is deliberately always `unknown`, not derived from the raw metric values: judging whether a view count or click-through rate is "good" requires a baseline comparison, and computing that comparison is explicitly Learning-layer work, out of scope for this PR. Recording it as `unknown` rather than guessing is itself the mechanism that keeps negative/contradictory evidence first-class — a `publishing_failed` observation is stored with the same rigor and the same schema as a `publishing_succeeded` one, and a future Learning layer reading `outcome_direction` will see rejections, failures, and measured-but-uninterpreted performance sitting in the same table as approvals and successes, not filtered out or down-weighted at write time. `mixed` is a valid schema value for a future source that can express it; no Phase 1 mapping produces it.

---

## 7. Idempotency Strategy

Every ingestion path is safely repeatable, enforced at the database layer (not an application-level existence check — the codebase's established convention, per `recommendation_outcome_events`' own doc comment: "the database's unique constraint is the sole source of truth for 'has this happened before'"):

| Table | Key shape | Enforcement |
|---|---|---|
| `marketing_memory_observations` | `obs:<business_profile_id>:<source_type>:<source_id>` | `unique` constraint; a `23505` violation is treated as `duplicate: true`, never an error |
| `marketing_memory_context_snapshots` | `ctx:<business_profile_id>:<utc-date>` | `unique` constraint; on `23505`, the ingestion code selects and reuses the existing row (get-or-create) |
| `marketing_memory_evidence_links` | `<observation_id>:<source_type>:<source_id>` | `unique` constraint; batch `upsert(..., { ignoreDuplicates: true })` so one already-existing row never fails its siblings |

`unit-tests/marketing-memory-persistence.test.ts` includes an explicit repeated-insertion test (`insertMarketingMemoryObservation: repeated ingestion of the same source event produces exactly one stored observation`) that models a fake table honoring a real unique constraint across three sequential calls with the same idempotency key, and the live migration verification (§12) confirmed the real `23505` behavior against the actual database.

---

## 8. Retention Implementation

Every append-only table carries a retention signal, addressing the architecture self-review's explicit "unbounded storage growth" finding (`MARKETING_MEMORY_ARCHITECTURE.md` §24).

- **Observations**: `retention_classification` — deterministically assigned by `retentionClassificationForObservationType` (`lib/marketing-memory/mapping.ts`): every recommendation-outcome-derived type gets `long_term_audit_evidence` (inheriting `recommendation_outcome_events`' own "durable source of truth" treatment); `analytics_snapshot_captured` gets `standard_operational_evidence`. No expiry mechanism exists for observations in Phase 1 — long-term audit evidence is not supposed to expire, and this matches "historical audit evidence should not be silently destroyed."
- **Context snapshots**: `retention_classification` is always `short_lived_context` (context decays fastest, per the architecture doc), and — unlike observations — carries a **hard `expires_at` boundary**, defaulted to `captured_at + 180 days` (`CONTEXT_SNAPSHOT_RETENTION_DAYS` in `contextNormalization.ts`).
- **Distinguishing expired from active**: `getExpiredContextSnapshotCandidatesForUser` (`lib/marketing-memory/persistence.ts`) is a **read-only diagnostic query** (`select ... where expires_at < now()`) that lists expired candidates without deleting or archiving anything. It is not called from any scheduled job, Trigger.dev task, or API route in this PR — it exists so a future cleanup pass has a place to start, satisfying "the design must support later cleanup or archival without breaking evidence chains" without implementing or activating any destructive operation now, per the explicit constraint: *"Do not activate a cleanup schedule in this PR... A cleanup service or dry-run utility may be implemented only if the architecture calls for it and it remains manually invoked and well tested."*
- **Evidence links** intentionally carry no independent retention classification — every row is `on delete cascade` from its owning observation, so its lifecycle is always exactly its parent observation's lifecycle; a separate retention field would be redundant.

`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false` and is untouched by this PR.

---

## 9. Metadata Safety

`lib/marketing-memory/metadata.ts` is the single enforcement point every ingestion path routes through before persisting anything into `metric_summary`:

- `sanitizeMetricSummary(input)` keeps only primitive values (finite numbers, booleans, strings, null) — nested objects, arrays, and functions are silently dropped, never stored. This is what makes "no raw provider payload dumps" structural rather than a style guideline: `recordObservationForOutcomeEvent` sanitizes `event.metadata` (which could in principle contain anything a recorder function attached) before it ever reaches an insert.
- Bounded to 12 keys, 500 characters per string value, and a 2000-character total JSON size — if the sanitized result still exceeds that bound, the function fails safe and returns `{}` rather than truncating mid-structure.
- `classifyError(error)` — every `catch` block in `lib/marketing-memory/` logs only the error's constructor name (e.g. `"TypeError"`), never `error.message` or `error.stack`, which could contain fragments of a provider response or other sensitive detail.
- No code path in `lib/marketing-memory/` ever reads an OAuth token, a raw HTTP response body, or free-text customer content into `metric_summary`. The two ingestion sources only ever pass: outcome-event `metadata` (already a small structured object by the outcome-recorders' own convention) and four explicit, named analytics numbers (`googleViews`, `calls`, `websiteClicks`, `engagementScore`) — never the full `analytics_snapshots.metadata` object, which contains a `monthlyTrends` array.
- Tested explicitly in `unit-tests/marketing-memory-core.test.ts`, including a dedicated case asserting a synthetic "provider payload" object (nested headers, auth tokens, response bodies) sanitizes to `{}`.

---

## 10. RLS and Tenant Isolation

Every table (`marketing_memory_observations`, `marketing_memory_context_snapshots`, `marketing_memory_evidence_links`) carries `user_id` + `business_profile_id`, both `not null`, both FK'd `on delete cascade`, with `select`/`insert`-only RLS policies (`auth.uid() = user_id`) — **no `update`/`delete` policy for any authenticated role**, matching `recommendation_outcome_events`' exact append-only precedent. Live-verified against the real database (§12):

- An authenticated `anon`-role `select` returns an empty array (RLS-filtered, not an error).
- An `anon`-role `insert` is rejected with Postgres error `42501` ("new row violates row-level security policy").

Server-side privileged workflows (Trigger.dev tasks, background jobs) already use `createServiceRoleClient()` (`lib/supabase/service.ts`), which bypasses RLS entirely — this is unchanged; the two new ingestion hooks simply reuse whichever `SupabaseClient` was already passed into `insertRecommendationOutcomeEvent`/`captureSnapshotForUser`, so a background-job-triggered analytics capture writes its observation with the same service-role client, and a user-triggered approval writes its observation with the same cookie-scoped client — no new client construction anywhere in `lib/marketing-memory/`.

---

## 11. Failure Behavior

Ingestion is best-effort and layered with defense in depth, never allowed to break the operation it observes:

1. Each `lib/marketing-memory/service.ts` entry point (`recordObservationForOutcomeEvent`, `recordObservationForAnalyticsSnapshot`) wraps its entire body in a `try/catch` and always returns a `{ recorded, duplicate, observationId }` result — it never throws.
2. Both of the two call sites (`lib/recommendation-outcomes/persistence.ts`, `lib/analytics/analyticsEngine.ts`) wrap the call in a **second, outer** `try/catch` as deliberate defense in depth, so even a hypothetical regression that made the inner function throw could not surface as a failure of the outcome-event write or the analytics capture.
3. Context resolution (`resolveContextSnapshotForObservation`) has its own internal `try/catch` and returns `null` on any failure — a missing weather provider, an unreachable `market_context_items` query, or a snapshot-insert error never blocks the observation that would have referenced it.
4. Evidence-link recording happens *after* the observation is already durably inserted, in its own `try/catch` (`recordEvidenceLinksSafely`) — a failure to record evidence links never un-records the observation itself, and never blocks the caller.
5. Every failure is logged via `console.error("[MarketingMemory]", {...})` with a safe, structured payload (business id, observation type, source type/id, a `classifyError`-derived error class) — never silently swallowed, always observable.

Verified directly: `unit-tests/marketing-memory-ingestion.test.ts` includes integration tests asserting `insertRecommendationOutcomeEvent` and `captureSnapshotForUser` **return their original, unchanged result** even when every `marketing_memory_*` table fixture is configured to error (Postgres error `42P01`, "relation does not exist" — a worst-case "the tables aren't there" scenario).

---

## 12. Migration Verification

No local Docker/Postgres was available in this session, so verification ran directly against the linked remote Supabase project ("AJN marketing," `dqcsptbgladjfdbybeda`) — the same project `.env.local` points at for this repository's own dev/test use. This also meant three previously-unapplied migrations from prior PRs (`021_recommendation_outcome_events.sql`, `022_do_more_like_this_event_type.sql`, `023_assisted_pilot_framework.sql`) were pushed alongside `024_marketing_memory_foundation.sql`, bringing the remote fully in sync with the migrations already on `main`. `supabase migration list` confirms local and remote now match exactly through `024`.

**`supabase db push`** applied all four migrations cleanly, no errors.

**Live verification, via direct PostgREST calls** (`curl` against `$NEXT_PUBLIC_SUPABASE_URL/rest/v1/...`, since `supabase db dump`/`db start` both require Docker, unavailable in this environment):

| Check | Result |
|---|---|
| All three tables reachable | `HTTP 200` on a `select id limit 0` against each of the three tables with the service-role key |
| Valid insert (context snapshot) | `HTTP 201`, defaults (`impact_direction: unknown`, `observed_vs_forecast: observed`, `retention_classification: short_lived_context`) all correct |
| Duplicate `idempotency_key` rejected | `HTTP 409`, Postgres `23505` |
| Foreign key enforced (bogus `business_profile_id`) | `HTTP 409`, Postgres `23503` |
| `observations` "exactly one primary source" check | `HTTP 400`, Postgres `23514`, isolated from the `observation_type` check with a separate request |
| `observations.observation_type` check constraint | `HTTP 400`, Postgres `23514` (`marketing_memory_observations_observation_type_check`) |
| `evidence_links.source_type` check constraint | `HTTP 400`, Postgres `23514` (`marketing_memory_evidence_links_source_type_check`) |
| RLS blocks unauthenticated `select` | `HTTP 200`, empty array (filtered, not an error) |
| RLS blocks unauthenticated `insert` | `HTTP 401`, Postgres `42501` |

All test rows created during verification (two `marketing_memory_context_snapshots` rows) were deleted via the service-role client immediately after; a follow-up `select ... where idempotency_key like 'verify-test%'` confirmed zero rows remain. **No existing migration file (001–023) was modified** — confirmed via `git status`/`git diff` against `main` showing only `024_marketing_memory_foundation.sql` as new.

---

## 13. Performance

**Expected Phase 1 volume**: one observation per recommendation-outcome-event (already a low-frequency table — draft/approve/reject/publish/measure transitions, not a high-QPS stream) plus one observation per daily analytics capture per business. Context snapshots are capped at one row per business per UTC day regardless of observation volume.

**Indexes** (all in `024_marketing_memory_foundation.sql`):

- `marketing_memory_observations (business_profile_id, occurred_at desc)` — the primary read path a future Learning-derivation pass will use.
- `marketing_memory_observations (observation_type)`, plus **partial** indexes on `source_outcome_event_id`/`source_analytics_snapshot_id` `where not null` — cheap because at most one of the two is ever populated per row.
- `marketing_memory_context_snapshots (business_profile_id, captured_at desc)`, a GIN index on `context_item_ids`, and an index on `expires_at` (backs the retention diagnostic query in §8).
- `marketing_memory_evidence_links (observation_id)` and `(source_type, source_id)` — backs both "all evidence for this observation" and "everywhere this recommendation/approval/job is referenced."

**No partitioning** is implemented or proposed in this PR — premature at Phase 1's expected volume. **Revisit threshold**: if any tenant's `marketing_memory_observations` row count exceeds roughly the same order of magnitude that would already prompt a look at `recommendation_outcome_events` (that table has no partitioning either, and is the closest existing volume analog), or once Phase 2's Learning-derivation job starts doing full-table scans per business rather than bounded, indexed range queries. The §8 retention diagnostic is the intended first lever, not partitioning.

---

## 14. Testing

38 new tests across three files, all passing alongside the full existing 649-test suite (687 total, zero regressions):

- **`unit-tests/marketing-memory-core.test.ts`** — pure functions: the full `RecommendationOutcomeEventType -> observation_type` mapping table (exhaustive over all nine real event types), the `outcome_direction` rule table (§6), the retention-classification rule, idempotency-key determinism, and `sanitizeMetricSummary`/`classifyError` (nested-object rejection, string truncation, key-count cap, non-object input, `Infinity`/`NaN` rejection, safe error classification).
- **`unit-tests/marketing-memory-persistence.test.ts`** — `insertMarketingMemoryObservation` (happy path, `23505` duplicate, genuine error, three-call repeated-ingestion determinism), `insertMarketingMemoryEvidenceLinks` (upsert shape, only-supported-source-types assertion, empty-batch no-op), tenant-isolation contract tests (`userIdsQueried` against every read function, matching this codebase's established RLS-contract-test pattern — see `unit-tests/analytics-capture-injectable-client.test.ts`), and `resolveContextSnapshotForObservation` (create, get-or-create-on-conflict, missing-context-never-throws, bounded item count).
- **`unit-tests/marketing-memory-ingestion.test.ts`** — full `recordObservationForOutcomeEvent`/`recordObservationForAnalyticsSnapshot` orchestration (evidence-link contents per event shape, duplicate short-circuit before evidence-link writes, unexpected-failure non-throwing, missing-context resilience, bounded analytics metric summary), plus **integration tests against the two real production hook points** — `insertRecommendationOutcomeEvent` and `captureSnapshotForUser` — proving both functions' original return values are byte-for-byte unchanged whether Marketing Memory ingestion succeeds or fails outright.

---

## 15. Self-Review

Performed against the full checklist before this PR was finalized, each finding verified directly against code/live database rather than asserted:

| Check | Finding |
|---|---|
| Factual observations becoming inferred learnings | Not present. `outcome_direction` comes from one fixed, exhaustively-tested rule table (§6); `performance_measured` is always `unknown` — no baseline comparison is ever computed. No confidence field exists anywhere in this schema. |
| Duplicate source data | Not present. `metric_summary` is bounded/sanitized (§9); `context_item_ids` and every evidence-link `source_id` are references, never copies. |
| Provider-specific payload storage | Not present. `sanitizeMetricSummary` strips nested objects/arrays before anything reaches `metric_summary`; verified with a synthetic "provider payload" test case sanitizing to `{}` (`unit-tests/marketing-memory-core.test.ts`). |
| Missing idempotency | Not present. All three tables have a unique `idempotency_key`; live-verified `23505` rejection on the real database (§12). |
| Weak RLS | Not present. Live-verified: anon `select` returns `[]`, anon `insert` returns `42501` (§12). |
| Cross-tenant evidence access | Not present. Every read function filters by `userId`, contract-tested via `userIdsQueried` (`unit-tests/marketing-memory-persistence.test.ts`); RLS enforces isolation independently at the database layer. |
| Unbounded metadata | Not present. `sanitizeMetricSummary` caps key count (12), string length (500 chars), and total size (2000 chars). |
| Unbounded append-only retention | Mitigated, not fully solved. Context snapshots have a hard `expires_at` and a read-only diagnostic query for expired candidates (§8). Observations (`long_term_audit_evidence`) have no expiry by design — audit evidence isn't supposed to silently expire — but no archival/compaction mechanism exists yet for either table; recorded as a known limitation (§14), not hidden. |
| Memory failures breaking critical workflows | Not present. Two-layer `try/catch` (inner in `service.ts`, outer at each call site); integration tests prove `insertRecommendationOutcomeEvent` and `captureSnapshotForUser` return unchanged results even when every `marketing_memory_*` table errors with `42P01` ("relation does not exist"). |
| Hidden recommendation behavior changes | Not present. Zero files under `lib/marketing-director/`, `lib/recommendation-learning/`, or `lib/marketing-decisions/` were touched (`git diff --stat main` confirms); the full pre-existing 649-test suite passes unchanged alongside the 38 new tests. |
| Server-only modules entering client bundles | Not present. Every file in `lib/marketing-memory/` starts with `import "server-only";` (verified directly, all seven files). |
| Raw sensitive error storage | Not present. `classifyError` logs only `error.name`; grepped `lib/marketing-memory/` for `.message`/`.stack` usage — zero matches. |
| Excessive Phase 1 scope | Not present. Only three tables exist; no Learning, Preference, Override, or DecisionLink code, type, or column exists anywhere in this PR (grepped for the relevant identifiers — zero matches outside comments explicitly describing what is *not* built yet). |
| Tables or abstractions not required yet | Not present. The three diagnostic retrieval functions (`getMarketingMemoryObservationsForBusiness`, `getMarketingMemoryEvidenceLinksForObservation`, `getExpiredContextSnapshotCandidatesForUser`) are the ones the task explicitly asked for ("retrieval for diagnostics or tests," the retention exit criterion) — no additional abstraction layer was added beyond them. |

**Every call to the Marketing Memory service was located and checked**: `recordObservationForOutcomeEvent` (called once, from `lib/recommendation-outcomes/persistence.ts`) and `recordObservationForAnalyticsSnapshot` (called once, from `lib/analytics/analyticsEngine.ts`) are each server-side only (both files start with `import "server-only"`), tenant-scoped (both receive a real `userId`/`businessProfileId` from their caller's own already-validated context, never accept one from an unauthenticated source), idempotent (§7), non-blocking (§11), and tested (§14, including integration tests at both exact call sites).

---

## 16. Known Limitations

- **No cleanup/archival job.** `getExpiredContextSnapshotCandidatesForUser` is a read-only diagnostic; nothing actually archives or deletes an expired context snapshot yet. This is intentional for Phase 1 (§8) but is real, tracked follow-up work.
- **`occurred_at` for outcome-event-derived observations is the outcome event's own `created_at`**, not a more precise "when did the underlying action truly happen" timestamp — acceptable given `recommendation_outcome_events` doesn't track a separate "occurred" time either.
- **`location_scope` is always null** — no multi-location business exists in the schema yet to exercise it.
- **Context relevance window (±3 days, top 5 by `relevance_score`) is a fixed heuristic**, not configurable per business or per observation type. Reasonable as a Phase 1 default; may need tuning once Phase 2 starts deriving Learnings from this data.
- **No backfill.** Observations only start accumulating from the moment this PR deploys forward — no historical `recommendation_outcome_events`/`analytics_snapshots` rows are retroactively converted into observations. A backfill script is plausible future work but out of scope here.
- **`captureSnapshotForUser`'s added latency**: the memory-recording hook is awaited (not fire-and-forget), so both hook points add a small amount of latency to their caller (roughly one or two extra round-trip inserts). Acceptable at Phase 1 volume; worth revisiting if either hook point becomes a hot path.

---

## 17. Next Phase

**Phase 2 — Learnings and confidence is now implemented** — see [`MARKETING_MEMORY_LEARNINGS.md`](./MARKETING_MEMORY_LEARNINGS.md). It shipped exactly as anticipated here: `marketing_memory_learnings` plus a nullable `learning_id` column on `marketing_memory_evidence_links` (alongside `observation_id`, not a replacement — every Phase 1 row remains valid, live-verified). Per the phased plan in `MARKETING_MEMORY_ARCHITECTURE.md` §20, the next phase is now **Phase 3 — Customer preferences and overrides**. No customer-visible change was introduced in Phase 2 — Learnings exist but nothing consumes them until Phase 4.
