# Task 004 — Business Pulse Integration (Market Radar slice)

> This is a REAL queue task (`status: pending` in `RUN_QUEUE.yaml`), not a documentation example. It was reviewed and approved by a human before being added to the queue. It still must not need real-time human judgment to execute safely — if anything below turns out to be ambiguous once you're in the code, stop per the "When requirements are ambiguous" rule and do not guess.

## Depends on Task 003

This task's branch (`ai-queue/004-business-pulse-integration`) is created from Task 003's branch tip (or `main`, if Task 003 has since merged — the queue runner's dependency-base resolution handles this automatically; see `.ai/DECISIONS.md` ADR-0015), because this task renders `lib/competitor-observations/` (Task 003's persistence layer) output. Confirm `lib/competitor-observations/types.ts` and `lib/competitor-observations/persistence.ts` are actually present in your checkout before starting. This task does **not** depend on Task 002 or Task 005 — it does not import their files.

## Before you start

1. Read `AGENTS.md` in full.
2. Read every file under `.ai/`: `CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`.
3. Read `docs/project-magic/BUSINESS_PULSE.md` in full. Read it carefully: it describes "Business Pulse" as an eventual composition of Marketing Health + Growth Momentum, where Growth Momentum itself is meant to eventually draw on Customer Voice, Market Radar, **and** Seasonal Intelligence together, gated (per `.ai/ROADMAP.md`'s Wave IV entry) on those other systems shipping real production signal first. **This task builds only the Market Radar slice** — a "What Changed" view of verified competitor observations, not the full Growth Momentum composition. Do not build Growth Momentum scoring, do not touch Marketing Health, and do not attempt to integrate Customer Voice or Seasonal Intelligence signal — those remain future, separately-scoped work. This is a deliberate, honest narrowing of the doc's larger vision to the one real signal source that exists today (Task 003's observation engine); say so explicitly in the page copy rather than implying this is the complete Business Pulse experience.
4. Read `docs/project-magic/MARKET_RADAR.md`'s "How it surfaces" section (names Business Pulse as one of the four downstream surfaces blocked on the monitoring/detection layer — Task 003 is that layer, now shipped) and its "no fabricated competitive claims" / calm-framing design rules, which apply here exactly as they did to Task 002.
5. Read `lib/competitor-observations/types.ts` and `lib/competitor-observations/persistence.ts` (Task 003) in full, especially `listCompetitorObservationsForUser` and the `CompetitorObservation`/`CompetitorObservationConfidence` shapes.
6. Read `lib/recommendation-presentation/confidenceLabels.ts` (`resolveConfidenceLabel`, `confidenceLabelText`, `confidenceExplanation`) — this repo's established pattern for rendering an internal confidence level as a plain-language, non-numeric label. Follow the same spirit for rendering `CompetitorObservationConfidence` in the UI; do not invent a new confidence-display convention or show a raw score.
7. Read `app/dashboard/market-radar/page.tsx` and `components/dashboard/market-radar-page.tsx` (Task 002) — the closest existing precedent for a simple, calm, owner-facing Project Magic dashboard page reading from one of these `lib/` persistence modules. Follow the same redirect-to-setup-if-no-profile pattern and the same "honest empty state" discipline.
8. Verify all of the above against the actual repository state before writing any code.

## Objective

Build the first real slice of the "Business Pulse" experience described in `docs/project-magic/BUSINESS_PULSE.md`: a page where an owner can see **verified competitor observations** (Task 003's output) in a "What Changed" section, each entry linked to its evidence, with a way to filter by confidence level. This is explicitly a narrow, honest first slice — not the full Marketing Health + Growth Momentum composition the doc ultimately envisions.

## Scope — exactly these changes

1. **A new route**, `app/dashboard/business-pulse/page.tsx`, following the exact redirect-to-setup pattern used by `app/dashboard/market-radar/page.tsx` (Task 002): if there's no business profile, `redirect("/dashboard/setup")`. Fetch observations via Task 003's `listCompetitorObservationsForUser`.
2. **A new component**, `components/dashboard/business-pulse-page.tsx`, rendering:
   - A **"What Changed" section** listing verified competitor observations (summary text, the tracked competitor's name — cross-reference `market_radar_entry_id` back to its `MarketRadarEntry` for display, since the observation table stores only the id), each with its confidence rendered via `confidenceLabelText`/`confidenceExplanation` (never a raw score or raw `low`/`medium`/`high` string).
   - An **evidence link** per observation: at minimum, the observation's `sourceLabel` (real provenance, e.g. "AI profile" or "business profile" per Task 003's source data) displayed inline — not a clickable external link if no real URL exists; never fabricate one. If `lib/competitor-observations/types.ts` carries a real source URL, link it; if not, render the label as plain text. Be honest about what's actually there.
   - **Confidence filtering**: a simple control (matching this repo's existing filter-control conventions — look for a precedent such as a dropdown/segmented-control pattern already used elsewhere in `components/dashboard/`, e.g. in Approval Center or a similar list view, and follow it rather than inventing a new UI pattern) letting the owner narrow the list to `high`-only, `medium`-and-above, or all.
   - An honest empty state when there are zero observations (a business with no tracked competitors, or one whose tracked competitors have no qualifying signal yet, should see a calm, inviting empty state explaining why — e.g. "no verified observations yet" — never an error or a blank page, and never implying monitoring is broken when it's simply that nothing meaningful has been found).
3. **Navigation**: add a link to `/dashboard/business-pulse` in the "More tools" progressive-disclosure list in `components/dashboard/growth-advisor/supporting-context.tsx` (the same array Task 002 added its own entry to), matching the existing entries there exactly. Do **not** add a new primary nav item, per this repo's established bias against adding primary nav items lightly (`docs/project-magic/NAVIGATION_PHILOSOPHY.md`).
4. **Tests**:
   - Unit tests for any pure display/grouping/filtering logic you introduce (e.g. a pure function that filters observations by a minimum confidence threshold, or one that joins an observation to its `MarketRadarEntry` name) under `unit-tests/business-pulse-integration.test.ts`, following this repo's established `node:test` style.
   - A Playwright spec, `tests/business-pulse.spec.ts`, following this repo's established source-level wiring-check style (model it on `tests/market-radar.spec.ts`): confirm the new route/component files exist; confirm the route redirects to setup when there's no business profile; confirm the "More tools" link is present; confirm the page never renders a raw numeric confidence score or a raw `low`/`medium`/`high` string (grep the component source, the same technique `tests/market-radar.spec.ts` used for its "no fabricated activity" check); confirm the cron gate (`ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`) is unchanged.
5. **Documentation**: extend `docs/project-magic/BUSINESS_PULSE.md`'s status (add an "Implementation status" note if one doesn't already exist, following the exact convention `docs/project-magic/MARKET_RADAR.md` uses) recording that the Market Radar slice has shipped and that the full Marketing Health + Growth Momentum composition remains future, gated work. Update `.ai/ROADMAP.md`'s Wave IV / Business Pulse entry, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, and `.ai/HANDOFF.md` per `AGENTS.md` — overwrite `HANDOFF.md`, don't append.

## Explicitly out of scope — do not do these

- Growth Momentum scoring, Marketing Health integration, Customer Voice integration, or Seasonal Intelligence integration — all remain future, separately-scoped work per `.ai/ROADMAP.md`'s Wave IV gate ("depends on Waves I–III shipping with real production signal first").
- Any change to `lib/competitor-observations/persistence.ts` or `types.ts` beyond calling the read function Task 003 already exposes. If you find you need a new persistence function, that's a signal to stop and reconsider scope rather than quietly extending Task 003's foundation from inside this task.
- Any monitoring, scraping, or fabricated evidence link — link only to what Task 003 actually persisted.
- A new primary navigation item.
- A monthly report, digest, or email delivery of any kind — `docs/project-magic/BUSINESS_PULSE.md`'s monthly-report delivery surface is separate, unscoped future work.

## Standing rules (restated from AGENTS.md — read AGENTS.md itself for full context)

- Never merge a pull request automatically.
- Never deploy, or trigger/configure a deployment, automatically.
- Never modify secrets, environment values, credentials, or API keys.
- Never apply a production (or any) database migration automatically — this task should not need a new migration at all; if it seems to, stop.
- Never activate a production schedule. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` in `lib/trigger/scheduleActivation.ts` must remain `false`; do not touch that file.
- Never weaken, skip, bypass, disable, or delete a meaningful test to make a quality gate pass.
- If any requirement above turns out to be materially ambiguous once you're actually working in the code, stop. Record the specific ambiguity and what you'd need to know in both `.ai/OPEN_ITEMS.md` (as a blocker) and `.ai/HANDOFF.md` (as the reason work stopped), then end the task cleanly — do not half-implement a guess.

## Workflow requirements

- Use the feature branch `ai-queue/004-business-pulse-integration`, created from Task 003's branch tip (or `main`, if Task 003 has since merged — do not create it from Task 002's branch).
- Batch related, safe shell operations together before executing them; minimize approval prompts by grouping safe commands and avoiding unnecessary shell invocations.
- Run autonomously through the full task without pausing for routine, non-destructive Bash approvals. Batch and defer any approval-requiring shell commands until the end whenever safely possible, then present the minimal grouped approval set once — but do not defer an approval that is required to proceed safely, and pause before any destructive or irreversible operation.
- Implement only the defined phase above.
- Run the applicable quality gates and fix any regression your own change causes: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npx playwright test` (this task adds UI). All meaningful CI-equivalent quality gates must pass. Do not weaken or bypass a test to make one pass.
- Update the affected `.ai/` project-memory files (see step 5 of Scope above) in this same branch — required before the queue runner will consider the task complete.
- Commit your changes, push the branch, and open a pull request against Task 003's branch (or `main`, matching whatever base the queue runner actually resolved — if running this prompt outside the automated runner, use `--base ai-queue/003-competitor-observation-engine` or `--base main` accordingly). Never merge it. Never deploy. Never apply a production migration. Never modify a secret. Never activate a schedule.
- After tests pass and the PR is created, send a macOS notification (if available in your environment) with the branch name and success/failure — if no such notification mechanism is available, say so honestly in your final report instead of silently skipping it.

## Report

At the end, report: branch name, final commit SHA, PR URL (and its base branch), which tests were run and their results, any blockers encountered, and your recommended next action.
