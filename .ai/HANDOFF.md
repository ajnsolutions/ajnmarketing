# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`fix/queue-completion-state-reconciliation` (based on `origin/main` @ `895f5d3`, the merge of PR #101)

## Task status

**Complete.** PR #101 (Task 001 — Market Radar persistence foundation) merged successfully, but left `.ai/queue/QUEUE_STATUS.json` on `main` recording it as `"in_progress"`, silently blocking Task 002 from ever becoming eligible. This branch corrects that specific state (with only verified, non-fabricated data) and fixes the underlying bug in `run-queue.ts` plus builds a GitHub-verified reconciliation backstop so it self-heals if it ever recurs.

## Root cause

Found by direct `git show`/`git log` archaeology, not speculation: `git show 4db450f -- .ai/queue/QUEUE_STATUS.json` (the actual commit that carries Task 001's real work in PR #101) shows it staged `QUEUE_STATUS.json` transitioning `pending → in_progress` — never `→ completed`. `attemptTask()` in `scripts/ai/run-queue.ts` used to flip the in-memory task status to `"completed"` only *after* `git add -A && git commit` had already run for the task's real deliverable files. But `git add -A` staged `QUEUE_STATUS.json` exactly as it stood on disk at that moment — still `"in_progress"`, since the only prior `saveQueueState()` call in the function recorded the task *starting*, not finishing. The "completed" update then only ever existed in the local working tree's file, never in any commit that reached the branch. The PR a human reviewed and merged therefore permanently carried the stale snapshot into `main`'s history — a real, provable bug, not a one-off mistake.

(Separately, but consistent with this: `.ai/runs/2026-08-02T134243291Z/baseline.json` exists on `main`, meaning a real `npm run ai:queue` invocation genuinely started Task 001 — current_task/started_at/last_run_id all matched. Whether Task 001's actual deliverable work was produced by that same automated invocation completing normally, or by an attended/manual session replicating the task afterward, is not fully determinable from git history alone and doesn't change the fix — either path is exactly what the reconciliation backstop is designed to catch and correct.)

## What was built

1. **`scripts/ai/reconcile.ts`** (new) — `classifyTaskState()` (pure): given a task, its state entry, a `PrLookup` function, and whether a queue process is genuinely running, classifies an `"in_progress"` task as `running` / `stale_pr_merged` / `stale_pr_open` / `stale_pr_closed` / `stale_pr_no_evidence` / `not_applicable`. `reconcileTaskState()`/`reconcileQueueState()` (pure) build on that to actually correct state — completing a task only from a verified `MERGED` PR lookup, failing it (with an explicit blocker) only when no PR or a closed-unmerged PR is found, and never touching anything that isn't currently `"in_progress"`. `lookupPrForBranch()` is the real (impure) `gh pr list --head <branch> --state all` implementation, injected everywhere else as a parameter so the logic itself stays pure and testable. `writeRunLock`/`readRunLock`/`removeRunLock`/`isProcessAlive`/`isQueueProcessRunning` manage a local, gitignored `.ai/queue/.run.lock` file (PID + timestamp) so "genuinely still running" can be told apart from "stale" via a real liveness check, not a guess.
2. **`scripts/ai/run-queue.ts`** (modified):
   - **The ordering fix.** New `finalizeCompletionState()`: after `gh pr create` succeeds, saves the now-completed state, `git add`s `QUEUE_STATUS.json` specifically, commits, and pushes a final commit to the task's own branch — so the PR's own diff, and therefore what gets merged, is correct from the start. If this final push fails, the task is still reported as succeeded (the PR is real) but the discrepancy is logged loudly; reconciliation (below) will catch it on the next run regardless.
   - **The reconciliation backstop.** `main()` now calls `reconcileQueueState()` right after loading `QUEUE_STATUS.json`, before selecting any new task — self-healing even if the ordering fix above is ever bypassed.
   - A run-lock is written (`writeRunLock`) right before task selection begins and removed via a `process.once("exit", ...)` handler (fires even from an early `process.exit()`), so a concurrent or later invocation's liveness check is accurate.
3. **`scripts/ai/queue-status.ts`** (modified) — every `"in_progress"` task now gets a `live status:` line via `classifyTaskState()`, and the "resume eligible: no" explanation now distinguishes a genuine crash from a stale-but-merged task and points at `ai:queue:reconcile` for the latter.
4. **`scripts/ai/reconcile-queue.ts`** (new) — standalone `npm run ai:queue:reconcile` CLI: runs the same reconciliation without also starting a new task, for when you just want to fix a stale state you noticed via `ai:queue:status`.
5. **`.ai/queue/QUEUE_STATUS.json`** — Task 001 corrected by hand, using only independently verified data: `status: completed`, `branch: ai-queue/001-market-radar-foundation`, `commit: 79f23901a431da39b41dd0f226976de40f4bcd76` (the real tip commit of the merged PR #101 branch — confirmed to exist via `git cat-file -t`, per the task's own explicit instruction), `pr: https://github.com/ajnsolutions/ajnmarketing/pull/101`, `completed_at: 2026-08-02T13:53:18Z` (PR #101's own `createdAt` — matches this field's existing semantic meaning elsewhere in the codebase: "when the task's own work finished and the PR was opened," not when a human later merged it), `tests` summarized from PR #101's own merged `HANDOFF.md` Tests section. `current_task: null`, `resume_eligible: true`. Task 002 untouched, still `pending`. **Verified: `selectNextEligibleTask` now returns Task 002 against this corrected state** (confirmed by direct script execution, and by the new integration test below).
6. **`.gitignore`** — `/.ai/queue/.run.lock` added (local-machine-only, never meaningful across sessions).
7. **`package.json`** — added `ai:queue:reconcile` script.
8. Tests (all new, all real — see Tests section below).
9. Docs: `docs/AI_OVERNIGHT_QUEUE.md` gained a full "Completion-state reconciliation" section plus updates to "Checking status," "Resuming after a failure," and the daytime-dry-run steps (Task 001 is done; Task 002 is next). `docs/AI_QUEUE_TROUBLESHOOTING.md` gained a dedicated "A task shows in_progress but its PR already merged" section.
10. `.ai/DECISIONS.md` — new ADR-0014 (root cause, decision, alternatives considered, consequences). `.ai/OPEN_ITEMS.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json` updated to describe this fix and confirm Task 002's readiness.

## Tests

- **`unit-tests/ai-queue-reconcile.test.ts`** (new, 22 tests) — every `classifyTaskState`/`reconcileTaskState`/`reconcileQueueState` branch; the exact PR #101 scenario (`stale_pr_merged`) using realistic data; "never touches a non-in_progress task" across all five other statuses; real OS process-liveness checks (`isProcessAlive` against this test process's own PID and a nonexistent one, no mocking); run-lock write/read/remove round-trip; **the full end-to-end dependent-eligibility scenario** (a `002 depends_on: ["001"]` pending task stays ineligible while `001` is merely `in_progress`, becomes eligible once `001` is reconciled from a verified merged PR, and — critically — stays ineligible if reconciliation only finds an *open*, unmerged PR, proving the fix never falsely unblocks a dependent task).
- **`unit-tests/ai-queue-completion-state.test.ts`** (new, 3 tests) — `finalizeCompletionState()` tested against a **real throwaway git repository with a real bare remote** (not mocked): proves that after calling it, `git show HEAD:.ai/queue/QUEUE_STATUS.json` — not just the working-tree file — reflects `"completed"`, and that this reaches the actual remote (`git show refs/heads/main:...` in the bare repo), which is what makes it visible in a PR. Also covers the "nothing to commit" (already-pushed) case succeeding gracefully, and a real push failure (no remote configured) being reported clearly.
- **`unit-tests/ai-queue-status.test.ts`** (new, 6 tests) — `formatQueueStatusReport`'s new classification-aware rendering: RUNNING vs. stale-merged vs. stale-no-evidence vs. stale-open all render distinctly; a completed task never shows a live-status line even if (hypothetically) passed stale classification data.
- **`unit-tests/ai-queue-*.test.ts` full suite**: **116/116 passing** (85 pre-existing + 22 new in `ai-queue-reconcile.test.ts`, 3 new in `ai-queue-completion-state.test.ts`, 6 new in `ai-queue-status.test.ts`).
- **Full unit suite** (`npm run test:unit`): **1776/1776 passing.**
- **Lint** (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- **Typecheck** (`npm run typecheck`): 18 pre-existing errors, identical set to before this branch — none touched by it.
- **Build** (`npm run build`): succeeds.
- **Playwright** (`npx playwright test`): **302/302 passing**, run in isolation.
- **`npm run ai:queue:validate`**: valid.

## PR

Opened against `main` from this branch — see this repository's PR list for the number/URL (`gh pr list --head fix/queue-completion-state-reconciliation`). Not merged. Not deployed.

## Blockers

None blocking this task's own completion. One carried-forward limitation, unchanged in kind from prior sessions:

**The ordering fix (`finalizeCompletionState`) has real end-to-end test coverage against an actual git repository, but has not been exercised by a genuine unattended `npm run ai:queue` invocation.** No `claude` binary was available in this fix's own build sandbox either (same limitation as ADR-0013/PR #100). The next real queue run — starting with Task 002 — is the first live test of this specific fix.

Unrelated, pre-existing, not touched by this branch: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the pre-existing TypeScript debt (18 errors, unchanged).

## Recommended next step

1. Review this PR (root cause, the two-part fix, the corrected `QUEUE_STATUS.json` entry, the tests) before doing anything else.
2. Once merged, in an environment where `claude --version`/`claude --help` (mentioning `--dangerously-skip-permissions`) actually work:
   ```bash
   npm run ai:queue:validate
   git checkout main && git pull
   npm run ai:queue:status   # confirm: 001 completed, 002 pending, resume_eligible: true
   npm run ai:queue          # attended, in the foreground — runs Task 002
   ```
3. Watch for: the queue selecting `002` (not re-attempting `001`), `002`'s branch built from `001`'s real merged content, a real PR opening, and — the actual point of this fix — `QUEUE_STATUS.json` on `002`'s own branch correctly showing `"completed"` before the run ends (verify with `git show HEAD:.ai/queue/QUEUE_STATUS.json` on that branch, not just the local working tree).
4. If a stale `"in_progress"` state is ever seen again for any reason, `npm run ai:queue:status` will now say exactly what's going on, and `npm run ai:queue:reconcile` (or simply re-running `npm run ai:queue`) will self-heal it from verified GitHub state.
5. Separately, unrelated to this queue-tooling fix: the product-track recommendations in `OPEN_ITEMS.md` remain the highest-priority carried-forward items.
