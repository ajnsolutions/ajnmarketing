# Marketing Experimentation Engine

**Project Magic Phase 2E.** Manages controlled marketing experiments that Marketing Director has explicitly determined are suitable for testing, and that the user has explicitly approved.

## Responsibilities

The Experimentation Engine:

- Evaluates Marketing Director's deterministic eligibility rule and persists a **server-authored proposal** for each newly-eligible recommendation
- Lets the user **approve** a proposal, converting it into exactly one experiment
- Manages deterministic lifecycle transitions
- Measures the experiment's primary KPI as an **honest aggregate** over its measurement window — never a fabricated per-variant comparison
- Surfaces proposed/active/completed experiments on the Head of Marketing dashboard
- On completion, records a Marketing Memory **observation** (evidence only)
- Exposes explainable results via API

The Experimentation Engine does **not**:

- Invent experiments or accept free-form experiment creation from a client
- Let a client define an experiment's type, hypothesis, variants, KPIs, or measurement window
- Let a client supply an unverified Marketing Director decision key
- Convert an ordinary recommendation into an experiment (a recommendation existing is not, by itself, a proposal)
- Generate or re-rank recommendations
- Automatically launch or approve experiments
- Modify campaigns or publish content autonomously
- Fabricate a per-variant result from aggregate analytics, or claim a winner without real variant attribution
- Write Marketing Memory learnings, preferences, or overrides
- Call LLMs or ML models
- Attach Trigger.dev production crons (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`)

## Required authority chain

```
Marketing Director eligibility rule
  → persisted experiment proposal (server-authored, admin-triggered evaluation)
  → explicit user approval
  → experiment creation (server copies every field from the proposal)
  → experiment lifecycle (advance / measure / complete)
  → Marketing Memory experiment_completed observation
```

There is no shortcut around this chain. `POST /api/experiments` (the original, client-decision-key creation route) has been **removed entirely** — see "History" below.

## Source-of-truth boundaries

| Concern | Owner |
|---|---|
| Should an experiment exist? | Marketing Director's eligibility rule (`lib/marketing-director/experimentEligibility.ts`) |
| Experiment type / hypothesis / control-treatment / KPI / measurement window | The persisted proposal — copied verbatim by the server on approval, never client input |
| Approve a proposal | The user, via an explicit command that supplies only a proposal ID |
| Create record / lifecycle / measure | Experimentation Engine |
| Strategy / prioritization | Marketing Director only |
| Create recommendations | Recommendation Engine (unchanged) |

## Where Marketing Director decisions actually live

There is no `marketing_director_decisions` table anywhere in this schema. `lib/marketing-director/resolveDecision.ts`'s own doc comment is explicit: "Nothing here re-scores a recommendation, calls OpenAI, or writes to the database" — every `MarketingDirectorDecision` is computed fresh per request and never persisted. This phase does not invent a parallel decision-persistence system to work around that. Instead, **`marketing_experiment_proposals` itself is the first durable artifact of a specific Marketing Director determination**: each row is written only by `lib/marketing-director/experimentEligibility.ts`'s deterministic rule, invoked only from the admin-gated evaluation route (see below), and its `decision_reason` + `marketing_director_decision_key` + `created_at` collectively form the audit record.

## Marketing Director proposal eligibility rule

Pure, deterministic, declarative — no LLM, no ML, no inferred variants (`lib/marketing-director/experimentEligibility.ts`). A proposal is produced only when **all** of the following hold:

- the recommendation's `status` is `open` (not `dismissed`, `completed`, `superseded`, or `in_progress` — the last of those means a draft already exists for it)
- the recommendation's `recommended_action_type` is allowlisted for experimentation:
  - `publish_gbp_post` or `increase_posting_frequency` → `posting_time`
  - `request_reviews` → `review_request_timing`
  - every other action type is not eligible
- the business has at least `MIN_ANALYTICS_HISTORY_SNAPSHOTS` (3) analytics snapshots
- no pending proposal already exists for the same recommendation + experiment type
- no active (non-terminal) experiment already exists for the same recommendation + experiment type

A recommendation existing is never, by itself, a proposal — every condition above must hold.

### Who runs this rule

`evaluateAndPersistExperimentProposalsForBusiness` (`lib/marketing-experimentation/proposal-service.ts`) evaluates every active recommendation for one business and persists a proposal for each newly-eligible one. It is called **only** from `POST /api/admin/trigger-experiment-proposal-evaluation` — an admin-gated (`requireAdminUser`), service-role-client route, mirroring the existing `app/api/admin/trigger-recommendation-execution` pattern exactly. This is deliberate, not incidental:

- `lib/supabase/service.ts`'s own trust-boundary doc comment forbids using the service-role client "to answer a request initiated by a user" — so this evaluation cannot run inline during the tenant's own Head of Marketing page load, even though that would have been the simplest wiring.
- RLS on `marketing_experiment_proposals` has **no INSERT policy for the `authenticated` role at all** (default-deny) — the service-role client is the only way a proposal ever comes into existence, so an admin-gated route is the only viable trigger point without inventing a new schedule.
- This is not wired to any cron or schedule — `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`. It runs the same way recommendation generation itself currently runs in this environment: manually/admin-triggered, pending a future decision about production scheduling.

## Proposal approval

`POST /api/experiment-proposals/[id]` (tenant-facing, normal session-scoped client). The client submits **no experiment definition of any kind** — only the proposal ID in the URL. The server:

1. Loads the proposal, scoped to the caller's own `user_id` + `business_profile_id` (404 otherwise).
2. If already `approved` with a `converted_experiment_id`, returns that same experiment — **idempotent**, no duplicate created.
3. If not `pending`, rejects with `409`.
4. **Rechecks recommendation eligibility fresh** (still `open`, still same tenant) and campaign tenant ownership (if linked) — if either has changed since the proposal was created, marks the proposal `expired` and rejects with `409`.
5. Atomically flips `proposal_status` from `pending` to `approved` via a conditional `UPDATE ... WHERE proposal_status = 'pending'` (compare-and-swap) — this resolves concurrent approval requests safely: whichever request's UPDATE actually matches a row wins; the loser re-reads and returns the winner's resulting experiment.
6. Inserts exactly one experiment, copying every authoritative field (experiment type, title, hypothesis, control/treatment definitions → `variants`, primary KPI, `source_proposal_id`) from the proposal row — never from the request body. The new experiment starts at status `approved` (not `draft`/`proposed` — those application-level pre-approval states are now represented by the proposal's own `pending` status instead).
7. Records the conversion back onto the proposal (`converted_experiment_id`), self-healing on a repeated call if a prior attempt inserted the experiment but crashed before this step.

## Database enforcement (migration 029)

RLS alone is ownership-only and cannot express "only server-authored proposals" or "status may only move forward through an approved chain" — so migration 029 adds:

- **No INSERT policy** on `marketing_experiment_proposals` for `authenticated` — only the service-role client (admin route) can create a proposal.
- An UPDATE policy scoped to the owning tenant (needed for the approval command itself) **plus a mutation-guard trigger** (`enforce_marketing_experiment_proposal_mutation`) that allows exactly `pending → approved` or `pending → expired` and rejects any change to `experiment_type`, `hypothesis`, `control_definition`, `treatment_definition`, `primary_kpi`, `recommendation_id`, `campaign_id`, or any other definitional field, at any status. A user can approve their own proposal; they cannot redefine it.
- A unique partial index ensuring **at most one pending proposal** per (business, recommendation, experiment type).
- A unique partial index on `converted_experiment_id`, plus a unique index on the new `marketing_experiments.source_proposal_id` column — **at most one experiment per proposal**, enforced from both directions.
- A `before insert` trigger on `marketing_experiments` (`enforce_marketing_experiment_requires_approved_proposal`) requiring `source_proposal_id` to be set, referencing a proposal that is `approved`, with matching tenant, recommendation, campaign, and experiment type. **Direct experiment inserts without an approved proposal are rejected at the database layer**, independent of application code.
- Migration 028's existing lifecycle mutation-guard trigger (`enforce_marketing_experiment_transition`) is untouched and remains active.

Apply migrations 028 then 029, in order — 029 alters tables 028 creates (adds `marketing_experiments.source_proposal_id`, extends the shared `marketing_memory_evidence_links` source-type check to include `experiment_proposal`).

## Lifecycle

```
(proposal: pending → approved, or expired)
   ↓ approval converts to an experiment starting at:
Approved → Running → Measuring → Completed → Archived
```

`draft` and `proposed` remain valid `marketing_experiments.status` values in the schema (for flexibility/back-compat) but are never produced by the current, only creation path — the proposal's own `pending`/`approved` states now represent what those two statuses used to mean at the application level.

All transitions are deterministic and auditable (`lib/marketing-experimentation/experiment-state.ts`). `advance` moves exactly one step; `measure` requires `running` or `measuring` and may be called repeatedly while `measuring` (idempotent re-measurement); `complete` requires `measuring` — completing directly from `running` is rejected, not silently allowed. Every rejection returns `409` with the current status, never a silent no-op. Enforced twice, independently: in the application and again by migration 028's database trigger (see prior review section below for why both layers matter).

## Honest measurement boundary

**Existing analytics are aggregate-only — there is no per-post/per-variant tag anywhere in analytics capture.** A business has exactly one total per KPI, not two comparable variant-level numbers. Given that, measurement:

- computes the experiment's primary KPI as an **honest sum over the measurement window** (every analytics snapshot since the experiment started running)
- **never** splits that aggregate into two "variant" numbers, and never duplicates one value into both — either of those would still be fabricating a comparison that doesn't exist
- **never** declares a winning variant (`winningVariantKey` is always `null`)
- **never** exceeds `early` confidence (`aggregateObservedOutcome`'s only possible confidence levels are `insufficient` and `early`), regardless of how large the aggregate is — magnitude of an undifferentiated total is not evidence about a variant
- represents the result honestly: `direction: "inconclusive"` (or `"insufficient_data"` when no analytics exist for the window), with a summary stating that aggregate performance was observed but variant attribution is unavailable

`lib/marketing-experimentation/experiment-outcomes.ts` still contains `computeVariantComparisonOutcome` — the general A-vs-B comparison math (divide-by-zero safe, ties handled, confidence scales with sample size and lift) — but **nothing in the current measurement path calls it**. It exists as the extension point for a future phase; see below.

## Future attribution boundary

Decisive per-variant measurement requires authoritative records that do not exist today:

- which content or action used which variant (control vs. treatment) at creation time
- when each variant was exposed (a real per-item timestamp, not just an aggregate window)
- audience/channel scope, if relevant to the KPI
- a variant-specific analytics linkage back to that exposure

Until those exist, `computeVariantComparisonOutcome` remains unused and `ExperimentOutcome.attributionAvailable` stays `false` for every experiment created through this pipeline. No fake attribution was created to make this phase appear more complete than it is.

## Supported experiment types

Only two of the seven originally declared types are currently proposable (`SUPPORTED_EXPERIMENT_TYPES` in `experiment-templates.ts`); the CHECK constraint on `marketing_experiment_proposals.experiment_type` enforces the same restriction at the database layer:

| Type | Status | Why |
|---|---|---|
| `posting_time` | Supported | Variants describe *when* an existing action (publish) happens; `publishing_queue` already records `scheduled_for`/`published_at` for every post, a real foundation for future per-item attribution |
| `review_request_timing` | Supported | Same reasoning — timing of an existing, already-timestamped action (a review request) |
| `content_format` | Deferred | Requires classifying content as short/long — not captured anywhere in the schema |
| `cta_variation` | Deferred | Requires classifying a CTA's style — not captured anywhere in the schema |
| `messaging_style` | Deferred | Requires classifying content as educational/promotional — not captured anywhere in the schema |
| `image_vs_text` | Deferred | Requires classifying content as image-led/text-led — not captured anywhere in the schema |
| `campaign_sequencing` | Deferred | Compares two *whole, differently-ordered campaigns* run at different times — a between-campaigns comparison this engine does not model as a single experiment |

Each deferred template carries a `deferralReason` string documenting the above; `listSupportedExperimentTemplates()` / `isSupportedExperimentType()` are the only entry points the proposal pipeline uses.

Variant keys are `"control"` and `"treatment"` — explicit roles, not an unordered pair.

## Marketing Memory integration

On first transition into `completed`, the engine records an `experiment_completed` observation via `recordObservationForExperimentCompletion`. Evidence only — never writes preferences, learnings, or overrides.

The stored `metric_summary` is 12 flat scalar fields, fitting the shared `sanitizeMetricSummary` allowlist's `MAX_METADATA_KEYS` cap exactly (`lib/marketing-memory/metadata.ts` only preserves top-level scalars, silently dropping anything nested — a lesson from a prior version of this same function):

`experiment_type`, `outcome`, `winner`, `confidence`, `attribution_available`, `primary_kpi`, `aggregate_metric_value`, `measurement_start`, `measurement_end`, `proposal_id`, `recommendation_id`, `campaign_id`.

(`experiment_id` is deliberately *not* duplicated into this object — it's already captured on the observation row itself via `source_experiment_id`.) `winner` is always `null` and `outcome` is always `inconclusive`/`insufficient_data` for every experiment created through the current pipeline, since `attribution_available` is always `false`.

## Modules

| Module | Role |
|---|---|
| `experiment-types.ts` | Closed vocabularies + experiment entity shapes |
| `experiment-templates.ts` | Declarative templates, supported/deferred flag |
| `experiment-state.ts` | Lifecycle transitions |
| `experiment-outcomes.ts` | Honest aggregate outcome + (unused today) variant comparison math |
| `experiment-engine.ts` | Pure progression / measure / explain helpers |
| `experiment-persistence.ts` | Batched Supabase access for `marketing_experiments` |
| `experiment-service.ts` | DI entrypoints: list/dashboard/advance/measure/complete |
| `experiment-dashboard.ts` | Customer-safe experiment card projection |
| `experiment-request.ts` | API body parsing (proposal-approval request only) |
| `proposal-types.ts` | Closed vocabularies + proposal entity shapes |
| `proposal-persistence.ts` | Batched Supabase access for `marketing_experiment_proposals` |
| `proposal-service.ts` | Evaluate+persist (service-role only), list, approve/convert |
| `proposal-dashboard.ts` | Customer-safe proposal card projection |
| `lib/marketing-director/experimentEligibility.ts` | The deterministic eligibility rule |

Schema: `supabase/migrations/028_marketing_experimentation.sql`, `supabase/migrations/029_marketing_experiment_proposals.sql` (apply in that order).

APIs:
- `GET /api/experiments` — dashboard + experiment list + pending proposals (tenant-facing)
- `GET/POST /api/experiments/[id]` — `advance` | `measure` | `complete` (tenant-facing)
- `POST /api/experiment-proposals/[id]` — approve a proposal (tenant-facing, the only creation path)
- `POST /api/admin/trigger-experiment-proposal-evaluation` — run the eligibility rule for one business (admin-only, service-role)

## Explicit non-goals (this phase)

- No LLM / ML
- No new providers
- No autonomous actions or schedules — proposal evaluation is admin-triggered, never a background sweep
- No manual experiment or proposal editing UI
- No new recommendation engine
- No deployment of production crons
- No fabricated variant attribution

## History — two review passes

### First review pass: measurement fabrication and lifecycle bypass

An earlier review of this PR found and fixed (before the proposal architecture below existed): a fabricated per-variant analytics split (`floor`/`ceil` of one aggregate), unvalidated cross-tenant campaign linkage, unchecked recommendation eligibility, a missing database-level lifecycle mutation guard, and a Marketing Memory payload that silently dropped its own evidence fields due to the shared sanitizer's scalar-only allowlist. That review's verdict was **CHANGES REQUIRED**, specifically because the PR's headline "Marketing Director-gated experiments" claim was not actually enforced — `POST /api/experiments` accepted a client-supplied `marketingDirectorDecisionKey` string checked only for non-emptiness, with no server-side verification that Marketing Director had proposed the experiment.

### Second review pass: the persisted-proposal architecture (this document)

This pass implements the product decision that closes that gap: experiments may now only be created by approving a persisted, server-authored proposal (above). The prior client-decision-key creation route, its planner, its request parser, and the never-wired `buildExperimentProposalFromDirectorDecision` handoff helper were all removed rather than patched, since none of them could be made honest without the proposal architecture. The prior floor/ceil split fix (making both buckets equal) has been superseded by a stronger fix: the current measurement path no longer computes any per-variant number at all, honest or otherwise — it reports an aggregate with explicit non-attribution.

| Change | Why |
|---|---|
| New `marketing_experiment_proposals` table (migration 029), server-authored only (no INSERT policy for `authenticated`) | Closes the client-decision-key bypass at its root — there is no longer any field the client can supply that defines an experiment |
| New deterministic eligibility rule (`experimentEligibility.ts`) | "A recommendation is not automatically an experiment proposal" — makes the MD determination an explicit, testable, narrow rule instead of an unenforced client claim |
| Proposal approval is a compare-and-swap conversion, never a generic PATCH | Prevents double-conversion under concurrent requests without needing a stored procedure |
| `marketing_experiments.source_proposal_id` + insert-guard trigger | "Direct experiment inserts without an approved proposal are rejected," enforced at the database layer, not just in application code |
| Measurement no longer computes any per-variant number | The previous session's fix (equal split) was still, technically, inventing two numbers where only one exists. This pass removes that entirely — see "Honest measurement boundary" |
| `ExperimentMetrics`/`ExperimentOutcome` types redesigned (no more `*A`/`*B` fields; added `attributionAvailable`) | Makes the fabrication impossible to reintroduce accidentally — the type itself no longer has a place to put a fake per-variant number |
| Marketing Memory payload rebuilt around the honest field set | The 12 flattened fields now literally describe "aggregate observed, no winner, confidence early or insufficient" rather than a would-be A/B comparison |
| UI: new "Proposed" section with an "Approve experiment" button; completed-without-attribution state shows "Inconclusive" / "No winner selected", never a confidence badge implying more | Matches the product decision's UI requirements exactly — no editing, no free-form creation, no winner badge |

**Confirmed correct on inspection, no fix needed (this pass):** every persistence function scopes by `user_id`/`business_profile_id`; the admin evaluation route mirrors the established `trigger-recommendation-execution` pattern exactly (`requireAdminUser` + service-role client, never answering a tenant's own request); the approval route's server never reads `experimentType`/`hypothesis`/`variants`/`primaryKpi` from the request body — only `proposalId`; no per-card N+1 queries; no duplicate Marketing Director/Executive Brief resolve (proposals batch into the same `Promise.all` as campaigns/experiments in `getHeadOfMarketingBriefingForCurrentUser`); `ATTACH_DECLARATIVE_PRODUCTION_CRONS` untouched and `false`; zero diff in `lib/marketing-director/resolveDecision.ts`, `lib/marketing-decisions/decisionEngine.ts`, `lib/campaign-intelligence/`, `lib/publishing-queue/`, `lib/content-approval/`.

### Manual smoke-test steps (not run — no authenticated session in this environment)

No seeded test-user credentials or admin session are available in this environment. The Playwright coverage above only exercises unauthenticated-rejection and static file-content assertions. The following steps were **not executed**; this is not a claim that the authenticated path passed. A human with a real login (and, for steps 5–6, an admin account) should verify:

1. Log in, open **Head of Marketing** (`/dashboard`). Confirm an "Experiments" section renders between Campaigns and the Strategic Calendar preview, with "Proposed" (only when a pending proposal exists), "Active", and "Completed" subsections, and useful empty-state copy.
2. Confirm there is no free-form create control anywhere, and no way to edit a proposal's fields — only an "Approve experiment" button on a proposal card.
3. As an admin, `POST /api/admin/trigger-experiment-proposal-evaluation` with `{"userId": "...", "businessProfileId": "..."}` for a test business that has an **open** `publish_gbp_post` or `request_reviews` recommendation and at least 3 analytics snapshots. Confirm the response reports `proposed: 1` and a "Proposed" card now appears on that business's Head of Marketing page.
4. Click "Approve experiment" on that card. Confirm it moves into "Active" (status `approved`), the proposal disappears from "Proposed", and clicking Approve again (e.g. via a second manual API call) does not create a second experiment.
5. Confirm `POST /api/experiments` (the old creation route) no longer exists — any request to it other than `GET` should be rejected by Next.js automatically.
6. Advance the experiment through `running` → `measuring` → `completed` via `POST /api/experiments/{id}` (`advance`, `measure`, `complete`). Confirm the completed card shows "Inconclusive" / "Aggregate performance observed" / "Variant attribution unavailable" / "Early confidence maximum" / "No winner selected" — never a winner badge or "Strong"/"Moderate signal" text.
7. Confirm the **Strategic Marketing Calendar**, **Interactive Head of Marketing** (Ask panel), and **Executive Brief** sections on the same page still load and function normally.
8. Confirm no schedule/cron was activated anywhere in the environment as a side effect of any of the above.
