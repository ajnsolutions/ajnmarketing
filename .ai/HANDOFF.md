# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`harden-ai-queue-unattended-execution` (based on `origin/main` @ `dc537d2`, the merge of PR #99)

## Task status

**Complete.** This task's explicit goal was "enable reliable unattended overnight execution" of `.ai/queue/`. It fixes a real bug this queue's own first live, unattended run just found, plus a broader class of reliability gaps that same incident's investigation surfaced.

## What happened, and what was built

1. On starting this task, the working checkout was sitting on branch `ai-queue/001-market-radar-foundation` with uncommitted `QUEUE_STATUS.json` changes and a new `.ai/runs/2026-08-02T065749882Z/` directory — evidence that **the queue's first real, live, unattended run had actually executed** (in an environment with a working `claude` CLI, unlike every sandbox this project's build sessions have had access to). That run failed at the "no project-memory update" safety check — correctly, but for a deeper underlying reason: the task's `claude -p` invocation never did any real work at all.
2. Investigated the run's own logs (`task-001.log`, not committed — see `.ai/runs/README.md`'s log policy) and found the root cause directly in Claude's own JSON response: it tried to use Write/Edit/Bash tools, each triggered the CLI's normal interactive permission-approval flow, and with no human present in the unattended session, every approval sat pending until Claude gave up and exited 0 with a text explanation — having made zero file changes. The old adapter (`scripts/ai/adapters/claude.ts`) checked only the exit code and reported success.
3. Preserved the run's safe artifacts (`RUN_SUMMARY.md`, `RUN_STATUS.json`, `baseline.json`, `task-001-quality.json`) as committed evidence, reset to a clean `origin/main` checkout, and built the fix on a fresh branch rather than on top of the contaminated one.
4. **Fixed** `scripts/ai/adapters/claude.ts`: now invokes `claude -p --output-format json --dangerously-skip-permissions`; `checkAvailability()` verifies the CLI supports a permission-bypass flag before reporting available; and — as an independent second layer — the adapter now parses the JSON response body and treats a non-empty `permission_denials` array or `is_error: true` as a real failure regardless of exit code. Full reasoning: `.ai/DECISIONS.md` ADR-0013.
5. **Hardened more broadly for reliability**, since the same investigation showed nothing in the queue had a timeout: added `scripts/ai/subprocess.ts` (every git/gh/quality-gate subprocess call now has an explicit timeout and bounded buffer; stdin is never inherited so nothing can block on input that will never come); made `QUEUE_STATUS.json` writes atomic (`queueIO.ts`, write-temp-then-rename); wrapped each task attempt so an unexpected crash is recorded as that task's failure instead of silently losing the run's artifacts; added a run-level wall-clock ceiling (`queue.max_run_duration_minutes`, default 360 min); added timeout-awareness to `qualityGates.ts`'s snapshots (`timedOutGates`) so a killed gate is always treated as a regression, never silently read as "0 errors."
6. Updated `.ai/queue/RUN_QUEUE.yaml`'s header comment and added `max_run_duration_minutes: 360` explicitly. `QUEUE_STATUS.json` already reflected both Market Radar tasks (`001`, `002`) as `pending` on the fresh `origin/main` checkout — no reset needed.

## Tests

- `unit-tests/ai-queue-*.test.ts`: **112 tests, all pass** (67 pre-existing + 45 new/added this branch, across two new files — `ai-queue-subprocess.test.ts`, `ai-queue-claude-adapter.test.ts` — plus additions to `ai-queue-run.test.ts`, `ai-queue-validate.test.ts`, and `ai-queue-quality-gates.test.ts`). New coverage specifically: `buildClaudeArgs()` includes `--dangerously-skip-permissions`; `detectSilentPermissionFailure()` correctly flags the exact 2026-08-02 incident's response shape (`is_error: false` + non-empty `permission_denials`) and correctly passes a clean response; `subprocess.ts`'s `sh()`/`runCommand()` actually kill a real slow process at its timeout, correctly separate stdout/stderr, and never block on stdin; `runExceedsWallClockBudget()`; `compareQualitySnapshots()`'s new timeout-regression handling (including backward-compatibility with a baseline snapshot from before `timedOutGates` existed); `max_run_duration_minutes` validation.
- Full unit suite (`npm run test:unit`): **1740/1740 passing.**
- Lint (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- Typecheck (`npm run typecheck`): 18 pre-existing errors, identical set to before this branch — none touched by this branch (confirmed: a real typecheck bug in this branch's own new `subprocess.ts` was found and fixed during this session — `SpawnSyncReturns<string>` needed an explicit type annotation, `ReturnType<typeof spawnSync>` alone resolved to a `string | Buffer` union — see git history on this branch for the fix).
- Build (`npm run build`): succeeds, isolated (no dev server running concurrently). Route manifest unaffected by this branch's changes (none of it touches `app/`).
- Playwright (`npx playwright test`): **302/302 passing**, run in isolation on a clean checkout.
- **A real bug was found and fixed during this session's own work**, not just the incident being fixed: the first draft of `subprocess.ts` merged stdout+stderr into one `output` field, which would have silently broken `qualityGates.ts`'s ESLint JSON parsing (`--format json` writes clean JSON to stdout only; any stderr content would have corrupted the parse). Caught before it shipped by reasoning through the exact call site, not by a failing test — fixed by keeping stdout/stderr separate in `SubprocessResult`, with `.output` as a combined view for logging only. Now has direct test coverage.

## PR

[#100](https://github.com/ajnsolutions/ajnmarketing/pull/100) — `harden-ai-queue-unattended-execution` → `main`. Not merged. Not deployed.

## Blockers

None blocking this task's own completion. One carried-forward limitation, now narrower than before:

**The fix's failure-detection path is verified; its success path is not.** `detectSilentPermissionFailure()` is unit-tested directly against the real incident's actual response shape — that part is solid. But a real `claude --dangerously-skip-permissions` invocation actually completing a real task end-to-end has still never been observed in any sandbox available to this project's build/fix sessions — no `claude` binary was on `PATH` here either. The next environment with a working `claude` CLI should run the daytime dry run below before this is trusted for a real unattended overnight run.

Unrelated, pre-existing, not touched by this branch: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the pre-existing TypeScript debt (18 errors, unchanged).

## Recommended next step

1. In an environment where `claude --version` and `claude --help` actually work, run the daytime dry run: `npm run ai:queue:validate` → confirm clean `git status` on `main` → `npm run ai:queue` attended, in the foreground → confirm both Market Radar tasks (`001`, `002`) actually produce real file changes (a migration, `lib/market-radar/`, tests, docs) and real PRs, not another silent no-op.
2. If task 001 succeeds, its PR should be reviewed and merged before 002's (per `branch_strategy: stacked`) — `npm run ai:morning-brief` states this explicitly once a run completes.
3. If the same silent-no-op pattern recurs even with `--dangerously-skip-permissions`, inspect the raw `claude -p` JSON response directly (`is_error`, `permission_denials`, `result` fields) — `detectSilentPermissionFailure()` in `scripts/ai/adapters/claude.ts` may need updating for a changed CLI response shape rather than the underlying approach being wrong.
4. Separately, unrelated to this queue-reliability task: the product-track recommendations in `OPEN_ITEMS.md` remain the highest-priority carried-forward items.
