# Task 006 — Integrate Market Radar Evidence into Marketing Director Recommendations

> This is a REAL queue task (`status: pending` in `RUN_QUEUE.yaml`), not a documentation example. It was reviewed and approved by a human before being added to the queue. It still must not need real-time human judgment to execute safely — if anything below turns out to be ambiguous once you're in the code, stop per the "When requirements are ambiguous" rule and do not guess.

## Depends on Task 003 (not 004 or 005)

This task reads `lib/competitor-observations/persistence.ts`'s `listCompetitorObservationsForUser` (Task 003) and `lib/competitor-observations/display.ts`'s `buildWhatChangedItems`/`filterObservationsByConfidence` (Task 004's display helpers, but not Task 004's own UI). It does not depend on Task 004's `/dashboard/business-pulse` route or Task 005's Executive Brief work — both are independent siblings of this task, all three depending only on Task 003.

## Before you start

1. Read `AGENTS.md` in full.
2. Read every file under `.ai/`: `CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`.
3. Read `docs/project-magic/MARKET_RADAR.md`'s "How it surfaces" section — this is the fourth and last of its four originally-planned surfacing points, following the dedicated view (Task 002), Business Pulse (Task 004), and the Weekly Executive Brief (Task 005).
4. Read `docs/CLIENT_RECOMMENDATION_EXPERIENCE.md` in full, especially §4 (deterministic reason translation) — its own text explicitly anticipated and deferred this exact task: `lib/recommendation-presentation/reasonTranslation.ts`'s header comment notes "the task brief's illustrative 'competitor_activity_detected' example does not correspond to any real OpportunityCategory... it is deliberately not implemented here to avoid fabricating a signal the platform doesn't actually produce" — Task 003 is that missing signal source, now real.
5. Read `lib/competitor-observations/types.ts`, `persistence.ts`, `display.ts`, and `confidenceLabels.ts` (Tasks 003/004) in full.
6. Read `lib/recommendation-presentation/types.ts`, `reasonTranslation.ts`, and `service.ts` in full — this is the customer-facing recommendation-presentation layer this task extends, not `lib/decision-intelligence/`'s `DecisionEvidenceTrace` (a decision-change audit trail, a different concern) and not `lib/marketing-director/`'s own candidate-generation code (out of scope — this task does not redesign Marketing Director).
7. Verify all of the above against the actual repository state before writing any code.

## Objective

Complete Market Radar's fourth and final planned "How it surfaces" integration: show real, current, sufficiently-confident competitor observations as supporting business-level context on a Marketing Director recommendation, without ever claiming a specific observation is the specific cause of a specific recommendation (no product concept anywhere in this codebase links the two, and inventing one is out of scope — see "Explicitly out of scope").

## Scope — exactly these changes

1. **`lib/recommendation-presentation/types.ts`** — a new `ClientCompetitorEvidence` type (`{ observation, competitorName, confidenceLabel, confidenceExplanation, sourceLabel }`) and a new `competitorEvidence: ClientCompetitorEvidence[]` field on `ClientRecommendationDecisionPackage` — always present, `[]` when nothing qualifies, matching this repo's established "never omitted" convention (Task 005's `marketRadarHighlights`).
2. **`lib/recommendation-presentation/competitorEvidence.ts`** (new) — a pure `buildCompetitorEvidence(observations, entries, businessProfileId, now?)` function. Reuse, do not reimplement: `buildWhatChangedItems` (relevance — drops an observation whose tracked competitor no longer exists) and `filterObservationsByConfidence` (confidence bar) from `lib/competitor-observations/display.ts`; `confidenceLabelText`/`confidenceExplanation` from `lib/competitor-observations/confidenceLabels.ts` (never `lib/recommendation-presentation/confidenceLabels.ts`'s recommendation-flavored labels — the exact mistake Task 004's own prompt already flagged and avoided). Additionally: filter out stale observations (define and document a concrete day-based cutoff — reuse `lib/marketing-memory/learningConfig.ts`'s `STRONG_PATTERN_MAX_RECENCY_DAYS` value as precedent for "how long a recency-based signal in this codebase stays current," rather than inventing an unrelated number); defensively re-filter by `businessProfileId` (tenant isolation, defense in depth); guard against malformed observations (empty summary or source label); deduplicate to one entry per tracked competitor (keep the most recent); cap the result to a small handful (document the exact number and why).
3. **`lib/recommendation-presentation/service.ts`** — fetch `listCompetitorObservationsForUser` and `listMarketRadarEntriesForUser` once per business (not once per recommendation) in both `getRecommendationDecisionPackageForUser` and `getRecommendationDecisionPackagesForApprovals`'s existing batched `Promise.all` calls, compute `competitorEvidence` once, and thread it into `buildPackage()`'s input and return value.
4. **`components/dashboard/approval-queue.tsx`** — render `competitorEvidence` inside the existing "Why this recommendation" disclosure, only when non-empty, using the plain-language `confidenceLabel` — never the raw `low`/`medium`/`high` value.
5. **Tests**: deterministic unit tests for `buildCompetitorEvidence` covering evidence-present, evidence-absent, stale, duplicate, relevance (competitor no longer tracked), provenance, malformed, and tenant-isolation cases. A Playwright source-level wiring check (matching `tests/market-radar.spec.ts`/`tests/business-pulse.spec.ts`) confirming the new module exists, is genuinely wired into both service call sites (not just defined and unused), the batch site computes it once not per-approval, and the UI never renders a raw confidence value.
6. **Documentation**: extend `docs/project-magic/MARKET_RADAR.md`'s implementation-status note (this is the last of its four surfacing points — say so) and `docs/CLIENT_RECOMMENDATION_EXPERIENCE.md`'s §4/§13. Update `.ai/ROADMAP.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, `.ai/OPEN_ITEMS.md`, and `.ai/HANDOFF.md` per `AGENTS.md` — overwrite `HANDOFF.md`, don't append.

## Explicitly out of scope — do not do these

- New scraping or monitoring providers. No new external data source anywhere — `lib/market-context/providers/competitorProvider.ts` remains the only real signal source, unchanged.
- Database migrations. RLS changes.
- OAuth, billing, secrets, or environment changes.
- Production deployment. Production schedule activation.
- Redesigning Marketing Director — do not touch `lib/marketing-director/`'s candidate-generation or scoring logic, do not add a new `OpportunityCategory` value, and do not build any logic that computationally infers "this recommendation is about competitor X." Competitor evidence is presented as general business-level context, not a causal explanation for any one recommendation — inventing that causal link would require new opportunity-detection logic, which this task is not authorized to add.
- Resolving the separate competing-decision-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`).
- Fixing the separate spoofable rate-limit key (`app/api/interactive-demo/route.ts`).
- Automatic merge.

## Standing rules (restated from AGENTS.md — read AGENTS.md itself for full context)

- Never merge a pull request automatically.
- Never deploy, or trigger/configure a deployment, automatically.
- Never modify secrets, environment values, credentials, or API keys.
- Never apply a production (or any) database migration automatically — this task should not need a new migration at all; if it seems to, stop.
- Never activate a production schedule. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` in `lib/trigger/scheduleActivation.ts` must remain `false`; do not touch that file.
- Never weaken, skip, bypass, disable, or delete a meaningful test to make a quality gate pass.
- If any requirement above turns out to be materially ambiguous once you're actually working in the code, stop. Record the specific ambiguity and what you'd need to know in both `.ai/OPEN_ITEMS.md` (as a blocker) and `.ai/HANDOFF.md` (as the reason work stopped), then end the task cleanly — do not half-implement a guess.

## Project Memory and truthfulness (see `.ai/DECISIONS.md` ADR-0017 for the incident this codifies)

- Before your final commit, update `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, and `.ai/HANDOFF.md` — required every task — plus `.ai/ROADMAP.md`/`.ai/ARCHITECTURE.md`/`.ai/DECISIONS.md`/`.ai/OPEN_ITEMS.md` wherever actually applicable. `HANDOFF.md` is a snapshot, not a log — overwrite it wholesale per its own header, don't append.
- Every claim in your Project Memory update must be truthful: report tests and their real results, never fabricate completion, and never write generic boilerplate in place of a real, specific account of what you built.
- `.ai/STATUS.json` must remain valid JSON. Leave no unresolved Git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in any file you touch.
- You may commit, push, and open the PR yourself, or leave changes uncommitted for the queue's own orchestration to finish — both are supported and neither will duplicate or fight the other's work.
- Never hand-edit `.ai/queue/QUEUE_STATUS.json`'s `status`/`commit`/`pr`/`completed_at` fields — queue completion state is recorded only through the orchestrator's own supported path, never by hand.

## Workflow requirements

- Use the feature branch `ai-queue/006-marketing-director-evidence`, created from `main` (Task 003's dependency resolves to `main` since PR #107 is already merged).
- Batch related, safe shell operations together before executing them; minimize approval prompts by grouping safe commands and avoiding unnecessary shell invocations.
- Run autonomously through the full task without pausing for routine, non-destructive Bash approvals.
- Implement only the defined phase above.
- Run the applicable quality gates and fix any regression your own change causes: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npx playwright test` (this task changes rendered UI in `approval-queue.tsx`). All meaningful CI-equivalent quality gates must pass. Do not weaken or bypass a test to make one pass.
- Update the affected `.ai/` project-memory files (see step 6 of Scope above) in this same branch — required before the queue runner will consider the task complete.
- Commit your changes, push the branch, and open a pull request against `main`. Never merge it. Never deploy. Never apply a production migration. Never modify a secret. Never activate a schedule.
- After tests pass and the PR is created, send a macOS notification (if available in your environment) with the branch name and success/failure.

## Report

At the end, report: branch name, final commit SHA, PR URL, which tests were run and their results, any blockers encountered, any significant implementation decisions (especially the relevance-filtering design, the staleness cutoff, and the decision to use a dedicated field rather than extending `OpportunityCategory`), and your recommended next action.
