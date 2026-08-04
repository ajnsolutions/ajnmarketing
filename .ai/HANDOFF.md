# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`fix/queue-project-memory-auto-repair` (based on `main` @ `7177304`, the merge of PR #105 — deliberately NOT based on Task 003's own branch, per this task's instruction to keep product and infrastructure changes in separate, clean PRs).

## Task status

**Complete.** This is a two-part task: (1) recover Task 003, which genuinely completed but was mis-failed by a queue detection bug, and (2) fix that bug so it can't recur, with a bounded auto-repair loop, better validation, and a permanent recovery path for any future occurrence.

## Root-cause classification (required deliverable)

Task 003 fits **none** of the four options this task's own instructions offered as a classification menu ("implemented useful work" / "partially implemented" / "completed implementation but omitted Project Memory" / "no useful changes"). The precise classification is a fifth case: **Task 003 fully completed both its scoped implementation AND its Project Memory update — in the same commit, with a real PR already open — and the queue's own post-hoc verification incorrectly reported the memory update as missing due to a check-design bug (a proven false negative, not an actual omission).**

Proven, not assumed, from four independent sources: (1) `git show --stat 8261a20` — the real work commit — already lists `.ai/CURRENT_STATUS.md`, `.ai/HANDOFF.md`, `.ai/ROADMAP.md`, `.ai/STATUS.json` among its changed files; (2) `gh pr view 107` — a real, open PR against `main`, containing exactly two commits, both already pushed; (3) `.ai/runs/2026-08-03T051052683Z/task-003.log` — the real `claude -p --dangerously-skip-permissions` invocation's own JSON report: `is_error:false`, `permission_denials:[]`, `terminal_reason:"completed"`, the same real commit SHA and PR URL, and a full, accurate self-report of tests run; (4) the code itself — `run-queue.ts`'s old check was `git status --porcelain -- .ai/CURRENT_STATUS.md ...`, which only ever detects **uncommitted** changes, and its own injected "standing instructions" told the agent to commit its memory update in the same branch — a structural, guaranteed-to-misfire contradiction the moment an agent follows that instruction literally, as Task 003's did.

## Part 1 — Task 003 preservation and recovery

**No work was redone.** Audited Task 003's implementation directly against `.ai/queue/prompts/003-competitor-observation-engine.md`: migration `038_competitor_observations.sql` (written, not applied), `lib/competitor-observations/{types,scoring,persistence}.ts` with exactly the specified function names (`listCompetitorObservationsForUser`, `recordCompetitorObservationForUser`, `generateCompetitorObservationsForUser`, `scoreCompetitorSignal`), 11/11 passing unit tests, no UI/route/cron additions — scope match confirmed, no gaps found, nothing to complete.

Recovered `.ai/queue/QUEUE_STATUS.json`'s task `003` entry using the **existing, already-tested `finalizeCompletionState()` function** (the exact same supported path a successful run would have used) — not a hand-fabricated JSON edit. Every field written was independently verified: `commit: 8261a20...` (the real work commit), `pr: https://github.com/ajnsolutions/ajnmarketing/pull/107` (`gh pr view 107`), `completed_at: 2026-08-03T05:24:40Z` (PR #107's real `createdAt`), `tests` (the agent's own real report, quoted verbatim in the state entry). Committed as `d75d198` on `ai-queue/003-competitor-observation-engine`, pushed — PR #107 now carries the correct completion state. A follow-up commit (`8d4875e`) preserved the real failed-run evidence (`RUN_SUMMARY.md`, `RUN_STATUS.json`, `task-003-quality.json`; raw `task-003.log` stays local-only per this repo's log policy).

Also discovered and fixed, live, during this recovery: `finalizeCompletionState()`'s own multi-line commit message lost its newlines when run through `sh()` (a shell string), since a JSON-escaped `\n` inside a double-quoted shell argument is not interpreted as a real newline by `/bin/sh`. The one commit this function had ever actually made before now (`d75d198`) has a literal `\n\n` in its subject line — left as-is (not amended, per this repo's no-amend policy on published commits) since its *content* is correct, only the message rendering is cosmetically broken. Fixed in this branch for all future invocations (see Part 3).

## Part 2 — Root cause (see `.ai/DECISIONS.md` ADR-0017 for full reasoning)

`attemptTask()`'s check — `git status --porcelain -- .ai/CURRENT_STATUS.md .ai/STATUS.json .ai/HANDOFF.md .ai/ROADMAP.md .ai/ARCHITECTURE.md .ai/DECISIONS.md .ai/OPEN_ITEMS.md` — only detects uncommitted working-tree changes. Task 003's agent, following the very standing instructions `run-queue.ts` itself injects into every task prompt ("update the relevant .ai/ memory files ... and commit them in this same branch"), committed its memory update before returning control. By the time the check ran, the tree was clean, the check found nothing, and a real update was reported as missing. This had never surfaced before because Tasks 001/002 were the queue's first two tasks — this exact code path (a real `claude` subprocess actually committing its own work) had never executed for real until this run.

## Part 3 — Automatic memory repair (implemented)

`scripts/ai/projectMemory.ts` (new): `validateProjectMemoryUpdate(repoRoot, baseRef)` detects a real change as the union of commits-since-branch-point (`git diff <baseRef>...HEAD`) and any uncommitted diff (`git diff HEAD`) — correct regardless of whether the agent commits its own work. `attemptTask()` now runs `runMemoryValidationWithRepair()` on failure: a bounded loop (reusing `queue.max_repair_attempts` — Part 3's own "aligned with the existing repair architecture" requirement) that re-invokes the agent with `buildMemoryRepairPrompt()` — names the exact missing files/reasons, the task's real test summary, and explicitly forbids touching feature code, fabricating completion, or writing boilerplate — then re-validates. Exhausting the bound fails the task safely with every reason recorded, never fabricates completion, never starts a dependent task (unchanged `selectNextEligibleTask` still requires exactly `"completed"`).

## Part 4 — Improved validation (implemented)

Centrally defined file set: `REQUIRED_PROJECT_MEMORY_FILES` (`CURRENT_STATUS.md`, `STATUS.json`, `HANDOFF.md` — mandatory every task) and `OPTIONAL_PROJECT_MEMORY_FILES` (`ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md` — checked for validity if touched, never required). Rejects: no recognized file changed; a required file missing; `STATUS.json` failing `JSON.parse`; unresolved Git conflict markers in any changed file (required or optional); trivial/timestamp-only diffs (`isTrivialMemoryDiff` — normalizes timestamps, compares added vs. removed lines). Persisted everywhere required: terminal (`console.log`), task log (`taskLog +=`), `RUN_SUMMARY.md` (`formatMemoryValidationMarkdown`), `RUN_STATUS.json` (`memory_validation` field per task), `QUEUE_STATUS.json` (`TaskState.memory_validation`, surfaced by `npm run ai:queue:status`), and `.ai/exports/MORNING_BRIEF.md` (a dedicated line under Blockers naming the exact reasons, not just the generic blocker string).

Also made the subsequent commit/push/PR-creation steps **idempotent**: commit only if the tree is actually dirty; check for an existing PR (`lookupPrForBranch`) before `gh pr create`, reusing it if found — the two additional latent bugs that would otherwise have immediately re-failed Task 003 a second and third way right after fixing the memory check alone (a self-committing, self-PR-opening agent leaves nothing to commit, and `gh pr create` errors on a duplicate).

A permanent, tested recovery path — `reconcileTaskAgainstMemoryCheckFailure`/`reconcileFailedMemoryChecks` in `reconcile.ts` — reconciles any task "failed" with this exact blocker pattern, provided a real PR exists and independent re-validation against that PR's actual base genuinely passes; a task genuinely still missing its update stays failed, never waved through. Wired into both `npm run ai:queue:reconcile` and every `npm run ai:queue` startup.

## Part 5 — Prompt/instruction updates (implemented)

`run-queue.ts`'s injected standing instructions (sent with every task) now spell out the full checklist: update the three required files truthfully plus optional ones where applicable, `STATUS.json` must stay valid JSON, no conflict markers, `HANDOFF.md` is a snapshot not a log, commit/push/PR is safe either way (idempotent), and queue state is never hand-edited. `.ai/queue/prompts/004-business-pulse-integration.md` and `005-weekly-executive-brief.md` each gained an explicit "Project Memory and truthfulness" section with the same checklist — their product scope and dependencies are untouched. Task 003's own prompt was left as-is (historical record, already executed).

## Part 6 — Tests

- **`unit-tests/ai-queue-project-memory.test.ts`** (new, 23 tests): pure content checks (conflict markers, trivial-diff detection, JSON validation); `validateProjectMemoryUpdateCore` (valid update passes; no update fails; unrelated `.ai/` file change fails; HANDOFF.md missing fails; invalid STATUS.json fails; timestamp-only fails; conflict markers fail in required AND optional files; an optional file changing doesn't gate pass/fail); `buildMemoryRepairPrompt`/`formatMemoryValidationMarkdown` formatting; `runMemoryValidationWithRepair` (valid update never triggers repair; invalid update repairs and passes; repair that keeps failing stops safely at the bound; an agent invocation failure stops immediately); two **real-git** tests proving the actual git wiring detects Task 003's exact self-committing pattern, and correctly fails when only unrelated commits exist.
- **`unit-tests/ai-queue-reconcile.test.ts`** (+9 tests): `isMemoryCheckFailureBlocker` (matches old and new blocker text, not unrelated failures); the real PR #107 incident reconciles to completed; reconciliation preserves the task's real recorded test evidence and never re-fabricates it; does NOT reconcile an unrelated failure, a missing PR, a closed PR, a genuinely-still-failing re-validation, or a non-failed task; batch version reconciles only matching tasks, leaves everything else untouched.
- **`unit-tests/ai-queue-morning-brief.test.ts`** (new, 4 tests): no-run message; the morning brief identifies the exact missing-memory reasons (not just the generic blocker); a non-memory failure doesn't print a spurious memory line; a completed task's safe-next-action never claims automatic merging.
- **`unit-tests/ai-queue-run.test.ts`** (+2 tests): a dependent task stays ineligible while its dependency is `"failed"` from an invalid memory update; becomes eligible once the dependency genuinely reaches `"completed"`.
- Existing **`unit-tests/ai-queue-completion-state.test.ts`** (3 real-git tests) re-verified passing unchanged — confirms the `sh()` → `runCommand()` commit-message fix didn't disturb `finalizeCompletionState()`'s existing ordering guarantees.

## Test results (full suite, this branch)

- **Full unit suite** (`npm run test:unit`): **1835/1835 passing.**
- **All `ai-queue-*` test files together**: **171/171 passing** (includes every file above plus every pre-existing queue test file, run together for cross-file confidence).
- **Lint** (`npm run lint`): clean — 0 errors, 7 pre-existing warnings, none in files this branch touched.
- **Typecheck**, both configs (`npm run typecheck` and the quality-gate config): **18 errors each — identical to baseline**, zero new.
- **Build** (`npm run build`): succeeded.
- **Playwright** (`npx playwright test --workers=1`): **311/311 passing.** One earlier run showed transient failures across ~10 unrelated spec files (none touched by this branch); re-running those files alone passed 45/45, and a full clean re-run passed 311/311 — sandbox resource contention from consecutive heavy runs, not a regression, matching this repo's own documented precedent for the same pattern.
- **`npm run ai:queue:validate`**: valid.
- `.ai/STATUS.json`: valid JSON (verified before and after edits).
- No unresolved Git conflict markers anywhere in this branch's diff.
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS`: confirmed still `false`.

## Branches / commits / PRs

- **Task 003 recovery** — branch `ai-queue/003-competitor-observation-engine`, commits `d75d198` (QUEUE_STATUS.json completion-state correction via `finalizeCompletionState()`) and `8d4875e` (real run evidence). PR: [#107](https://github.com/ajnsolutions/ajnmarketing/pull/107) — OPEN, not merged. Product work only; this recovery touched no feature code.
- **Queue hardening** — branch `fix/queue-project-memory-auto-repair`, commit `dc09f6d`, based on `main` @ `7177304`. Contains only infrastructure: `scripts/ai/projectMemory.ts` (new), `scripts/ai/run-queue.ts`, `scripts/ai/reconcile.ts`, `scripts/ai/reconcile-queue.ts`, `scripts/ai/queueTypes.ts`, `scripts/ai/queue-status.ts`, `scripts/ai/generate-morning-brief.ts`, the four new/extended test files, `.ai/queue/prompts/004-*.md`/`005-*.md`, `.ai/DECISIONS.md` (ADR-0017), and this file plus `CURRENT_STATUS.md`/`STATUS.json`/`OPEN_ITEMS.md`. PR: [#108](https://github.com/ajnsolutions/ajnmarketing/pull/108) — OPEN, not merged.

## Exact merge order

No hard ordering dependency — the two PRs touch disjoint files and neither is based on the other. Either can merge first. Recommended: merge #107 (Task 003) first, since Tasks 004/005 are blocked on it either way; merge #108 (queue hardening) before or immediately after so the *next* queue run (which will attempt Task 004) is protected by the fix.

## Blockers

None blocking this task's own completion. Standing, unrelated: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the 18 pre-existing historical TypeScript errors.

**Not yet verified:** this fix has real, non-mocked and real-git regression tests, but has not yet been exercised by a fresh, fully unattended `npm run ai:queue` run completing Task 004 or 005 end-to-end. That is the next real live test.

## Exact safe commands to resume the overnight queue after both PRs are reviewed and merged

```bash
git checkout main && git pull
npm run ai:queue:validate
npm run ai:queue:status   # confirm: 001/002/003 completed, 004 pending, resume_eligible: true
npm run ai:queue          # attended, in the foreground — will attempt Task 004 next,
                           # now protected by the hardened Project Memory check
```

## Confirmation of safety boundaries

No deployment occurred. No Supabase migration was applied (Task 003's migration file is unchanged — written, never run). No secrets, environment variables, or credentials were modified. No production schedule was activated (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` confirmed still `false`). No merge was performed automatically — both PR #107 and this branch's PR are open, unmerged. No force-push occurred anywhere. Tasks 004 and 005 remained `pending` throughout this entire task and did not start.
