# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`ai-queue-v2-baseline-aware` (based on `origin/main` @ `44d6db1`, the merge of PR #98)

## Task status

**Complete.** Fixed the design flaw the first real daytime dry run of the queue surfaced: v1's quality gate compared each task's lint/typecheck/unit-test run against a hard "must be perfectly clean" bar, so this repository's own documented, pre-existing baseline issues stopped the queue even when a task introduced zero regressions of its own. Queue v2 makes the gate baseline-aware.

## What was built

- **`scripts/ai/qualityGates.ts`** (new) — the core of Queue v2:
  - `QualitySnapshot` type + `captureQualitySnapshot(repoRoot)`: runs TypeScript (`tsc --noEmit`), ESLint (`eslint . --format json`, errors and warnings tracked separately), unit tests (`test:unit`, TAP output), Playwright (`test:e2e --reporter=json`), and the production build, returning one structured snapshot.
  - Pure parsing functions (unit-tested with canned sample output): `parseTypescriptErrorCount`, `parseEslintJson`, `parseNodeTestFailures` (count + failing-test **names**, not just count), `parsePlaywrightJson` (same, recursively walking suites).
  - `compareQualitySnapshots(baseline, current)`: TypeScript/ESLint errors/ESLint warnings pass if the count didn't increase (existing debt is never a failure); unit tests/Playwright are **identity-aware** — a currently-failing test only passes if the *same test by name* was already failing in the baseline, which catches a regression a naive count comparison would miss (an old failure gets fixed while a different new one appears, netting to the same count); build must succeed unless the baseline build was itself already broken. Returns `overallStatus`, per-gate `gates[]`, and `newRegressions`/`fixedRegressions`/`remainingHistoricalDebt` lists.
  - `buildRepairPrompt(comparison, attempt, maxAttempts)`: a narrow follow-up prompt naming exactly the new regressions and explicitly forbidding scope expansion or "fixing" historical debt.
  - `formatQualityComparisonMarkdown(...)`: renders a comparison as a Markdown table for `RUN_SUMMARY.md`.
- **`scripts/ai/run-queue.ts`** (modified):
  - Captures one baseline via `captureQualitySnapshot` before this run's first eligible task begins (skipped entirely if no task is eligible — nothing to compare against), persisted to `.ai/runs/<run-id>/baseline.json`.
  - Replaced the old fixed `["npm run lint", "npm run typecheck", "npm run test:unit"]` gate loop with: capture current snapshot → `compareQualitySnapshots` against the baseline → if it fails, invoke the agent again with `buildRepairPrompt` (up to `queue.max_repair_attempts`, default 3) → re-capture → re-compare, repeating until it passes or attempts are exhausted. Only then does the task fail and the queue stop.
  - Persists `.ai/runs/<run-id>/task-<id>-quality.json` (baseline, current, comparison, repair attempt count) per attempted task, and `RUN_SUMMARY.md`/`RUN_STATUS.json` now include the repository baseline plus a per-task quality-gate table (baseline/current/result per gate, new regressions, fixed regressions, remaining historical debt).
  - The PR body `run-queue.ts` writes now states the Queue v2 result (pass + any remaining historical debt + repair attempts used) instead of the old fixed gate-command list.
- **`scripts/ai/queueTypes.ts`** — added optional `queue.max_repair_attempts` (defaults to `DEFAULT_MAX_REPAIR_ATTEMPTS = 3` when absent, so an older queue file without this field stays valid).
- **`scripts/ai/validate-queue.ts`** — validates `max_repair_attempts` if present (non-negative integer, capped at 10 so an unattended queue can't loop indefinitely on one task).
- **`.ai/queue/RUN_QUEUE.yaml`** — sets `max_repair_attempts: 3` explicitly; header comments explain Queue v2. The two Market Radar tasks (`001`, `002`) are otherwise unchanged in content.
- **Docs**: `docs/AI_OVERNIGHT_QUEUE.md` gained a full "Queue v2 — baseline-aware quality gates" section; `docs/AI_QUEUE_TROUBLESHOOTING.md`'s failed-task guidance updated to describe the new blocker message and where to find the comparison; `.ai/queue/README.md` and `.ai/runs/README.md` updated to mention `baseline.json`/`task-<id>-quality.json`; `scripts/ai/generate-morning-brief.ts`'s "Quality gates" section text updated for accuracy.
- **`.ai/DECISIONS.md`** — added ADR-0012 documenting this decision (what changed, why, alternatives considered, consequences). **`.ai/ARCHITECTURE.md`** and **`.ai/OPEN_ITEMS.md`** cross-reference it; `OPEN_ITEMS.md`'s pre-existing type-check debt entry now notes the queue no longer blocks on it, and a new "Known limitation of Queue v2's identity-aware test comparison" entry documents the test-rename edge case honestly.

## Tests

- New: `unit-tests/ai-queue-quality-gates.test.ts` (24 tests) — every parsing function with canned sample output, every `compareQualitySnapshots` rule (including this task's own worked example: 0→2 unit failures is a hard FAIL, and 18→18 TypeScript errors is a PASS), the identity-vs-count distinction specifically, `buildRepairPrompt`, `formatQualityComparisonMarkdown`. **All pass.**
- `unit-tests/ai-queue-*.test.ts` (all four files together, 63 tests total) — **all pass**, including the pre-existing `ai-queue-run.test.ts` (`selectNextEligibleTask`/`determineBranchBase`, unaffected by this change) and the self-check that validates the real `.ai/queue/RUN_QUEUE.yaml`.
- Full unit suite (`npm run test:unit`): **1718/1718 passing** (1694 prior + 24 new).
- Lint (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- Typecheck (`npm run typecheck`): 18 pre-existing errors, same baseline as before — none touched by this branch (see `OPEN_ITEMS.md`).
- `npm run ai:queue:validate`: valid.
- Build (`npm run build`): succeeds.
- Playwright (`npx playwright test`): full suite run — see this PR's own quality-gate results for the exact count at merge time.
- **The queue itself was not run** (`npm run ai:queue`) — this is a code change to the queue's own quality-gate mechanism, not a queue execution. The next real daytime dry run (per `docs/AI_OVERNIGHT_QUEUE.md`) is the actual end-to-end verification that Queue v2 behaves as designed against a live agent invocation.

## PR

Not yet created at the time this file was written — will be `ai-queue-v2-baseline-aware` → `main`. Not merged. Not deployed. The queue itself was not executed.

## Blockers

None blocking this task's own completion. Two things carried forward, unchanged by this work:

1. **The Claude CLI adapter's live success path is still unverified** (unchanged since PR #97/#98 — see `OPEN_ITEMS.md`). Queue v2 changes what happens *after* the agent invocation (the quality gate), not the invocation itself — that verification gap is orthogonal to this fix and still open.
2. **Queue v2's identity-aware test comparison has a known, accepted limitation** around test renames — see the new `OPEN_ITEMS.md` entry. Not a bug, but worth a human's awareness when reading a repair-loop diagnosis.

## Recommended next step

1. Review this PR (the new `scripts/ai/qualityGates.ts` module, the `run-queue.ts` integration, the schema addition, the docs, and ADR-0012).
2. Retry the attended daytime dry run per `docs/AI_OVERNIGHT_QUEUE.md`: confirm `gh --version`/`claude --version` are ready, confirm `git status` is clean on `main`, then run `npm run ai:queue` attended and watch it — this time, confirm Task 001 (which should introduce zero regressions if implemented as scoped) actually completes instead of being blocked by this repository's own pre-existing debt, and that `.ai/runs/<run-id>/baseline.json` and `task-001-quality.json` are written and look correct.
3. If Task 001 genuinely does introduce a regression this time, confirm the auto-repair loop actually attempts a fix and that the eventual PR (or failure) correctly reflects what happened.
4. Only after that succeeds should an unattended/overnight run be trusted.
5. Separately, unrelated to this queue-tooling fix: the product-track recommendations in `OPEN_ITEMS.md` (the three-competing-decision-systems architecture question, the spoofable rate-limit key) remain the highest-priority carried-forward items.
