# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`fix/queue-project-memory-auto-repair` (PR [#108](https://github.com/ajnsolutions/ajnmarketing/pull/108)), merged with the latest `main` (`b73999c`, the merge of PR #107) to resolve conflicts in `.ai/CURRENT_STATUS.md`, `.ai/HANDOFF.md`, and `.ai/STATUS.json` created when PR #107 merged first.

## Task status

**Task 003 (Competitor Observation Engine) is COMPLETE and merged into `main` via PR #107.** PR #108 (this branch, queue Project Memory hardening) remains **open, not yet merged** — this update brings it current against `main` post-#107 and re-validates.

## What shipped in PR #107 (Task 003 — now on `main`)

The evidence, confidence, and persistence foundation for competitor observations, exactly as scoped in `.ai/queue/prompts/003-competitor-observation-engine.md`:

1. **`supabase/migrations/038_competitor_observations.sql`** (written, not applied to any database per `AGENTS.md` rule 13) — `public.competitor_observations` table (`id`, `user_id`, `business_profile_id`, `market_radar_entry_id`, `summary`, `confidence` (`low`/`medium`/`high`), `source_label`, `occurred_at`, timestamps), RLS scoped to `auth.uid() = user_id`, mirroring `037_market_radar.sql`.
2. **`lib/competitor-observations/types.ts`**, **`scoring.ts`** (`scoreCompetitorSignal` — pure, unit-tested; documented confidence thresholds), **`persistence.ts`** (`listCompetitorObservationsForUser`, `recordCompetitorObservationForUser`, `generateCompetitorObservationsForUser`).
3. **`unit-tests/competitor-observation-engine.test.ts`** — 11/11 passing.
4. No UI, no route, no cron wiring — that remains Tasks 004/005, both of which depend on 003 and are now unblocked but still `pending`.

Task 003's own test results at merge: lint clean; typecheck 18 errors (baseline, none new); unit tests 1808/1808; build succeeded; Playwright not run (persistence/scoring-only scope, no UI/route change, matching Task 001's precedent).

## Root-cause classification for the queue's false failure of Task 003 (required deliverable, unchanged from prior handoff)

Task 003 fits **none** of the four options this task's own instructions offered as a classification menu ("implemented useful work" / "partially implemented" / "completed implementation but omitted Project Memory" / "no useful changes"). The precise classification is a fifth case: **Task 003 fully completed both its scoped implementation AND its Project Memory update — in the same commit, with a real PR already open — and the queue's own post-hoc verification incorrectly reported the memory update as missing due to a check-design bug (a proven false negative, not an actual omission).**

Proven, not assumed, from four independent sources: (1) `git show --stat 8261a20` — the real work commit — already lists `.ai/CURRENT_STATUS.md`, `.ai/HANDOFF.md`, `.ai/ROADMAP.md`, `.ai/STATUS.json` among its changed files; (2) `gh pr view 107` — a real PR against `main`, now merged; (3) `.ai/runs/2026-08-03T051052683Z/task-003.log` — the real `claude -p --dangerously-skip-permissions` invocation's own JSON report: `is_error:false`, `permission_denials:[]`, `terminal_reason:"completed"`, the same real commit SHA and PR URL, and a full, accurate self-report of tests run; (4) the code itself — `run-queue.ts`'s old check was `git status --porcelain -- .ai/CURRENT_STATUS.md ...`, which only ever detects **uncommitted** changes, and its own injected "standing instructions" told the agent to commit its memory update in the same branch — a structural, guaranteed-to-misfire contradiction the moment an agent follows that instruction literally, as Task 003's did.

## Part 1 — Task 003 preservation and recovery (historical, shipped in PR #107)

**No work was redone.** Audited Task 003's implementation directly against its prompt: migration, `lib/competitor-observations/{types,scoring,persistence}.ts` with exactly the specified function names, 11/11 passing unit tests, no UI/route/cron additions — scope match confirmed, no gaps found, nothing to complete.

Recovered `.ai/queue/QUEUE_STATUS.json`'s task `003` entry using the **existing, already-tested `finalizeCompletionState()` function** (the exact same supported path a successful run would have used) — not a hand-fabricated JSON edit. Every field written was independently verified: `commit: 8261a20` (the real work commit), `pr: https://github.com/ajnsolutions/ajnmarketing/pull/107`, `completed_at: 2026-08-03T05:24:40Z` (PR #107's real `createdAt`), `tests` (the agent's own real report, quoted verbatim). Committed as `d75d198` on `ai-queue/003-competitor-observation-engine`, pushed. A follow-up commit (`8d4875e`) preserved the real failed-run evidence (`RUN_SUMMARY.md`, `RUN_STATUS.json`, `task-003-quality.json`; raw `task-003.log` stays local-only per this repo's log policy). PR #107 has since merged into `main` (`b73999c`) carrying all of this.

Also discovered and fixed, live, during this recovery: `finalizeCompletionState()`'s own multi-line commit message lost its newlines when run through `sh()` (a shell string), since a JSON-escaped `\n` inside a double-quoted shell argument is not interpreted as a real newline by `/bin/sh`. The one commit this function had ever actually made before now (`d75d198`) has a literal `\n\n` in its subject line — left as-is (not amended, per this repo's no-amend policy on published commits) since its *content* is correct, only the message rendering is cosmetically broken. Fixed in this branch (PR #108) for all future invocations.

## Part 2 — Root cause (see `.ai/DECISIONS.md` ADR-0017 for full reasoning)

`attemptTask()`'s check — `git status --porcelain -- .ai/CURRENT_STATUS.md .ai/STATUS.json .ai/HANDOFF.md .ai/ROADMAP.md .ai/ARCHITECTURE.md .ai/DECISIONS.md .ai/OPEN_ITEMS.md` — only detects uncommitted working-tree changes. Task 003's agent, following the very standing instructions `run-queue.ts` itself injects into every task prompt ("update the relevant .ai/ memory files ... and commit them in this same branch"), committed its memory update before returning control. By the time the check ran, the tree was clean, the check found nothing, and a real update was reported as missing. This had never surfaced before because Tasks 001/002 were the queue's first two tasks — this exact code path (a real `claude` subprocess actually committing its own work) had never executed for real until this run.

## Part 3 — Automatic memory repair (implemented in PR #108)

`scripts/ai/projectMemory.ts` (new): `validateProjectMemoryUpdate(repoRoot, baseRef)` detects a real change as the union of commits-since-branch-point (`git diff <baseRef>...HEAD`) and any uncommitted diff (`git diff HEAD`) — correct regardless of whether the agent commits its own work. `attemptTask()` now runs `runMemoryValidationWithRepair()` on failure: a bounded loop (reusing `queue.max_repair_attempts`) that re-invokes the agent with `buildMemoryRepairPrompt()` — names the exact missing files/reasons, the task's real test summary, and explicitly forbids touching feature code, fabricating completion, or writing boilerplate — then re-validates. Exhausting the bound fails the task safely with every reason recorded, never fabricates completion, never starts a dependent task (unchanged `selectNextEligibleTask` still requires exactly `"completed"`).

## Part 4 — Improved validation (implemented in PR #108)

Centrally defined file set: `REQUIRED_PROJECT_MEMORY_FILES` (`CURRENT_STATUS.md`, `STATUS.json`, `HANDOFF.md` — mandatory every task) and `OPTIONAL_PROJECT_MEMORY_FILES` (`ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md` — checked for validity if touched, never required). Rejects: no recognized file changed; a required file missing; `STATUS.json` failing `JSON.parse`; unresolved Git conflict markers in any changed file (required or optional); trivial/timestamp-only diffs (`isTrivialMemoryDiff`). Persisted everywhere required: terminal, task log, `RUN_SUMMARY.md`, `RUN_STATUS.json`, `QUEUE_STATUS.json` (`TaskState.memory_validation`), and `.ai/exports/MORNING_BRIEF.md`.

Also made the subsequent commit/push/PR-creation steps **idempotent**: commit only if the tree is actually dirty; check for an existing PR (`lookupPrForBranch`) before `gh pr create`, reusing it if found — the two additional latent bugs that would otherwise have immediately re-failed Task 003 a second and third way right after fixing the memory check alone.

A permanent, tested recovery path — `reconcileTaskAgainstMemoryCheckFailure`/`reconcileFailedMemoryChecks` in `reconcile.ts` — reconciles any task "failed" with this exact blocker pattern, provided a real PR exists and independent re-validation against that PR's actual base genuinely passes; a task genuinely still missing its update stays failed, never waved through. Wired into both `npm run ai:queue:reconcile` and every `npm run ai:queue` startup.

## Part 5 — Prompt/instruction updates (implemented in PR #108)

`run-queue.ts`'s injected standing instructions (sent with every task) now spell out the full checklist: update the three required files truthfully plus optional ones where applicable, `STATUS.json` must stay valid JSON, no conflict markers, `HANDOFF.md` is a snapshot not a log, commit/push/PR is safe either way (idempotent), and queue state is never hand-edited. `.ai/queue/prompts/004-business-pulse-integration.md` and `005-weekly-executive-brief.md` each gained an explicit "Project Memory and truthfulness" section with the same checklist — their product scope and dependencies are untouched.

## Part 6 — Tests (PR #108)

- **`unit-tests/ai-queue-project-memory.test.ts`** (new, 23 tests): pure content checks, `validateProjectMemoryUpdateCore`, repair-prompt/formatting, `runMemoryValidationWithRepair` (valid never triggers repair; invalid repairs and passes; repair that keeps failing stops safely at the bound; agent-invocation failure stops immediately), two real-git tests reproducing Task 003's exact self-committing pattern.
- **`unit-tests/ai-queue-reconcile.test.ts`** (+9 tests): the real PR #107 incident reconciles correctly; preserves real test evidence; refuses to reconcile unrelated failures, missing/closed PRs, or genuinely-still-failing re-validation.
- **`unit-tests/ai-queue-morning-brief.test.ts`** (new, 4 tests): identifies the exact missing-memory reasons, not just a generic blocker.
- **`unit-tests/ai-queue-run.test.ts`** (+2 tests): a dependent task stays ineligible while its dependency failed memory validation.
- **`unit-tests/ai-queue-completion-state.test.ts`** (3 real-git tests) re-verified unchanged after the commit-message fix.

## Test results (this update — branch merged with latest `main` post-PR #107)

- `git status`: clean after conflict resolution and commit.
- No unresolved Git conflict markers anywhere in the merged tree.
- `.ai/STATUS.json`: valid JSON (verified via `python3 -c "import json; json.load(...)"`).
- `npm run ai:queue:validate`: see Validation section below (rerun after merge).
- `npm run ai:queue:status`: see Validation section below (rerun after merge).
- Full unit suite, lint, typecheck, build, Playwright: rerun after merge — see Validation section below for actual results from this session, not carried over from the pre-merge state.
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS`: confirmed still `false`.

## Branches / commits / PRs

- **Task 003** — merged into `main` via [PR #107](https://github.com/ajnsolutions/ajnmarketing/pull/107) (commits `8261a20`, `7ce3ff3`, `d75d198`, `8d4875e`), merge commit `b73999c`. Done.
- **Queue hardening** — branch `fix/queue-project-memory-auto-repair`, now merged with `main` @ `b73999c` to bring in PR #107 and resolve conflicts. Contains: `scripts/ai/projectMemory.ts` (new), `scripts/ai/run-queue.ts`, `scripts/ai/reconcile.ts`, `scripts/ai/reconcile-queue.ts`, `scripts/ai/queueTypes.ts`, `scripts/ai/queue-status.ts`, `scripts/ai/generate-morning-brief.ts`, four new/extended test files, `.ai/queue/prompts/004-*.md`/`005-*.md`, `.ai/DECISIONS.md` (ADR-0017), and this file plus `CURRENT_STATUS.md`/`STATUS.json`/`OPEN_ITEMS.md`. PR: [#108](https://github.com/ajnsolutions/ajnmarketing/pull/108) — **OPEN, not merged.**

## Next step

Review and merge PR #108. Once merged, `git checkout main && git pull`, then `npm run ai:queue:validate` and `npm run ai:queue:status` should show Tasks 001/002/003 completed, 004 pending, `resume_eligible: true`. Then `npm run ai:queue` (attended, foreground) will attempt Task 004, now protected by the hardened Project Memory check.

## Blockers

None blocking this task's own completion. Standing, unrelated: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the 18 pre-existing historical TypeScript errors.

**Not yet verified:** this fix has real, non-mocked and real-git regression tests, but has not yet been exercised by a fresh, fully unattended `npm run ai:queue` run completing Task 004 or 005 end-to-end. That is the next real live test, after PR #108 merges.

## Confirmation of safety boundaries

No deployment occurred. No Supabase migration was applied (Task 003's migration file is unchanged — written, never run). No secrets, environment variables, or credentials were modified. No production schedule was activated (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` confirmed still `false`). No merge was performed automatically — PR #108 remains open, unmerged (PR #107 was already merged by a human/process before this update began). No force-push occurred anywhere. Tasks 004 and 005 remained `pending` throughout and did not start.
