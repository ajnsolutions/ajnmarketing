# Recommendation Execution Engine

- **Status:** Implemented
- **Date:** 2026-07-13
- **Scope:** Closes the gap between a `marketing_recommendations` row and an executable
  marketing action: `recommendation -> generated content draft -> content_approvals ->
  Approval Center`. No production schedules were activated by this work.

---

## 1. Root cause / missing link

Before this change, `generateContentDraftForRecommendation`
([`lib/marketing-decisions/create-content.ts`](../lib/marketing-decisions/create-content.ts))
already did almost everything needed to turn one recommendation into a draft — but it was
only ever called from a user clicking "Generate Draft" in the UI
(`app/api/marketing-recommendations/create-content/route.ts`). Nothing called it
automatically once a recommendation existed, and there was no typed, five-state result
vocabulary (`executed | already_executed | skipped | unsupported | failed`) for a
scheduler or admin tool to reason about across a whole tenant's recommendation set.

A previously-suspected naming mismatch (`publish_gbp_post` vs. a hypothetical
`create_gbp_post`) was investigated and found not to exist: a repo-wide search confirms
`create_gbp_post` appears nowhere in the codebase. `publish_gbp_post` (one of the 8
`RecommendedActionTypes`) is and always was the only name, already routed through the one
canonical mapping described below. No rename was needed or performed.

## 2. Architecture

```
marketing_recommendations (open|in_progress)
        |
        v
executeRecommendationForUser(userId, recommendationId)      <- lib/recommendation-execution/engine.ts
        |  1. tenant + status pre-check
        |  2. action-type routed through the canonical mapping
        |  3. delegates to generateContentDraftForRecommendation (unchanged, reused)
        v
content_approvals (status=pending, source=marketing_recommendation)
        |
        v
Approval Center (existing UI, zero changes)
```

`executeRecommendationForUser` is a thin, typed adapter, not a reimplementation. It never
duplicates content-generation logic; it performs its own tenant/status/action-type
pre-checks (so it can classify `skipped`/`unsupported`/`failed` *before* ever touching
generation) and then calls the existing `generateContentDraftForRecommendation` for the
actual generate-and-save work, translating that function's `{result, reused, error}`
return shape into this engine's five-state vocabulary.

`executeEligibleRecommendationsForUser` batches this across every `open`/`in_progress`
recommendation for one tenant (reusing the existing
`getActiveMarketingRecommendationsForUser` query), catching each recommendation's failure
individually so one bad recommendation can never abort or corrupt the rest of the batch.

### Supported actions

Exactly the 4 of 8 `RecommendedActionTypes` that
[`lib/marketing-decisions/actionTypeContentMapping.ts`](../lib/marketing-decisions/actionTypeContentMapping.ts)'s
`CONTENT_SUPPORTED_ACTION_TYPES` already declared, unchanged:

| Action type | Content type produced |
|---|---|
| `create_timely_content` | mapped via `mapActionTypeToContentTarget` |
| `create_seasonal_content` | mapped via `mapActionTypeToContentTarget` |
| `publish_gbp_post` | Google Business Profile Post |
| `refresh_website_content` | website copy content type |

### Unsupported actions

The remaining 4 action types never produce a draft. The engine returns `unsupported`
immediately, before touching `content_approvals` at all, with the reason text sourced
from the existing `getManualNextStep()` helper
([`lib/marketing-decisions/ui.ts`](../lib/marketing-decisions/ui.ts)) rather than
duplicating new copy:

| Action type | Manual next step (existing copy, reused) |
|---|---|
| `request_reviews` | Reach out to recent customers and ask for a Google review... |
| `increase_posting_frequency` | Plan a steadier posting cadence... |
| `update_business_info` | Review and complete missing business profile fields... |
| `upload_photos` | Add fresh photos of your work, team, or location... |

These are never silently marked complete and never routed to any workflow that would
imply autonomous completion — they remain manual, exactly as the existing "Manual" UI
badge already represents them.

## 3. Schema changes

**None.** Migration
[`019_recommendation_content_link.sql`](../supabase/migrations/019_recommendation_content_link.sql)
already added everything this engine needs before this work started:

- `content_approvals.marketing_recommendation_id uuid references marketing_recommendations(id) on delete set null`
- A partial **unique index**, `content_approvals_active_recommendation_idx`, on
  `(marketing_recommendation_id) where marketing_recommendation_id is not null and status
  in ('pending','approved','published')`.

This is why no new migration, execution-status columns, or dedicated execution table were
needed: the existing recommendation `status` column (`open -> in_progress ->
dismissed/completed/superseded`) already carries exactly the state this engine needs
(`in_progress` already means "a draft exists"), and the partial unique index already makes
a duplicate *active* draft for the same recommendation impossible at the database level.

## 4. Idempotency strategy

Idempotency is inherited entirely from `generateContentDraftForRecommendation`'s existing
guarantees — this engine adds none of its own:

1. Before generating, it checks for an existing active draft
   (`getActiveContentApprovalForRecommendation`); if found, returns it (`already_executed`).
2. If two concurrent calls both pass that check, the database-level partial unique index
   is the real guarantee: the losing insert raises a Postgres unique-violation, which
   `createContentApprovalWithConflict` reports as `uniqueViolation: true`, and the caller
   re-queries to return the winning row — no error is surfaced to the user for a race that
   resolved correctly.
3. A recommendation only moves `open -> in_progress` **after** its draft is durably
   inserted (`markMarketingRecommendationInProgress` is the last write in the success
   path) — never before.
4. If all prior linked drafts for a recommendation were rejected, generation is allowed
   again (the partial index only covers `pending | approved | published`).

## 5. Execution states and retry behavior

| Status | Meaning | Retryable? |
|---|---|---|
| `executed` | A new draft was created just now. | N/A — done |
| `already_executed` | An active draft already existed (idempotent no-op). | N/A — done |
| `skipped` | Recommendation status isn't `open`/`in_progress` right now. | Yes, if it becomes active again |
| `unsupported` | This action type never produces content — a permanent classification. | No — always manual |
| `failed` | Generation, persistence, or tenant/recommendation lookup failed. | Yes — nothing is left half-written |

A `failed` result never leaves the recommendation `in_progress`: the status flip only
happens after a successful insert, so a failed attempt leaves the recommendation `open`
and eligible for the next pipeline run or manual retry to pick up again.

## 6. Security / tenancy

- `executeRecommendationForUser(userId, recommendationId, supabaseClient?)` follows the
  same `*ForUser` + injectable-client convention as every other function in this codebase.
  Tenant scoping comes from `getMarketingRecommendationByIdForUser`'s own
  `.eq("user_id", userId).eq("id", recommendationId)` filter — a recommendation ID
  belonging to another tenant is indistinguishable from a nonexistent one and returns
  `failed: "Recommendation not found for this tenant."`
- No new service-role usage patterns: the engine accepts whatever client its caller
  passes in (cookie-bound for interactive use, service-role for Trigger.dev/admin use),
  exactly like `generateContentDraftForRecommendation` already did.
- The new admin route
  (`app/api/admin/trigger-recommendation-execution/route.ts`) mirrors the existing
  `trigger-recommendation-pipeline` route's auth chain: cookie session ->
  `isAdminUserId` allowlist -> body validation
  (`lib/admin/triggerRecommendationExecutionRequest.ts`) -> a service-role **ownership
  verification query** (`id` + `user_id` match) before ever calling the engine -> then
  `executeRecommendationForUser`. Cross-tenant rejection is unit-tested directly against
  the engine (`unit-tests/recommendation-execution-engine.test.ts`), the layer the route
  delegates to.

## 7. Trigger.dev integration

`content_execution` was added as a **6th stage** inside the existing
`runRecommendationPipelineForUser` orchestrator
([`lib/recommendation-pipeline/orchestrator.ts`](../lib/recommendation-pipeline/orchestrator.ts)),
after `decision_engine`. This required:

- **No new Trigger.dev task.** `recommendationPipelineForTenantTask` and
  `recommendationPipelineSweepTask` in
  [`trigger/recommendationPipeline.ts`](../trigger/recommendationPipeline.ts) are
  unchanged — their stage-logging loop already logs every entry in `result.stages`
  generically, so a 6th stage needed zero code changes there (only a doc comment was
  added explaining why).
- **No cron changes.** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` in
  [`lib/trigger/scheduleActivation.ts`](../lib/trigger/scheduleActivation.ts) remains
  `false` and was not touched. No new literal cron declaration was added anywhere.
- Content execution only runs if `decision_engine` did not hard-fail (mirroring
  `decision_engine`'s own dependency on `opportunity_detection` not having failed); it is
  independently caught, so its own failure never corrupts the rest of the pipeline result.

## 8. Manual testing steps

Two ways to exercise this without waiting for the daily sweep:

1. **Existing UI path (unchanged):** On the Marketing Recommendations page, click
   "Generate Draft" on any content-supported recommendation — this already calls
   `generateContentDraftForRecommendation` directly and is unaffected by this change.
2. **New admin route (for exercising the engine's own five-state classification):**
   ```bash
   curl -X POST http://localhost:3000/api/admin/trigger-recommendation-execution \
     -H "Content-Type: application/json" \
     --cookie "<your admin session cookie>" \
     -d '{"userId": "<user-id>", "recommendationId": "<recommendation-id>"}'
   ```
   Requires the caller's user id to be in the `isAdminUserId` allowlist. Response is the
   `RecommendationExecutionResult` (`status`, `contentApprovalId`, `reason`, etc.)
   directly — no Trigger.dev run is queued, this executes synchronously (same
   cost/duration profile as the existing "Generate Draft" button: one OpenAI call).

## 9. Tests

- `unit-tests/recommendation-execution-engine.test.ts` (24 tests): all 4 supported action
  mappings, `publish_gbp_post` canonicalization, all 4 unsupported action types with the
  correct `getManualNextStep` reason, successful execution, idempotent repeat, concurrent
  duplicate-insert resolution, failure before/after draft creation, retry after failure,
  tenant mismatch / not-found, status-based skip, batch evaluation with one failure not
  blocking another, empty-eligible-set handling, `*ForCurrentUser` cookie requirement, and
  a direct assertion that `ATTACH_DECLARATIVE_PRODUCTION_CRONS` is `false`.
- `unit-tests/recommendation-pipeline-orchestrator.test.ts`: extended with 6 new tests for
  the `content_execution` stage (last-in-order, skipped when zero eligible, skipped when
  `decision_engine` fails, still runs when `decision_engine` is merely skipped, completed
  details/reason reflect the batch summary, failure containment). 4 pre-existing tests in
  this file were updated for the new 6th stage (they previously asserted exactly 5 stages
  all `completed`).
- `unit-tests/admin-trigger-recommendation-execution.test.ts`: request-body validator
  tests, mirroring the existing `admin-trigger-recommendation-pipeline.test.ts` pattern.

**Known limitation — no Playwright E2E test was added.** This repo currently has no
authenticated-flow E2E infrastructure at all (the only existing spec,
`tests/homepage.spec.ts`, is unauthenticated), no seeded test user, no service-role key in
the E2E CI job, and no test-mode hook to swap out the OpenAI content generator inside a
running dev server. Building a genuine "recommendation exists -> execution runs -> draft
visible in Approval Center -> rerun makes no duplicate" browser test would mean inventing
that entire scaffold (login helper, seed step, generator mock) rather than extending an
existing convention — out of scope for this change, and a real gap in this repo's overall
test pyramid worth addressing separately. The recommendation -> draft -> idempotency flow
itself is fully covered end-to-end at the function level by the unit/orchestrator tests
above, including the real database-level unique-index race behavior (exercised via
`createContentApprovalWithConflict`'s own existing test coverage).

## 10. What remains for future autopilot behavior

- **No automatic publishing.** This engine only ever creates a `pending` row in
  `content_approvals`. Publishing still requires the existing, separate
  approval/publishing workflow (a human approving the draft, then the existing publishing
  engine). Creating a recommendation, or even running the full pipeline, can never publish
  anything by itself.
- **No new action types.** Facebook/Instagram/LinkedIn drafting is already possible in
  principle for the 4 supported action types via the content generator's own
  `CONTENT_TYPE_OPTIONS`, but real publishing to those platforms remains unimplemented
  per `providerRouter.ts`'s existing stub-throws — unrelated to and unchanged by this
  work.
- **The 4 unsupported action types remain manual by design**, not because of a
  limitation in this engine — `request_reviews`, `increase_posting_frequency`,
  `update_business_info`, and `upload_photos` do not have a well-defined "draft" to
  generate; they are direct actions a human takes in Google Business Profile or
  elsewhere.
- Zero production schedules were activated by this work:
  `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`, no new cron declaration was
  added, and both Trigger.dev tasks this engine touches are unchanged (manual `tasks.trigger()`/Test-run invocation still works exactly as before).
