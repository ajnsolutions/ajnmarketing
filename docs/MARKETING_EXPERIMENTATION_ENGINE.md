# Marketing Experimentation Engine

**Project Magic Phase 2E.** Manages controlled marketing experiments that have already been approved by the Marketing Director and user.

## Responsibilities

The Experimentation Engine:

- Creates experiment records from **Marketing Director–proposed** inputs backed by existing recommendations
- Manages deterministic lifecycle transitions
- Compares variants using existing analytics KPIs
- Summarizes findings with confidence indicators
- Surfaces active/completed experiments on the Head of Marketing dashboard
- On completion, records a Marketing Memory **observation** (evidence only)
- Exposes explainable results via API

The Experimentation Engine does **not**:

- Invent experiments or free-form experiment creation
- Generate or re-rank recommendations
- Automatically launch or approve experiments
- Modify campaigns or publish content autonomously
- Write Marketing Memory learnings or preferences
- Call LLMs or ML models
- Attach Trigger.dev production crons (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`)

## Source-of-truth boundaries

| Concern | Owner |
|---|---|
| Should an experiment exist? | Marketing Director |
| Experiment type / hypothesis / linkage | Marketing Director (via proposal) |
| Create record / lifecycle / measure | Experimentation Engine |
| Strategy / prioritization | Marketing Director only |
| Create recommendations | Recommendation Engine (unchanged) |

Proposal is gated: callers must pass `proposedBy: "marketing_director"`, a non-empty `marketingDirectorDecisionKey`, and `createdFromRecommendationId`. See `lib/marketing-director/experimentProposal.ts`.

The cited recommendation must belong to the caller's own business and be `status = "open"` (a dismissed, completed, or superseded recommendation is no longer an actionable directive and cannot originate a new experiment). A `relatedCampaignId`, if supplied, must also belong to the caller's own business — validated server-side before insert.

**Known limitation — the MD gate is shape-only, not content-verified.** `buildExperimentProposalFromDirectorDecision` (`lib/marketing-director/experimentProposal.ts`) is the only code that derives `marketingDirectorDecisionKey` from an actual, freshly-computed `MarketingDirectorDecision` — and as of this PR, it is called by unit tests only, never by any production route or UI. `POST /api/experiments` accepts `marketingDirectorDecisionKey` and `proposedBy` as opaque client-supplied strings, checked only for the literal value `"marketing_director"` and non-emptiness — there is no server-side recomputation that verifies Marketing Director actually proposed *this* experiment. In effect, today, any authenticated user can create an experiment for any of their own open recommendations via a direct API call; the "MD-gated" framing describes the intended design, not an enforced one. Closing this gap requires deciding *when* and *for which recommendations* Marketing Director should propose an experiment — a product decision with no existing precedent in `MarketingDirectorDecision` (it currently has no "propose an experiment" concept at all) — so it was not invented here. There is also currently no UI path that calls `POST /api/experiments` at all (the Experiments section is read-only), so this gap is not reachable through the product today.

## Lifecycle

```
Draft → Proposed → Approved → Running → Measuring → Completed → Archived
```

All transitions are deterministic and auditable (`lib/marketing-experimentation/experiment-state.ts`). `advance` (draft→proposed→approved→running) moves exactly one step; `measure` requires `running` or `measuring` and may be called repeatedly while `measuring` (idempotent re-measurement); `complete` requires `measuring` — completing directly from `running` (skipping measurement) is rejected, not silently allowed. Every rejection returns `409` with the current status, never a silent no-op.

The linear state machine is enforced twice, independently: in the application (`experiment-state.ts` + status guards in `experiment-service.ts`/`experiment-engine.ts`) and again at the database layer, by a `before update` trigger on `marketing_experiments` (`enforce_marketing_experiment_transition`, migration 028). RLS's "own rows" policy is ownership-only — it cannot express "status may only move forward one step" — so without the trigger, a user holding their own session JWT could call the Supabase client directly and set `status` straight to `completed` with a fabricated `outcome`, or move a completed/archived experiment back to `running`. The trigger closes that specific gap. It does not validate the *content* of `outcome`/`metrics` on an otherwise-legal single-step transition — that remains an application-layer guarantee only.

## Experiment model

Deterministic types (templates in `experiment-templates.ts`):

- posting time
- content format
- CTA variation
- educational vs promotional messaging
- image vs text emphasis
- campaign sequencing
- review request timing

Only templates backed by existing Marketing Director recommendations may be proposed.

## Analytics integration

Reuses existing analytics snapshots / KPIs only:

- engagement
- clicks
- reviews
- reach
- conversions
- publishing consistency

No new analytics providers.

**Measurement is honest about a real limitation: there is no per-variant analytics tag.** Publishing/analytics capture records one aggregate total per KPI per business — there is no mechanism today that attributes a specific post or result to "variant A" vs. "variant B" of a running experiment. A prior version of `measureExperimentForUser` fabricated a split via `floor(total/2)` for variant A and `ceil(total/2)` for variant B, which is not a measurement: it structurally guaranteed variant B ≥ variant A on every metric (variant A could never win), and for large totals the 1-unit rounding artifact could clear the outcome engine's sample-size thresholds and be reported as "moderate" confidence for a difference that never existed. Both buckets now receive the identical `floor(total/2)` value, so `computeExperimentOutcome`'s existing exact-tie branch applies honestly: it always reports `inconclusive` with confidence capped at `early`, never fabricating a winner. Real variant-level comparison requires tagging publishing output with its originating experiment variant at capture time — a genuine future requirement, not solved in this PR.

## Marketing Memory integration

On first transition into `completed`, the engine records an `experiment_completed` observation via `recordObservationForExperimentCompletion`. Evidence only — never overwrites preferences or learnings.

The stored `metric_summary` is flattened to scalar fields (`experimentType`, `variantSummary` — variant labels joined, e.g. `"Mid-week vs Weekend"` — `outcomeDirection`, `outcomeSummary`, `winningVariantKey`, `confidenceLevel`, `liftPercent`, `primaryMetric`, `primaryMetricValueA`/`B`, `recommendationId`, `campaignId`). This is deliberate: the shared `sanitizeMetricSummary` allowlist (`lib/marketing-memory/metadata.ts`) only preserves top-level scalar values and silently drops nested objects/arrays — a prior version nested the variant summary, measured outcome, and supporting metrics as objects/arrays, so none of them actually reached the stored observation despite being named in the intended payload. The 12 flattened fields fit `sanitizeMetricSummary`'s `MAX_METADATA_KEYS` cap; the full 12-field A/B metrics object is not included wholesale (that alone would exceed the cap) — only the primary metric's two values are, since that is what the outcome is actually computed from.

## Modules

| Module | Role |
|---|---|
| `experiment-types.ts` | Closed vocabularies + entity shapes |
| `experiment-templates.ts` | Declarative templates |
| `experiment-planner.ts` | Pure plan-from-template (MD-gated) |
| `experiment-state.ts` | Lifecycle transitions |
| `experiment-outcomes.ts` | Deterministic A/B outcome math |
| `experiment-engine.ts` | Pure progression / measure / explain helpers |
| `experiment-persistence.ts` | Batched Supabase access |
| `experiment-service.ts` | DI entrypoints + Memory observation hook |
| `experiment-dashboard.ts` | Customer-safe card projection |
| `experiment-request.ts` | API body parsing |

Schema: `supabase/migrations/028_marketing_experimentation.sql`.

APIs: `GET/POST /api/experiments`, `GET/POST /api/experiments/[id]` (`advance` | `measure` | `complete`).

## Explicit non-goals (this phase)

- No LLM / ML
- No new providers
- No autonomous actions or schedules
- No manual experiment editing UI
- No new recommendation engine
- No deployment of production crons

## Claude Review — Findings and Fixes

Independent architecture/security/lifecycle/analytics review. Every finding below was reproduced (a failing or missing test written first where practical) before being fixed, and a passing test now guards it.

| Finding | Severity | Fix |
|---|---|---|
| Measurement fabricated a per-variant split via `floor(total/2)`/`ceil(total/2)` of one undifferentiated analytics total — no real per-variant data exists anywhere in analytics capture. This structurally guaranteed variant B ≥ variant A on every metric (A could never win), and could clear the outcome engine's sample-size thresholds to report "moderate" confidence for a rounding artifact | Real bug — fabricated evidence, the single most important finding | Both buckets now receive the identical value; the outcome engine's existing exact-tie branch applies honestly (always inconclusive, confidence capped at early) |
| `related_campaign_id`, if supplied, was inserted with no ownership check at all — a client could cite another tenant's campaign ID and it would be stored as this experiment's authoritative link | Cross-tenant data-integrity gap | `proposeExperimentForBusiness` now validates the campaign belongs to the same business before insert |
| The linked recommendation's `status` was never checked — a dismissed, completed, or superseded recommendation could still originate a new experiment | Matches the explicit "state requirements are enforced" review requirement | Only `status = "open"` recommendations are eligible; others are rejected with a clear error |
| RLS's "own rows" update policy is ownership-only and cannot express "status may only move forward one step" — a user with their own session JWT could call Supabase directly and set status straight to `completed` with a fabricated outcome, or move a completed/archived experiment back to `running`, bypassing the app entirely | Matches the explicit "authenticated users cannot bypass lifecycle rules through direct table writes" review requirement | Added a `before update` trigger (`enforce_marketing_experiment_transition`) enforcing the same linear state machine at the database layer |
| `completeExperimentMeasurement` accepted `running` as well as `measuring`, silently completing an experiment that had never actually been measured (outcome/metrics left at their empty/insufficient defaults) | Lifecycle-integrity bug — skips a required step in the declared state machine | Only `measuring` may complete; `experiment-service.ts` also rejects the invalid request with `409` before reaching the pure function |
| `measureExperimentForUser` had no status guard — it could be called on a draft (before the experiment had started) or on an already-completed/archived experiment, silently overwriting historical, already-recorded results without creating a new observation | Matches "Measuring cannot occur before Running" / "completed outcomes can be reused safely if immutable" | Both the service layer and the pure `applyExperimentMeasurement` function now reject measurement outside `running`/`measuring` |
| The `experiment_completed` Marketing Memory observation nested variant summary, measured outcome, and supporting metrics as objects/arrays — but the shared `sanitizeMetricSummary` allowlist only preserves top-level scalars and silently drops anything nested. The stored observation was missing exactly the fields the PR's own documentation said it recorded | Real bug — the claimed evidence-capture feature did not actually capture the evidence | Flattened to 12 scalar fields (within the sanitizer's key cap) covering every category the review requires: type, variant summary, outcome, confidence, primary-metric values, recommendation/campaign linkage |
| Client-supplied `hypothesis` was unbounded free text | Minor — defensive input bounding | Rejected above 280 characters rather than silently truncated |
| `marketingDirectorDecisionKey`/`proposedBy` are accepted as opaque client-supplied strings with no server-side recomputation against an actual Marketing Director decision — `buildExperimentProposalFromDirectorDecision` (the only code that derives a real key) is called by tests only, never by production code | Real gap in the PR's headline claimed feature ("Marketing Director-gated experiments") | **Not fixed** — closing this requires deciding when/for which recommendations Marketing Director should propose an experiment, a product decision with no existing precedent to build on. Documented prominently above and in the review report. No UI path reaches this endpoint today, so the gap is not currently reachable through the product |

**Confirmed correct on inspection, no fix needed:** recommendation and (now) campaign tenant ownership are checked server-side before every insert; `business_profile_id` is always server-derived via `getBusinessProfileForUser()`, never client input; the API is command-style (`advance`/`measure`/`complete`), not generic PATCH, so arbitrary status/metric/winner/confidence injection from the browser is structurally impossible; outcome math correctly handles divide-by-zero, ties, and zero baselines; no LLM/ML/new provider/schedule was added; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` untouched and `false`; zero diff in `lib/marketing-director/resolveDecision.ts`, `lib/marketing-decisions/`, `lib/campaign-intelligence/`, `lib/publishing-queue/`, `lib/content-approval/`; no per-card N+1 queries (dashboard batches active/completed via `Promise.all`); no duplicate Marketing Director/Executive Brief resolve (Experiments dashboard is fetched alongside the existing HoM briefing batch, not a second call); the Experiments section UI has no create/edit/launch control of any kind (read-only display only) and uses the established accessible-disclosure pattern (`aria-expanded`/`aria-controls`, no color-only status signaling).

### Manual smoke-test steps (not run — no authenticated session in this environment)

No seeded test-user credentials are available in this environment. The Playwright coverage above only exercises the unauthenticated redirect and static file-content assertions. The following steps were **not executed**; this is not a claim that the authenticated path passed. A human with a real login should verify:

1. Log in, open **Head of Marketing** (`/dashboard`). Confirm an "Experiments" section renders between Campaigns and the Strategic Calendar preview, with "Active" and "Completed" subsections and useful empty-state copy (since no experiment can currently be created through the UI, both should show their empty states).
2. Confirm there is no create/launch/edit control anywhere in the Experiments section — it should be purely a read display.
3. If any experiment rows exist (e.g. seeded directly in the database for testing), confirm: status is shown as text (not color-only), "Show variants" toggles a disclosure panel with visible focus states, the outcome/confidence text reads honestly (no "Strong signal" claims for what should be an inconclusive result), and the recommendation/campaign linkage snippets render without throwing.
4. Confirm the **Strategic Marketing Calendar**, **Interactive Head of Marketing** (Ask panel), and **Executive Brief** sections on the same page still load and function normally — this PR batches a new `getExperimentDashboardForBusiness` call into the same HoM data-fetch as those features.
5. Directly call `POST /api/experiments` with a valid session but a fabricated `marketingDirectorDecisionKey` (e.g. `"x"`) citing one of your own **open** recommendations — confirm it currently succeeds (this is the documented, not-yet-closed gap above, not a regression from this review).
6. Directly call `POST /api/experiments/{id}` with `{"action":"complete"}` on an experiment not in `measuring` status — confirm it returns `409`, not a silent success.
