# Task 002 — Market Radar: owner-facing tracked competitors & benchmarks view

> This is a REAL queue task (`status: pending` in `RUN_QUEUE.yaml`), not a documentation example. It was reviewed and approved by a human before being added to the queue. It still must not need real-time human judgment to execute safely — if anything below turns out to be ambiguous once you're in the code, stop per the "When requirements are ambiguous" rule and do not guess.

## Depends on Task 001

This task's branch (`ai-queue/002-market-radar-view`) is created from Task 001's branch tip (`ai-queue/001-market-radar-foundation`), not from `main` directly — per `RUN_QUEUE.yaml`'s `branch_strategy: stacked`, because this task's UI is built directly against `lib/market-radar/` (types + persistence functions), which Task 001 adds and which do not exist on `main` yet. Confirm `lib/market-radar/types.ts` and `lib/market-radar/persistence.ts` are actually present in your checkout before starting; if they are not (e.g. Task 001 did not complete successfully), stop — this task cannot proceed safely without them, and the queue runner should not have started this task in that state, so treat that as a blocker to record, not something to work around by reimplementing Task 001's scope yourself.

## Before you start

1. Read `AGENTS.md` in full.
2. Read every file under `.ai/`: `CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`. `HANDOFF.md` should currently describe Task 001's completed work — read it for the exact shape of what Task 001 built (function names, table name) before assuming anything.
3. Read `docs/project-magic/MARKET_RADAR.md` (product design — its "How it surfaces" section names a "dedicated Market Radar view... reachable via progressive disclosure... never forced into the primary dashboard", and its "Design rules" section — "no fabricated competitive claims", "calm framing, always" — apply directly to this task) and `docs/project-magic/WIREFRAMES.md`'s "Market Radar" section (the concrete layout: a "Tracking N competitors" list with a `[ Manage → ]` affordance, a separate "Benchmarking" list, and "+ Add a competitor" / "+ Add a benchmark" actions).
4. Read `lib/market-radar/types.ts` and `lib/market-radar/persistence.ts` (added by Task 001) in full before writing any UI code.
5. Verify all of the above against the actual repository state before writing any code.

## Objective

Build the customer-facing "dedicated Market Radar view" named in `docs/project-magic/MARKET_RADAR.md` — a page where an owner can see their tracked competitors and benchmarks, and add or remove entries — using Task 001's `lib/market-radar/persistence.ts` functions. No monitoring/detection signal exists yet (that is a separate, unscoped future phase), so this view shows only what the owner has told it: their own managed list. Do not fabricate "recent activity," "changes detected," or any competitive signal that doesn't actually exist — this directly follows `MARKET_RADAR.md`'s "no fabricated competitive claims" rule and this repo's broader "no false success" discipline (see `docs/RC1_AUTHENTICATED_PILOT_VALIDATION.md`, referenced from `MARKET_RADAR.md` itself).

## Scope — exactly these changes

1. **A new route**, `app/dashboard/market-radar/page.tsx`, following the exact redirect-to-setup pattern used by every other Project Magic dashboard sub-page in this repo (e.g. `app/dashboard/business-brain/page.tsx`): if there's no business profile, `redirect("/dashboard/setup")`.
2. **A new component**, `components/dashboard/market-radar-page.tsx`, rendering:
   - A "Tracking N competitors" section listing each tracked competitor (name, optional notes), matching `docs/project-magic/WIREFRAMES.md`'s Market Radar layout.
   - A separate "Benchmarking" section listing tracked benchmarks, with copy making clear these are for inspiration, not head-to-head comparison (per `MARKET_RADAR.md`: "tracked for inspiration and pattern-matching, not head-to-head comparison framing").
   - "+ Add a competitor" and "+ Add a benchmark" actions, and a way to remove an existing entry. Look at `components/dashboard/testimonials-page.tsx` and/or `components/dashboard/smart-uploads-page.tsx` for this repo's existing convention for a simple owner-managed add/remove list (client component with local state, a form or inline control, calling a server action or API route) and follow that same established pattern rather than inventing a new one.
   - An honest empty state when there are zero tracked entries (an owner who hasn't added anything yet should see an inviting empty state, not an error or a blank page).
3. **The add/remove interaction's server-side plumbing** (a server action or a small API route under `app/api/market-radar/` — follow whichever convention this repo's most similar existing feature uses) calling Task 001's `addMarketRadarEntryForUser` / `removeMarketRadarEntryForUser`, scoped to the current authenticated user exactly like every other tenant-scoped mutation in this repo (ADR-0001).
4. **Navigation**: add a link to `/dashboard/market-radar` in the "More tools" progressive-disclosure list in `components/dashboard/growth-advisor/supporting-context.tsx`, matching the existing entries there exactly (label + href in the same array). Do **not** add a new primary nav item — `docs/project-magic/WIREFRAMES.md` explicitly recommends nesting this under existing tools, consistent with `docs/project-magic/NAVIGATION_PHILOSOPHY.md`'s bias against adding primary nav items lightly.
5. **Tests**:
   - Unit tests for any pure display logic you introduce (e.g. grouping tracked entries into "competitors" vs. "benchmarks" for rendering) under `unit-tests/market-radar-view.test.ts`, following this repo's established `node:test` style. Reuse Task 001's `sortMarketRadarEntries` (or equivalent) rather than reimplementing ordering logic.
   - A Playwright spec, `tests/market-radar.spec.ts`, following this repo's established source-level wiring-check style (model it on `tests/business-brain-inspector.spec.ts` or `tests/head-of-marketing-orchestrator.spec.ts`): confirm the new module/component/route files exist, confirm the route redirects to setup when there's no business profile, confirm the "More tools" link is present, and confirm the cron gate (`ATTACH_DECLARATIVE_PRODUCTION_CRONS = false` in `lib/trigger/scheduleActivation.ts`) is unchanged.
6. **Documentation**: extend the "Implementation status" note Task 001 added to `docs/project-magic/MARKET_RADAR.md` to record that the owner-facing view has now also shipped. Update `.ai/ROADMAP.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, and `.ai/HANDOFF.md` per `AGENTS.md` — overwrite `HANDOFF.md` (don't append) with this task's own branch/status/tests/PR/blockers/recommended-next-step.

## Explicitly out of scope — do not do these

- Wiring tracked competitors/benchmarks into `lib/market-context/providers/competitorProvider.ts`, Weekly Briefing, Marketing Director recommendation evidence, Growth Advisor's "What I Noticed" observations, or Business Pulse. `docs/project-magic/MARKET_RADAR.md`'s "How it surfaces" section describes those integrations, but every one of them requires the monitoring/detection layer, which does not exist yet and is not part of this task. If you find yourself needing to build any part of that to make this page feel "complete," stop and record it in `.ai/OPEN_ITEMS.md` as a follow-up rather than building it — do not silently expand scope.
- Any change to `lib/market-radar/persistence.ts` or `types.ts` beyond what's strictly needed to call the functions Task 001 already exposed (if you find you need a new persistence function, that's a signal to stop and reconsider whether this task's scope is well-bounded rather than quietly extending Task 001's foundation from inside this task).
- Any monitoring, scraping, or fabricated "recent competitor activity" copy.
- A new primary navigation item.

## Standing rules (restated from AGENTS.md — read AGENTS.md itself for full context)

- Never merge a pull request automatically.
- Never deploy, or trigger/configure a deployment, automatically.
- Never modify secrets, environment values, credentials, or API keys.
- Never apply a production (or any) database migration automatically — this task should not need a new migration at all; if it seems to, stop (see "Explicitly out of scope" above).
- Never activate a production schedule. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` in `lib/trigger/scheduleActivation.ts` must remain `false`; do not touch that file.
- Never weaken, skip, bypass, disable, or delete a meaningful test to make a quality gate pass.
- If any requirement above turns out to be materially ambiguous once you're actually working in the code, stop. Record the specific ambiguity and what you'd need to know in both `.ai/OPEN_ITEMS.md` (as a blocker) and `.ai/HANDOFF.md` (as the reason work stopped), then end the task cleanly — do not half-implement a guess.

## Workflow requirements

- Use the feature branch `ai-queue/002-market-radar-view`, created from Task 001's branch tip (per the "Depends on Task 001" section above — do not create it from `main`).
- Batch related, safe shell operations together before executing them; minimize approval prompts by grouping safe commands and avoiding unnecessary shell invocations.
- Run autonomously through the full task without pausing for routine, non-destructive Bash approvals. Batch and defer any approval-requiring shell commands until the end whenever safely possible, then present the minimal grouped approval set once — but do not defer an approval that is required to proceed safely (e.g. before a genuinely irreversible step), and pause before any destructive or irreversible operation.
- Implement only the defined phase above.
- Run the applicable quality gates and fix any regression your own change causes: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npx playwright test` (this task adds UI, so the Playwright suite is in scope, not just the runner's automatic lint/typecheck/unit check). All meaningful CI-equivalent quality gates must pass. Do not weaken or bypass a test to make one pass.
- Update the affected `.ai/` project-memory files (see step 6 of Scope above) in this same branch — required before the queue runner will consider the task complete.
- Commit your changes, push the branch, and open a pull request against Task 001's branch (not `main` directly — the queue runner opens the PR against the correct base automatically; if you are running this prompt outside the automated runner, open the PR with `--base ai-queue/001-market-radar-foundation`). Never merge it. Never deploy. Never apply a production migration. Never modify a secret. Never activate a schedule.
- After tests pass and the PR is created, send a macOS notification (if available in your environment) with the branch name and success/failure — if no such notification mechanism is available in your environment, say so honestly in your final report instead of silently skipping it.

## Report

At the end, report: branch name, final commit SHA, PR URL (and its base branch), which tests were run and their results, any blockers encountered, and your recommended next action (which should ordinarily be: "both PRs are ready for human review, in dependency order — merge 001 before 002").
