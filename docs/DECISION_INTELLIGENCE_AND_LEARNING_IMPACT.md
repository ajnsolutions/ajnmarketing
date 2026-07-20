# Decision Intelligence & Learning Impact

**Project Magic Phase 2F.** Makes AJN Marketing's learning loop visible, explainable, and auditable. This is an explanation and traceability layer over existing authoritative records — it is not a second strategic planner.

## Purpose

Answers, from existing evidence only:

- What has AJN Marketing learned?
- What evidence supports that learning?
- Which recommendations or campaigns produced the evidence?
- Which customer preferences affected the plan?
- Why did a Marketing Director priority change?
- Did an experiment affect a later decision?
- Which conclusions are strong, developing, inconclusive, or overridden?
- What changed since last week or last month?
- What is still uncertain?
- What evidence was intentionally ignored (weak, stale, prohibited, or overridden)?

## Marketing Director authority boundary

Marketing Director (`lib/marketing-director/resolveDecision.ts`) remains the only strategic decision-maker. Decision Intelligence:

**May:** trace existing decisions to existing evidence; normalize decision history; explain why priorities changed; show how preferences/overrides/observations/experiments/campaigns influenced (or didn't influence) a decision; compare historical decisions; identify insufficient, superseded, or overridden evidence; display confidence and recency honestly.

**Never:** create or reprioritize recommendations; create or approve or launch campaigns/experiments; modify Marketing Memory (write an observation, promote a learning, create a preference or override); modify Brand Voice or goals; publish or approve content; schedule work; alter a Marketing Director decision; invent causal claims; infer attribution that doesn't exist; use an LLM to manufacture explanations.

This is a deterministic read and presentation system, verified by `unit-tests/decision-intelligence-service.test.ts`'s regression test grepping the service/snapshot modules for any recommendation/campaign/experiment/memory-write function name.

## Where Marketing Director decisions actually live

There is no `marketing_director_decisions` table anywhere in this schema. `resolveDecision.ts`'s own doc comment: "Nothing here re-scores a recommendation, calls OpenAI, or writes to the database" — every `MarketingDirectorDecision` is computed fresh per request and never persisted.

`docs/MARKETING_MEMORY_DATA_MODEL.md` §7 had already designed exactly the table this phase needed — `marketing_memory_decision_links`, described there as "Phase 4... an audit-trail record of one MarketingDirectorDecision actually computed for a customer... not a new decision-making table." This phase implements that design (extended with fields this phase's comparison/evidence-trace requirements need) rather than inventing a differently-named parallel concept. `marketing_memory_overrides.decision_link_id` (added nullable-without-FK in migration 026, specifically "so Phase 3 can ship first" per that migration's own comment) is now FK'd to it.

## Source-of-truth map

| Concern | Owner | Notes |
|---|---|---|
| What Marketing Director decided | `resolveMarketingDirectorDecision()` (unchanged) | Computed fresh per request; Decision Intelligence never recomputes it |
| Durable record that a decision happened | `marketing_memory_decision_links` | Server-authored snapshot of the above, this phase |
| Which learnings/preferences a decision consulted | `consulted_learning_ids`/`consulted_preference_ids` (explicit UUID arrays) | Sourced from `lib/marketing-director/memoryComposition.ts`'s `appliedPreferenceIds`/`consideredLearningIds` — a small additive change (Phase B) that exposes IDs already available in-memory but not previously threaded into the decision's output |
| Which learning/preference/override evidence exists | `marketing_memory_learnings`/`preferences`/`overrides` (unchanged) | Read-only |
| Which campaign/experiment produced a learning's supporting evidence | Two-hop join: `marketing_memory_evidence_links` (`learning_id` → `source_id` where `source_type='observation'`) → `marketing_memory_observations.source_campaign_id`/`source_experiment_id` | Explicit IDs only, never title matching |
| Experiment lifecycle/outcome | `marketing_experiments`/`marketing_experiment_proposals` (unchanged, Phase 2E) | Outcome always honest: no winner, confidence capped at early |
| Calendar presentation | `lib/strategic-marketing-calendar/` (unchanged engine, new normalizer added) | Decision events are informational only, never scheduled work |

## Decision persistence

`marketing_memory_decision_links` (migration 030). Columns beyond the Phase 4 proposal's original set: `ignored_evidence` (bounded jsonb, ≤10 entries — what was excluded and why), `input_fingerprint` (replaces the simpler `idempotency_key` concept with a content hash so a changed decision on the same day still produces a new row), `decision_status`/`supersedes_decision_id` (explicit supersession chain).

- **Server-authored:** written only by `lib/decision-intelligence/snapshotService.ts`, called from `lib/head-of-marketing/service.ts` using the already-computed `MarketingDirectorDecision` (no second `resolveMarketingDirectorDecision` call).
- **Tenant-scoped:** every read/write filters by `user_id`/`business_profile_id`.
- **Immutable except supersession:** a `before update` trigger (`enforce_marketing_memory_decision_links_immutable`) allows only `decision_status: active → superseded`; every other column is frozen after insert.
- **Idempotent:** `unique (business_profile_id, input_fingerprint)`. `computeDecisionInputFingerprint` (`lib/decision-intelligence/fingerprint.ts`) hashes only the decision-relevant fields (never a raw prompt, never chain-of-thought). Identical decisions → identical fingerprint → the existing row is returned, not duplicated. A changed decision → a new fingerprint → a new row, and the prior active row for that business is superseded.
- **Protected from direct authenticated writes of arbitrary content:** RLS permits `insert`/`select`/`update` for the owning tenant (the same session-scoped-client pattern already established for `marketing_memory_observations`/`context_snapshots`, migration 024 — not the service-role-only pattern used for `marketing_experiment_proposals` in migration 029, since a decision snapshot is a passive record of an already-computed decision, not an independent determination a client could fake authority over). The immutability trigger is what actually prevents a client from rewriting a snapshot's facts after the fact.
- **Queryable by business and time range:** indexed on `(business_profile_id, evaluated_at desc)`, plus GIN indexes on the two consulted-ID arrays.

Migrations: `028_marketing_experimentation.sql`, `029_marketing_experiment_proposals.sql` (both pre-existing, unmodified), `030_decision_intelligence.sql` (this phase — additive only; verified against the repository before assuming 030 was free).

## Evidence trace model

`DecisionEvidenceTrace` (`lib/decision-intelligence/types.ts`) is computed at **read time** from the explicit IDs already on a decision snapshot — never a separately persisted table, never fuzzy title matching. If a snapshot has no explicit ID for something, the trace says so ("No explicit evidence link is available for this historical decision") rather than inferring one.

Supported evidence types (closed allowlist, `DecisionEvidenceTypes`): `recommendation`, `recommendation_outcome`, `campaign`, `campaign_completion`, `experiment_proposal`, `experiment_completion`, `marketing_memory_observation`, `marketing_memory_learning`, `marketing_memory_preference`, `marketing_memory_override`, `market_context`. Every type is backed by an existing product record — none is fabricated.

Never exposed: internal scores, raw weighting, unrestricted metadata, raw analytics payloads, service-role details, private audit records, database policy details, internal stack traces. `buildEvidenceTraceForSnapshot` (`lib/decision-intelligence/evidenceTrace.ts`) only selects the specific narrow columns each trace needs.

## Relationship allowlist

Centralized in `lib/decision-intelligence/relationships.ts` / `types.ts`'s `DecisionEvidenceRelationshipTypes`: `based_on`, `supported_by`, `constrained_by`, `overridden_by`, `superseded_by`, `informed_by`, `measured_by`, `produced_observation`, `promoted_to_learning`, `linked_to_campaign`, `linked_to_experiment`, `linked_to_recommendation`, `excluded_due_to_low_confidence`, `excluded_due_to_staleness`, `excluded_due_to_customer_override`, `excluded_due_to_prohibition`, `excluded_due_to_insufficient_attribution`. `isAllowedRelationshipType`/`isAllowedEvidenceType` reject anything outside these sets — no caller may construct a trace with an arbitrary relationship string.

## Decision comparison

`compareDecisionSnapshots` (`lib/decision-intelligence/comparisonEngine.ts`) — pure, no I/O, no current-time dependency (only `evaluatedAt` on the snapshots is used). Compares two snapshots by stable ID, never by title. Evidence is diffed by `(evidenceType, evidenceId)` pairs between the current and previous snapshot's traces.

Change types: `added`, `removed`, `increased_priority`, `decreased_priority`, `unchanged`, `deferred`, `superseded`, `completed`, `blocked`, `evidence_strengthened`, `evidence_weakened`, `customer_override_applied`, `insufficient_evidence`.

**Known limitation:** `preferenceImpact`/`campaignImpact` are computed directly from the ID diff (accurate). `experimentImpact`/`overrideImpact`/`analyticsImpact` are conservatively `false` in the comparison output — establishing them precisely requires traversing beyond what a decision snapshot directly references (e.g. whether a newly-applied learning's supporting observation traces back to an experiment). That deeper attribution **is** computed, just at the per-learning level in `learningImpact.ts` (`LearningImpactSummary.relatedExperimentIds`/`relatedCampaignIds`), not duplicated into the pairwise comparison. When new learnings are added, the comparison's `limitations[]` array says so explicitly, pointing at the Learning Impact panel instead of guessing.

If no previous snapshot exists, `certainty: "no_safe_comparison"` — the UI and Interactive HoM both surface this honestly rather than fabricating a "first" comparison.

## Explanation templates

`lib/decision-intelligence/explanations.ts` — deterministic string templates only, no LLM. `buildChangeExplanation` grounds every sentence in the evidence actually passed in. Correlation is never described as causation — no explanation ever uses "caused" (verified: `unit-tests/decision-intelligence-core.test.ts` asserts this directly). Also provides `explainPrecedence`, `explainIgnoredEvidence`, `explainInconclusiveExperiment`, `explainCampaignInfluence`, `explainTemporaryOverride` — one function per customer-facing explanation shape the design brief specified.

## Learning impact

`buildLearningImpactSummaries` (`lib/decision-intelligence/learningImpact.ts`) produces one `LearningImpactSummary` per learning, preference, and override. "Did this learning influence a decision?" is answered only from an explicit recorded relationship — whether the learning's ID appears in any decision snapshot's `consulted_learning_ids` — **never** inferred from close timestamps. "Did an experiment contribute evidence to this learning?" is answered via an explicit two-hop join (learning → its supporting `marketing_memory_evidence_links` rows where `source_type='observation'` → those observations' `source_campaign_id`/`source_experiment_id`), never by matching titles or dates.

## Experiment limitations (honest representation)

Phase 2E's experiments have no per-variant attribution: aggregate analytics only, no winner, confidence capped at `early`, result always `inconclusive`. Decision Intelligence never overstates this. It shows: the experiment was proposed by Marketing Director (via a persisted proposal), approved by the user, its lifecycle, its aggregate measurement period, its inconclusive outcome, whether it produced a Marketing Memory observation, and whether that observation later contributed to a learning that influenced a later decision. It never shows a winning variant, a conversion lift by variant, statistical significance, or a causal claim — none of that exists in the underlying data (see [`MARKETING_EXPERIMENTATION_ENGINE.md`](./MARKETING_EXPERIMENTATION_ENGINE.md)).

## Campaign influence

A campaign is shown as influential only when its completion produced a Marketing Memory observation that is traceable, via the same explicit two-hop join above, to a learning. If a campaign completed but its observation has not been promoted into a learning, Decision Intelligence says exactly that ("recorded an observation, but that observation has not yet been promoted into a learning that could influence a later decision") rather than implying influence that hasn't happened yet.

## Customer preference and override impact

Precedence is **unchanged** (`lib/marketing-director/memoryComposition.ts`): compliance → customer prohibitions → explicit preferences → goals (rationale only) → strong learnings → developing learnings → early learnings → market context → existing order. Decision Intelligence only explains this ordering (`explainPrecedence`); it never changes it. Brand Voice, goals, prohibitions, permanent preferences, temporary overrides, learned patterns, and market context are always labeled distinctly in every UI surface — never collapsed into one generic "evidence" bucket that would let a customer mistake an override for a permanent preference or a learning for an approved instruction.

## Tenant isolation

Every persistence function in `lib/decision-intelligence/persistence.ts` filters by `user_id` **and** `business_profile_id`. `buildEvidenceTraceForSnapshot`'s batched lookups (recommendation, campaign, learnings, preferences) all include `.eq("business_profile_id", businessProfileId)` — verified directly in `unit-tests/decision-intelligence-service.test.ts`. The API routes never trust a client-supplied business ID — `getBusinessProfileForUser()` re-derives it from the authenticated session server-side, matching every other Phase 2 API in this codebase.

## Database protections

- RLS enabled on `marketing_memory_decision_links`; `select`/`insert`/`update` scoped to `auth.uid() = user_id`.
- Immutability trigger (`enforce_marketing_memory_decision_links_immutable`) — only `decision_status` may change, and only `active → superseded`. RLS alone cannot express this (it's ownership-only); the trigger is what actually stops a client from rewriting a snapshot's recorded facts, matching the same "RLS for ownership + trigger for semantic guard" pattern established in migrations 028/029.
- `marketing_memory_decision_links_no_self_supersession` — a decision can never claim to supersede itself.
- FK retrofit on `marketing_memory_overrides.decision_link_id` (additive, non-destructive — existing null values remain valid).

**Not yet enforced at the database layer:** which learnings/preferences a snapshot may cite in `consulted_learning_ids`/`consulted_preference_ids` (no FK possible on array columns without a join table, and no application code ever populates these from arbitrary/untrusted input — they come only from `memoryComposition.ts`'s already-computed evidence set). Documented here rather than silently assumed safe.

## API

Four read-only, GET-only endpoints (`app/api/decision-intelligence/`):

- `GET /api/decision-intelligence` — current decision, evidence trace, current-vs-previous comparison, learning impact, bounded timeline.
- `GET /api/decision-intelligence/history?start=&end=&limit=` — bounded decision-snapshot history (date range capped at 366 days, limit capped at 100).
- `GET /api/decision-intelligence/changes?currentDecisionId=&previousDecisionId=` — explicit comparison between two decisions (UUID-validated).
- `GET /api/decision-intelligence/evidence?decisionId=` — evidence trace for one historical decision (UUID-validated).

All four: authentication required (401 otherwise); business authorization server-resolved (browser business ID never trusted); no mutation methods exported (Next.js rejects anything but GET automatically); safe error messages (`lib/security/safe-error-message.ts` conventions followed); client-safe normalized output only.

## Server/client boundary

`lib/decision-intelligence/*.ts` (except `types.ts`/`relationships.ts`/`fingerprint.ts`/`comparisonEngine.ts`/`explanations.ts`, which are pure) are `server-only`. `components/dashboard/decision-intelligence-page.tsx` and `why-plan-changed-section.tsx` receive already-computed, client-safe props from their server-rendered parent routes — neither imports a server-only module. Detail links (`sourceTarget`) are drawn only from `relationships.ts`'s allowlisted route map — never an arbitrary URL.

## Determinism

Identical authoritative inputs produce identical fingerprints, evidence traces, comparisons, explanation text, and Interactive HoM answers — verified directly (`unit-tests/decision-intelligence-core.test.ts`, `-integration.test.ts`). No `Date.now()`/`new Date()` inside pure functions — `now` is always an injected parameter with a default, matching the Strategic Calendar's established convention. Evidence-array ordering inside the fingerprint basis is sorted before hashing, so consulted-ID order never affects the result.

## Partial failures

`getDecisionIntelligenceSummaryForBusiness` wraps every optional source read in `safeSourceRead`, which catches a failure and appends a `DecisionIntelligenceWarning` rather than throwing. One source failing (e.g. learnings unavailable) never blanks the whole summary — verified with a test that fails five of six optional sources simultaneously and confirms the call still returns a usable summary. `recordDecisionSnapshotForCurrentUser` is fully best-effort: any failure is caught, logged, and the HoM page renders normally regardless. The UI's `WhyPlanChangedSection` and the dedicated page both render a `role="status"` notice when `warnings.length > 0`, rather than silently showing partial data as if it were complete.

## Performance

- One batched `Promise.all` per summary request (recommendation/campaign/learnings/preferences/overrides/experiments), no per-decision or per-evidence N+1 query.
- Snapshot recording reuses the `MarketingDirectorDecision` already computed by `buildWeeklyBriefing` — no second `resolveMarketingDirectorDecision` call, no second Executive Brief rebuild.
- The Strategic Calendar's decision-intelligence timeline reuses the same `DecisionIntelligenceSummary` already computed for the HoM page's "Why the Plan Changed" preview in the same request — not a second fetch — when rendered together; the standalone `/dashboard/strategic-marketing-calendar` page's own independent `loadCalendarSources` batch fetches it once via `Promise.allSettled`, matching how campaigns/publishing/approvals are already independently loaded there.
- History/timeline queries are bounded (`limit` capped at 100–200) and indexed on `(business_profile_id, evaluated_at desc)`. Learning Impact is capped at the 50 most-recently-evaluated learnings (`MAX_LEARNINGS_FOR_IMPACT`) — each learning triggers two additional batched-but-concurrent lookups (`evidence_links` + `observations`) for campaign/experiment attribution, which is unbounded work without this cap since `getLearningsForBusiness` itself has no limit.
- No background schedule, no unrestricted history export.

## Accessibility

Logical heading hierarchy (`h1`→`h2`, one per section); evidence/learning-impact disclosure buttons use `aria-expanded`/`aria-controls` (matching the Experiments section's established pattern); confidence/influence/recency states are always rendered as text, never color-only; the timeline is a semantic ordered list (`<ol>`), not a purely visual line; partial-failure and stale-data notices use `role="status"`; no editing controls exist anywhere on either surface.

## Migrations

Apply in order: `028_marketing_experimentation.sql` → `029_marketing_experiment_proposals.sql` → `030_decision_intelligence.sql`. 030 is purely additive: one new table, indexes, RLS policies, two triggers, and one FK retrofit on an existing nullable column. No existing migration is rewritten.

## Non-goals (this phase)

No LLM. No ML. No vector search or embeddings. No new analytics provider. No statistical-significance claims. No causal inference beyond explicit recorded relationships. No second recommendation engine or strategic planner. No automatic recommendation/campaign/experiment creation or approval. No autonomous publishing. No preference auto-promotion outside the existing Marketing Memory rules. No external BI/CRM/calendar integrations. No customer-facing raw audit log export. No background schedule; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

## Future extension points

- **Deeper comparison attribution:** compute `experimentImpact`/`overrideImpact`/`analyticsImpact` directly in `compareDecisionSnapshots` once a clear, non-fuzzy way to attribute a rank change to a specific experiment/override exists (today this is available per-learning in Learning Impact, not per-comparison).
- **Real per-variant experiment attribution:** once publishing output is tagged with its originating experiment variant (see `MARKETING_EXPERIMENTATION_ENGINE.md`'s "Future attribution boundary"), Decision Intelligence can honestly show a winning variant's influence.
- **Cursor-based history pagination:** the current `history` endpoint uses `start`/`end`/`limit`; a stable cursor could be added if a business accumulates enough decision history for offset drift to matter.
- **Arbitrary two-decision comparison UI:** `/api/decision-intelligence/changes` already supports comparing any two decisions by ID; the dedicated page currently only surfaces current-vs-previous. A history browser with an explicit picker is a natural next UI increment.

## Manual smoke-test checklist (not run — no authenticated session in this environment)

No seeded test-user credentials are available in this environment. Automated coverage (unit + Playwright) exercises unauthenticated rejection, pure-function determinism, and static file-content assertions only. The following steps were **not executed**; this is not a claim that the authenticated path passed. A human with a real login should verify:

1. Log in, open **Head of Marketing** (`/dashboard`). Confirm a "Why the plan changed" section renders between Experiments and the Strategic Calendar preview. On a brand-new business with no decision history yet, confirm it shows "Not enough decision history yet to explain what changed" rather than an error or a fabricated "no changes" message.
2. Reload the page a few times in a row. Confirm no duplicate decision snapshots accumulate (check via `GET /api/decision-intelligence/history` — the count should not grow on every reload, only when the underlying decision actually changes).
3. Open `/dashboard/decision-intelligence`. Confirm "Current decision", "What changed", "Learning impact", and "Decision timeline" sections all render, "Show evidence" expands/collapses with visible focus, and there is no create/edit control anywhere on the page.
4. If an experiment has completed for this business, confirm its evidence trace / timeline entry reads "Aggregate performance observed... variant attribution unavailable... inconclusive" — never a winner or a percentage lift.
5. If a campaign has completed and its observation was promoted into a learning, confirm the Learning Impact panel shows `relatedCampaignIds` for that learning and marks it as having influenced a later decision; if not yet promoted, confirm the honest "not yet promoted" wording instead.
6. Open the **Interactive Head of Marketing** panel and ask "Why did the plan change?" and "What evidence was ignored?". Confirm both return a grounded, deterministic answer (or an honest "not enough evidence" disclosure) — never a fabricated reason.
7. Open the **Strategic Marketing Calendar**. Confirm any decision-intelligence events (decision generated, experiment approved/completed, learning promoted, override recorded) render visually distinct from scheduled publishing/campaign work, and clicking one does not open any mutation control.
8. Confirm **Executive Brief**, **Campaigns**, and **Experiments** sections on the same Head of Marketing page still render and function normally — this phase batches new reads into the same page load.
9. Confirm no schedule/cron was activated anywhere in the environment as a side effect of any of the above.

## Production smoke-test checklist (if no local authenticated session is ever available)

1. As a real customer, load the Head of Marketing dashboard at least twice on two different days; confirm "Why the plan changed" reflects a real difference (or an honest "unchanged") between the two visits.
2. Confirm the full Decision Intelligence page loads under 2 seconds on a business with a few months of history (verifies the bounded-query/indexing claims in "Performance" above).
3. Confirm database inspection (via Supabase dashboard, read-only) shows `marketing_memory_decision_links` rows are never modified except `decision_status` flipping to `superseded` — every other column should be identical to its original insert.
