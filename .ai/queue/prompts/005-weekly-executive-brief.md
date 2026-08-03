# Task 005 — Weekly Executive Brief: Market Radar section

> This is a REAL queue task (`status: pending` in `RUN_QUEUE.yaml`), not a documentation example. It was reviewed and approved by a human before being added to the queue. It still must not need real-time human judgment to execute safely — if anything below turns out to be ambiguous once you're in the code, stop per the "When requirements are ambiguous" rule and do not guess.

## Depends on Task 003

This task's branch (`ai-queue/005-weekly-executive-brief`) is created from Task 003's branch tip (or `main`, if Task 003 has since merged — the queue runner's dependency-base resolution handles this automatically; see `.ai/DECISIONS.md` ADR-0015), because this task reads `lib/competitor-observations/` (Task 003's persistence layer) to populate a new brief section. Confirm `lib/competitor-observations/types.ts` and `lib/competitor-observations/persistence.ts` are actually present in your checkout before starting. This task does **not** depend on Task 002 or Task 004 — it does not import their files, and is an independent consumer of Task 003's data (siblings, not a chain).

## Before you start

1. Read `AGENTS.md` in full.
2. Read every file under `.ai/`: `CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`.
3. Read `docs/EXECUTIVE_BRIEFING_ENGINE.md` in full — the existing product/architecture doc for this system.
4. Read `lib/executive-briefing/types.ts` in full, especially `ExecutiveBrief`, `ExecutiveBriefItem` (`{ text: string }` — deliberately flat, no "why it matters"/"suggested action" fields), `ExecutiveBriefType`/`ExecutiveBriefTypes` (three variants: `morning_brief`, `weekly_strategy_brief`, `monthly_executive_report` — "Weekly Executive Brief" in this task's title refers specifically to `weekly_strategy_brief`), and `ExecutiveSupportingEvidence`/`ExecutiveEvidenceKinds`.
5. Read `lib/executive-briefing/buildBrief.ts` in full, especially `BuildExecutiveBriefInput`, the existing `build*` functions (`buildSummary`, `buildTopPriorities`, `buildWins`, `buildWatchItems`, `buildToday`, `buildRecentChanges`, `buildSupportingEvidence`), `buildExecutiveBrief`, and `buildWeeklyStrategyBrief`. Note its own header comment: "Summarize existing signals + Marketing Director decision — never re-prioritize, never invent recommendations." This task must respect that same discipline: it surfaces Task 003's already-scored observations, it does not re-score or re-judge them.
6. Read `lib/executive-briefing/service.ts` and trace `getExecutiveBriefForCurrentUser` → `getHeadOfMarketingBriefingForCurrentUser` (`lib/head-of-marketing/service.ts`) to find the actual site where a real `BuildExecutiveBriefInput` gets assembled from live data before being passed into `buildWeeklyStrategyBrief`. This is the file you will need to touch to fetch and thread Task 003's observations through — confirm its exact location and shape yourself rather than assuming; this prompt intentionally does not name it with certainty since it was not fully traced when this prompt was written.
7. Read `lib/competitor-observations/types.ts` and `lib/competitor-observations/persistence.ts` (Task 003) in full, especially `listCompetitorObservationsForUser` and the `CompetitorObservation`/`CompetitorObservationConfidence` shapes.
8. Read `components/dashboard/executive-brief-section.tsx` (the UI that renders an `ExecutiveBrief`) to understand how existing sections (`topPriorities`, `wins`, `watchItems`, `recentChanges`) are rendered, so a new section follows the same visual/structural convention.
9. Verify all of the above against the actual repository state before writing any code.

## Objective

Add a Market Radar section to the **weekly** Executive Brief (`weekly_strategy_brief` only — not the morning brief, not the monthly report) surfacing Task 003's confirmed competitor observations in a richer shape than the existing flat `ExecutiveBriefItem`: each entry needs a plain-language observation, **why it matters**, and a **suggested action** — none of which the existing `{ text: string }` shape carries. This is a genuinely new, additive field on the brief, not a repurposing of an existing one.

## Scope — exactly these changes

1. **`lib/executive-briefing/types.ts`**: add a new type, e.g. `ExecutiveMarketRadarHighlight = { observation: string; whyItMatters: string; suggestedAction: string; confidence: CompetitorObservationConfidence }` (import `CompetitorObservationConfidence` from `lib/competitor-observations/types.ts`), and add a new field to `ExecutiveBrief`, e.g. `marketRadarHighlights: ExecutiveMarketRadarHighlight[]` (always present, empty array when there is nothing to show — never omitted, so every existing consumer of `ExecutiveBrief` keeps working without an `undefined` check added everywhere). Follow this repo's existing naming/const-object conventions for any new enum-like value you introduce.
2. **`lib/executive-briefing/buildBrief.ts`**: add `marketRadarObservations?: CompetitorObservation[]` to `BuildExecutiveBriefInput` (optional — the morning brief and monthly report will not pass it, matching this section being weekly-only). Add a new pure `buildMarketRadarHighlights(input: BuildExecutiveBriefInput): ExecutiveMarketRadarHighlight[]` function: returns `[]` if `input.briefType !== ExecutiveBriefTypes.WEEKLY_STRATEGY` or if `marketRadarObservations` is absent/empty; otherwise maps each observation into an `ExecutiveMarketRadarHighlight`. Do not invent "why it matters" or "suggested action" text disconnected from the observation itself — derive both deterministically from the observation's own fields (e.g. its confidence and which tracked competitor it's about), and if you cannot honestly generate a specific, non-generic suggested action for a given observation, prefer a calm, generic-but-honest fallback (e.g. "Review this observation before your next planning session") over inventing false specificity. Wire the new function's output into `buildExecutiveBrief`'s returned object and into `buildWeeklyStrategyBrief`.
3. **The real-data assembly site** (found in step 6 of "Before you start"): fetch the current user's competitor observations via Task 003's `listCompetitorObservationsForUser` and pass them into the weekly brief's `BuildExecutiveBriefInput` as `marketRadarObservations`. Do not fetch them for the morning brief or monthly report paths.
4. **`components/dashboard/executive-brief-section.tsx`**: render `marketRadarHighlights` as a new section, following the exact visual/structural pattern of the existing sections (e.g. `recentChanges`), shown only when the array is non-empty (an empty array should simply not render the section — no empty-state placeholder needed here, unlike Task 002/004's dedicated pages, since this is one section within a larger brief that already has its own overall empty/loading handling).
5. **Tests**:
   - Unit tests under `unit-tests/weekly-executive-brief-market-radar.test.ts` (`node:test`/`node:assert` style): `buildMarketRadarHighlights` returns `[]` for `morning_brief` and `monthly_executive_report` even when `marketRadarObservations` is provided; returns `[]` for `weekly_strategy_brief` when `marketRadarObservations` is absent or empty; correctly maps a populated list, preserving confidence; never fabricates a suggested action unrelated to the observation.
   - Extend or add to the existing `unit-tests/executive-briefing-engine.test.ts` if it already has a natural place for `buildExecutiveBrief`/`buildWeeklyStrategyBrief`-level coverage of the new field — check first rather than assuming a new file is always the right home for every test.
6. **Documentation**: extend `docs/EXECUTIVE_BRIEFING_ENGINE.md` and `docs/project-magic/MARKET_RADAR.md`'s "Implementation status" note to record that the weekly brief now surfaces confirmed Market Radar observations. Update `.ai/ROADMAP.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, and `.ai/HANDOFF.md` per `AGENTS.md` — overwrite `HANDOFF.md`, don't append.

## Explicitly out of scope — do not do these

- Any change to the morning brief or monthly executive report's content or behavior.
- Any change to `lib/head-of-marketing-orchestrator/` (`ExecutiveReview`, rendered at `/dashboard/executive-review`) — that is a separate, distinct type from `ExecutiveBrief`, explicitly documented as reshaping existing decisions only ("introduces no scoring, no new recommendation, and no new evidence"); adding a new evidence-bearing section there is out of scope for this task. If a future task wants Market Radar surfaced there too, that is separate, unscoped work.
- Any change to `lib/competitor-observations/persistence.ts` or `types.ts` beyond calling the read function Task 003 already exposes.
- Any re-scoring, re-ranking, or editorializing of Task 003's observations or their confidence levels — this task presents them, it does not judge them differently than Task 003 already did.
- Delivery channels (email, Slack, Teams, mobile push) — `EXECUTIVE_BRIEF_FUTURE_DELIVERY_HOOKS` in `lib/executive-briefing/types.ts` already documents these as unimplemented future work; do not implement any of them here.

## Standing rules (restated from AGENTS.md — read AGENTS.md itself for full context)

- Never merge a pull request automatically.
- Never deploy, or trigger/configure a deployment, automatically.
- Never modify secrets, environment values, credentials, or API keys.
- Never apply a production (or any) database migration automatically — this task should not need a new migration at all; if it seems to, stop.
- Never activate a production schedule. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` in `lib/trigger/scheduleActivation.ts` must remain `false`; do not touch that file.
- Never weaken, skip, bypass, disable, or delete a meaningful test to make a quality gate pass.
- If any requirement above turns out to be materially ambiguous once you're actually working in the code, stop. Record the specific ambiguity and what you'd need to know in both `.ai/OPEN_ITEMS.md` (as a blocker) and `.ai/HANDOFF.md` (as the reason work stopped), then end the task cleanly — do not half-implement a guess.

## Workflow requirements

- Use the feature branch `ai-queue/005-weekly-executive-brief`, created from Task 003's branch tip (or `main`, if Task 003 has since merged — do not create it from Task 004's branch).
- Batch related, safe shell operations together before executing them; minimize approval prompts by grouping safe commands and avoiding unnecessary shell invocations.
- Run autonomously through the full task without pausing for routine, non-destructive Bash approvals. Batch and defer any approval-requiring shell commands until the end whenever safely possible, then present the minimal grouped approval set once — but do not defer an approval that is required to proceed safely, and pause before any destructive or irreversible operation.
- Implement only the defined phase above.
- Run the applicable quality gates and fix any regression your own change causes: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npx playwright test` (this task changes rendered UI in `executive-brief-section.tsx`). All meaningful CI-equivalent quality gates must pass. Do not weaken or bypass a test to make one pass.
- Update the affected `.ai/` project-memory files (see step 6 of Scope above) in this same branch — required before the queue runner will consider the task complete.
- Commit your changes, push the branch, and open a pull request against Task 003's branch (or `main`, matching whatever base the queue runner actually resolved — if running this prompt outside the automated runner, use `--base ai-queue/003-competitor-observation-engine` or `--base main` accordingly). Never merge it. Never deploy. Never apply a production migration. Never modify a secret. Never activate a schedule.
- After tests pass and the PR is created, send a macOS notification (if available in your environment) with the branch name and success/failure — if no such notification mechanism is available, say so honestly in your final report instead of silently skipping it.

## Report

At the end, report: branch name, final commit SHA, PR URL (and its base branch), which tests were run and their results, any blockers encountered, and your recommended next action.
