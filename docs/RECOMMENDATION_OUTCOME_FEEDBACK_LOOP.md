# Recommendation Outcome Feedback Loop

- **Status:** Implemented
- **Date:** 2026-07-13
- **Scope:** Closes the gap between "a recommendation created a draft" and "the system
  durably knows what happened to that draft" —
  `content_approvals` mutation -> `publishing_jobs` lifecycle -> `content_performance` ->
  a normalized, per-recommendation outcome summary. No autonomous scoring or ML behavior
  is introduced. No production schedules were activated by this work.

---

## 1. The missing feedback-loop problem

PR #26 (Recommendation Execution Engine) made it possible for a recommendation to
produce a `content_approvals` draft. After that, the draft's fate — approved, edited,
rejected, published, how it performed — was only ever visible by manually cross-
referencing several tables (`content_approvals`, `publishing_queue`, `publishing_jobs`,
`content_performance`) with no durable, deduplicated link back to the recommendation that
started it, and no single place to ask "was this recommendation actually useful?" This
milestone adds that durable record and a canonical summary function, without touching
recommendation scoring itself.

## 2. Investigation findings (before any code was written)

- **`content_approvals` statuses**: `pending | approved | rejected | published`.
  `"published"` is defined in the type but **never actually set** anywhere in the
  codebase — publishing status lives entirely on `publishing_queue.status` and
  `publishing_jobs.status` instead. This is a pre-existing vocabulary inconsistency,
  documented here rather than "fixed" (renaming/removing an enum value is out of scope
  and risks breaking the `ACTIVE_RECOMMENDATION_DRAFT_STATUSES` check that already
  includes it defensively).
- **Approval/rejection persistence**: `lib/content-approval/service.ts`'s
  `patchContentApprovalForUser` is the single authoritative mutation path (also the only
  path the API route calls) for approve, reject, edit ("update"), and regenerate. Reject
  previously stored only free-text `rejected_reason` (default `"Rejected by reviewer"`)
  with **no structured reason at all** — the UI used a bare `window.prompt()`.
- **Edits overwrite, they don't version.** The "update" action calls
  `updateContentApproval` directly over the existing row; there is no version history to
  diff against after the fact. `version` only increments via the separate "regenerate"
  action, which creates a **new** row that does **not** carry over
  `marketing_recommendation_id` — a second pre-existing gap, documented in §12.
- **Draft -> publishing linkage**: `content_approvals.id` ->
  `publishing_queue.content_approval_id` -> `publishing_jobs.content_id` (equals
  `publishing_queue.id`) -> `content_performance.publishing_job_id`. Four hops, no single
  FK straight from a publishing artifact back to a recommendation.
- **Existing generic event table**: `public.audit_logs` already exists
  (`lib/audit-log/*`) and is used everywhere. It is **not** suitable as this milestone's
  source of truth: it has no uniqueness constraint (duplicate log rows on retry are
  normal and expected there), and it links to entities via untyped `entity_type`/
  `entity_id` string pairs rather than real foreign keys to
  `marketing_recommendations`/`content_approvals`/`publishing_jobs`. Reusing it would mean
  building deduplication and typed joins on top of a table explicitly designed not to
  guarantee either. A new, purpose-built, uniquely-keyed table
  (`recommendation_outcome_events`) is the source of truth for outcome state;
  `audit_logs` continues to serve its existing, separate operational-diagnostics role
  untouched.
- **Performance attribution is already an estimate.** `syncContentPerformanceRecords`
  (`lib/analytics/analyticsEngine.ts`) allocates a business's *aggregate* Google Business
  Profile views/clicks evenly across its last 12 published posts
  (`metadata.estimation: "aggregate_allocation"`) — there is no true per-post analytics
  API in use today. This milestone's `performance_measured` event is only ever as
  precise as that existing estimate; it does not manufacture new precision (see §8).
- **Publishing retries**: `executePublishingJobById` distinguishes `retrying` (retries
  remain) from a terminal `failed` (retries exhausted) via `shouldRetryPublishing`. Only
  the terminal state is a real "this attempt is over" signal.

## 3. Architecture

```
marketing_recommendations
        |
        v  (content_execution stage / manual "Generate Draft")
content_approvals  --------------------------+
   |  approve / reject / edit                |
   v                                          |  every transition below calls
publishing_queue -> publishing_jobs           |  the SAME idempotent recorder
   |  queued -> publishing -> verified/failed |  functions in
   v                                          |  lib/recommendation-outcomes/service.ts
content_performance  -------------------------+
        |
        v
recommendation_outcome_events  (append-only, uniquely-keyed source of truth)
        |
        v
summarizeRecommendationOutcomeForUser()  -->  RecommendationOutcomeSummary
        |
        v
getRecommendationOutcomeStatsForUser()  -->  aggregate stats (decision-engine facing)
```

`recommendation_outcome_events` is an **immutable event log**; the "current" outcome is
never stored as mutable state on that table. `summarizeRecommendationOutcomeForUser`
deterministically re-derives the summary on every read from the *actual* authoritative
tables (`content_approvals`, `publishing_jobs`, `content_performance`) plus the event
log (used only for things the authoritative tables don't carry: edit count, rejection-
event timing, publishing failure category). The event log is not a second copy of
status — it is the only place some of this information exists at all.

Recording is a **fire-and-forget-safe idempotent follow-up**, not part of the same
database transaction as the authoritative mutation (`updateContentApproval`,
`updatePublishingJobRecord`, `upsertContentPerformanceRecord`). This is a deliberate,
documented choice: an outcome-recording hiccup must never corrupt or roll back a real
approval, rejection, or publish. §7 (Reconciliation) exists specifically to repair
anything a follow-up call like this misses (e.g. a crash between the authoritative write
and the outcome-event call).

## 4. Schema changes

New migration: `supabase/migrations/021_recommendation_outcome_events.sql`.

**`recommendation_outcome_events`** (new table):

| Column | Notes |
|---|---|
| `recommendation_id` | `references marketing_recommendations(id) on delete cascade` |
| `content_approval_id` | nullable, `on delete set null` |
| `publishing_job_id` | nullable, `on delete set null` |
| `event_type` | check-constrained to the 8 types below |
| `idempotency_key` | **unique** — the sole idempotency mechanism |
| `metadata` | jsonb, structured fields only (never raw content/secrets) |

Indexes on `recommendation_id`, `content_approval_id`, `publishing_job_id`,
`business_profile_id`, `user_id`, `event_type`, `created_at desc`, and a composite
`(recommendation_id, created_at)` for "all events for recommendation X, in order."

RLS: enabled, `select`/`insert` policies scoped to `auth.uid() = user_id` (matching
every other table in this schema) — **no `update` or `delete` policy exists for any
role**, making the table append-only by policy, not just by convention. Service-role
writes (Trigger.dev, the admin reconciliation route) bypass RLS entirely, as with every
other privileged table here.

**`content_approvals.rejection_reason_code`** (new column, smallest compatible
extension): nullable text, check-constrained to the 7 structured reasons below.
`rejected_reason` (free text) is unchanged and still stored alongside it.

**No changes to `marketing_recommendations`.** Denormalized summary columns
(`outcome_status`, `outcome_score`, etc.) were considered and deliberately **not**
added: the read path (`summarizeRecommendationOutcomeForUser`) is a handful of indexed,
tenant-scoped point lookups per recommendation, not a table scan, and the decision engine
does not yet consume this data at a volume that would justify the added complexity of
keeping a denormalized copy in sync. Revisit if/when §11's integration point is built.

## 5. Lifecycle events captured

| `event_type` | Recorded when | Idempotency key |
|---|---|---|
| `draft_created` | A draft exists for a recommendation (executed or reused) | `<content_approval_id>:draft_created` |
| `draft_edited` | A meaningful edit is saved (title/content/channel actually changed) | `<content_approval_id>:draft_edited:<content_hash>` |
| `draft_approved` | Approve mutation succeeds | `<content_approval_id>:draft_approved` |
| `draft_rejected` | Reject mutation succeeds | `<content_approval_id>:draft_rejected` |
| `publishing_queued` | A `publishing_jobs` row is durably created | `<publishing_job_id>:publishing_queued` |
| `publishing_succeeded` | Job reaches `published`/`verified` | `<publishing_job_id>:publishing_succeeded` |
| `publishing_failed` | Job reaches **terminal** `failed` (no retries left) | `<publishing_job_id>:publishing_failed` |
| `performance_measured` | Analytics capture syncs a `content_performance` row | `<content_approval_id>:performance_measured:<window_key>` |

`publishing_started` (listed as a "possible" type in the milestone brief) was
deliberately **not** implemented: it adds no signal beyond `publishing_queued` for
outcome purposes, and nothing in this milestone's required lifecycle/test coverage
depends on it.

Every recorder lives in `lib/recommendation-outcomes/service.ts` and is called from the
existing authoritative mutation path, never from a UI render or page load:

- `lib/recommendation-execution/engine.ts` — `draft_created`, called on **both** the
  `executed` and `already_executed` branches (safe: idempotency key is the content
  approval id, so calling it twice is a no-op, and this guarantees the association is
  recorded even if the very first execution's own follow-up call was somehow missed).
- `lib/content-approval/service.ts` (`patchContentApprovalForUser`) — `draft_edited`
  (before the overwrite, diffing `existing` against the incoming title/content),
  `draft_approved`, `draft_rejected`. All three are skipped entirely when
  `marketing_recommendation_id` is null (hand-authored content never gets recommendation
  outcome events).
- `lib/publishing/publishingEngine.ts` — `publishing_queued` in
  `createJobFromQueueItem`; `publishing_succeeded`/`publishing_failed` in
  `executePublishingJobById` (both the success path and the **only-when-`!canRetry`**
  failure path) and in `verifyPublishedContentForUser` (manual re-verification, which
  has no retry concept, so any failure there is final).
- `lib/analytics/analyticsEngine.ts` (`syncContentPerformanceRecords`) —
  `performance_measured`, once per synced `content_performance` record per day
  (`measurementWindowKey()` = the ISO date, matching `analytics_snapshots`' own
  per-day grain).

## 6. Idempotency strategy

A single mechanism used everywhere: a **unique database constraint on
`idempotency_key`**, computed deterministically server-side
(`lib/recommendation-outcomes/idempotency.ts::buildOutcomeIdempotencyKey`), never
client-supplied. `insertRecommendationOutcomeEvent` treats a `23505` unique-violation as
the expected, normal "this already happened" case (`{ duplicate: true }`), not an error —
callers never pre-check-then-insert (which would itself race), the database is the sole
arbiter.

- **Singular-per-draft events** (`draft_created`, `draft_approved`, `draft_rejected`) key
  on `content_approval_id` alone — at most one of each can ever exist per draft.
- **Repeatable events** (`draft_edited`, `performance_measured`) additionally key on a
  discriminator (a content hash, or the measurement window) so *distinct* occurrences
  over time are each recorded once, while an *identical* resubmission (a double-click, a
  same-day re-sync) is a no-op.
- **Publishing events** key on `publishing_job_id` — a job reaches each terminal state
  (`publishing_succeeded`/`publishing_failed`) at most once; a genuinely new attempt gets
  a genuinely new job.

**Outcome recording is an idempotent follow-up, not part of the authoritative
transaction.** Every recorder call is `await`ed but its result is never allowed to change
the authoritative function's own return value or throw past itself — a failure to write
`recommendation_outcome_events` never blocks or reverts an approval, rejection, or
publish. §7 exists to repair anything this ever misses.

## 7. Reconciliation

`lib/recommendation-outcomes/reconciliation.ts::reconcileRecommendationOutcomesForUser`
walks every recommendation for one tenant/business, re-derives which events *should*
exist from the authoritative tables, and calls the exact same recorder functions the
live integration points use — so "already exists" and "insert it" are governed by the
identical idempotency logic, not a second parallel implementation.

- Tenant-scoped (`userId` + `businessProfileId` parameters, never a bare sweep).
- Safely repeatable: a second run against unchanged state inserts nothing (every insert
  is idempotent by construction).
- Returns structured counts (`recommendationsScanned`, `eventsInserted`,
  `eventsSkippedExisting`, `byEventType`) — never fires-and-forgets silently.
- **Cannot backfill `draft_edited` retroactively.** An edit overwrites the row in place
  (§2) — once that's happened, there is no durable "before" state left to diff against.
  Edit history can only be captured going forward from the live integration point; this
  is a real, permanent limitation, not an oversight.
- Reachable only via `POST /api/admin/trigger-recommendation-outcome-reconciliation`
  (admin-allowlist-gated, mirroring the existing
  `trigger-recommendation-execution`/`trigger-recommendation-pipeline` admin routes) or a
  manual Trigger.dev task invocation. **Never scheduled in production.**

## 8. Canonical outcome summary

`lib/recommendation-outcomes/service.ts::summarizeRecommendationOutcomeForUser(userId,
recommendationId, supabaseClient?)` — server-only, tenant-scoped, injectable-client
convention matching every other `*ForUser` function in this codebase.

**Lifecycle states** (`RecommendationLifecycleStatuses`), derived deterministically,
most-specific-first:

`recommended` (no draft yet) -> `awaiting_review` (draft pending) -> `approved` ->
`publishing_queued` -> `publishing` -> `published` (or `publish_failed`) -> `measured`
(published + a `content_performance` row exists). `rejected` short-circuits from any
point once the approval's status is `rejected`.

`draft_created` is deliberately **not** used as a resting summary state, even though it
is captured as an event: `content_approvals.status` is `"pending"` immediately after
creation and stays `"pending"` for as long as it sits unreviewed — both cases summarize
identically as `awaiting_review`, since there is no separate DB status distinguishing
"just created" from "created three days ago, still waiting."

**Usefulness signal** (`UsefulnessSignals`), deterministic, no ML:

| Lifecycle status | Signal | Why |
|---|---|---|
| `rejected` | `negative` | A human explicitly said no |
| `publish_failed` | `neutral` | A provider/delivery problem is never held against the recommendation itself |
| `published` / `measured` | `positive` | The content made it live |
| `approved`, `publishing_queued`, `publishing` | `neutral` | In progress, no verdict yet |
| `awaiting_review`, `recommended` | `unknown` | Nothing to judge yet |

`measured` performance data does not currently push the signal beyond `positive` (no
separate "strongly positive" value exists) — a materially good performance score is
expressed by the mere presence of `performanceMetrics` alongside a `positive` signal, not
a distinct enum value. Given §2's aggregate-allocation estimate, treating performance
*magnitude* as a scoring input this early would risk over-trusting a number that isn't
truly per-post yet; this is intentionally conservative and documented as a candidate
refinement for §11.

## 9. Rejection reason vocabulary

`too_promotional | wrong_tone | incorrect_information | off_brand_topic | poor_timing |
duplicate_content | other` (`RejectionReasonCodes`). An unrecognized or missing code
always normalizes to `"other"` server-side (`isRejectionReasonCode` +
`recordRejectionOutcome`'s fallback) — never trusted verbatim from the client, never
silently dropped. The free-text `rejected_reason`/comment field is preserved unchanged
alongside the structured code; outcome-event metadata stores only `hasComment: boolean`,
never the comment text itself.

## 10. Publishing failure treatment

`categorizePublishingFailure` buckets an **already-sanitized** failure message (every
publishing failure in this codebase passes through `toSafeUserErrorMessage` before this
point — no raw provider payload or OAuth token ever reaches this function) into
`oauth_error | timeout | not_supported | provider_rejected | provider_error`. A
`publishing_failed` event — and therefore the `publish_failed` lifecycle state — is only
ever recorded once retries are **exhausted** (`!canRetry`); an in-flight `retrying`
transition never counts as a final outcome. Regardless of category, `publish_failed`
always maps to `neutral`, never `negative` — a delivery/provider problem is not evidence
the recommendation itself was bad.

## 11. Analytics attribution behavior

`performance_measured` is only ever emitted for a `content_performance` record that was
just synced by `syncContentPerformanceRecords`, keyed to a recommendation via
`content_approvals.marketing_recommendation_id`. Because the underlying metrics
themselves are an even allocation of aggregate account-level views/clicks across recent
posts (§2), this event faithfully **inherits** that estimate's precision — it does not
add or imply new precision. `performanceStatus` in the summary is `"measured"` once a
record exists, `"unavailable"` for published content with no record yet (nothing was
manufactured), and `"not_applicable"` before publishing. No performance event is emitted
for content that hasn't published — that's not "measured but empty," it's simply not
reachable yet, which the lifecycle status already conveys honestly.

## 12. Security and tenancy

- Every read/write path takes `(userId, ..., supabaseClient?)` and defers to that
  client's own scoping; nothing infers a tenant from a client-supplied field it didn't
  independently verify. `resolveRecommendationLinkForContentApproval` and
  `resolveRecommendationLinkForPublishingJob` explicitly re-check `user_id` ownership at
  every hop of the join (content approval -> recommendation; job -> queue item ->
  approval -> recommendation) rather than trusting a foreign key alone.
  `recommendation_outcome_events` never accepts a client-supplied `event_type` or
  `recommendation_id` pairing — every write originates from server-side recorder
  functions embedded in already-authenticated, already-tenant-scoped mutation paths.
- RLS mirrors this schema's existing model exactly (`auth.uid() = user_id`), with no
  `update`/`delete` policy at all (§4). No new API route exposes raw event insertion to
  the browser; the only new route
  (`app/api/admin/trigger-recommendation-outcome-reconciliation`) is admin-allowlist-
  gated and takes a service-role-verified `(userId, businessProfileId)` ownership check
  before ever calling reconciliation, mirroring the existing admin-trigger routes.
- `patchContentApprovalForUser` was extended with an optional injectable Supabase client
  parameter (previously hardcoded to the cookie-bound client) — purely to make its new
  outcome-event wiring unit-testable, following the exact same optional-client
  convention already used by `executeRecommendationForUser`,
  `generateContentDraftForRecommendation`, and `captureSnapshotForUser`. The existing API
  route caller is unaffected (no client passed, same cookie-bound behavior as before).

## 13. Trigger.dev / production schedules

**No new Trigger.dev task was added.** All outcome recording happens inline inside
functions Trigger.dev already calls (`executePublishingJobById` via the publishing-due
task, `captureSnapshotForUser` via the analytics-capture task, the recommendation
pipeline's existing `content_execution` stage). `ATTACH_DECLARATIVE_PRODUCTION_CRONS`
remains `false` and was not touched; the reconciliation function is reachable only via
the admin route above, never a schedule.

## 14. Manual verification

1. Ensure an eligible recommendation exists (or run the recommendation pipeline).
2. Execute it (`POST /api/admin/trigger-recommendation-execution` or "Generate Draft") —
   confirm exactly one `draft_created` row in `recommendation_outcome_events` for that
   recommendation.
3. Edit the draft in the Approval Center — confirm one `draft_edited` row with structured
   metadata (`fieldsChanged`, `titleChanged`, etc.), no raw content.
4. Save again with no changes — confirm no new `draft_edited` row.
5. Approve the draft — confirm one `draft_approved` row. Click Approve again (if still
   reachable) — confirm still exactly one row.
6. Reject a *different* draft with a structured reason from the new dropdown — confirm
   one `draft_rejected` row with `metadata.reasonCode` set.
7. Add the approved draft to the publishing queue and publish it via the existing
   Publishing page (or the admin publishing-due task in dev) — confirm one
   `publishing_queued` row, then one `publishing_succeeded` row once verified.
8. Re-run verification on the same job — confirm no duplicate `publishing_succeeded` row.
9. Run analytics capture (`POST /api/admin/trigger-analytics-capture` or wait for the
   background job) — confirm one `performance_measured` row, and that
   `summarizeRecommendationOutcomeForUser` now reports `lifecycleStatus: "measured"`,
   `usefulnessSignal: "positive"`.
10. Call
    `POST /api/admin/trigger-recommendation-outcome-reconciliation` with this tenant's
    `userId`/`businessProfileId` — confirm `eventsInserted: 0` (everything above was
    already recorded live). Run it a second time — still `0`.
11. Confirm in `.next/static/` (production build) that no server-only symbol from
    `lib/recommendation-outcomes/*` and no `SUPABASE_SECRET_KEY` appear in the client
    bundle.

## 15. Known limitations

- `draft_edited` history cannot be reconstructed retroactively by reconciliation (§7) —
  only captured going forward.
- Regenerating a draft (the Approval Center's "Regenerate" action) creates a **new**
  `content_approvals` row that does not carry over `marketing_recommendation_id` (a
  pre-existing behavior, unrelated to this milestone — adding the link naively would
  collide with the partial unique index on active recommendation drafts from migration
  019, since the original row is often still active). Outcome tracking for that
  recommendation ends at the original draft; a regenerated draft is invisible to this
  feedback loop. Fixing this cleanly is future work, not "very small and clearly safe."
- Performance attribution is exactly as precise as the existing aggregate-allocation
  estimate (§2, §11) — this milestone does not add true per-post analytics.
- `getRecommendationOutcomeStatsForUser` calls the per-recommendation summarizer in a
  loop; fine at today's "at most one active recommendation per action type per business"
  scale, but not optimized for a large historical set. Worth revisiting alongside §16.
- No Playwright E2E test was added for this flow, for the same reason documented in
  `docs/RECOMMENDATION_EXECUTION_ENGINE.md`: this repo has no authenticated-flow E2E
  scaffolding to extend (no login helper, no seed data, no service-role key in the E2E CI
  job). Coverage instead comes from the unit/integration tests listed above (`lib/
  recommendation-outcomes/*`, the content-approval-service wiring, and the admin-route
  validators).

## 16. Next milestone: using outcomes to influence recommendation scoring

This milestone deliberately stops at **exposing** normalized outcome data — it does not
change `lib/marketing-decisions/scoring.ts` or `decisionEngine.ts`.
`getRecommendationOutcomeStatsForUser` (approval/rejection/edit/publish-success rates,
grouped by action type/channel, with structured rejection-reason counts) is the intended
input for a future scoring adjustment — e.g. down-weighting an action type with a
historically high rejection rate for a given tenant, or surfacing "recommendations like
this are usually rejected for `wrong_tone`" as an explanatory signal. That integration is
intentionally left as a separate, reviewable change once there's enough real outcome
history for it to be meaningful, rather than wiring an unproven signal directly into
production ranking today.
