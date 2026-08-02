# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`fix/queue-merged-dependency-base-resolution` (based on `origin/main` @ `952df6e`, the merge of PR #102)

## Task status

**Complete.** This is the direct sequel to PR #102 (completion-state reconciliation): once that fix landed and Task 001's `QUEUE_STATUS.json` entry was corrected, `npm run ai:queue` correctly selected Task 002 — and immediately failed trying to branch it, because Task 001's local branch had been (correctly) deleted after PR #101 merged. This branch fixes that.

## Root cause

`git checkout -b ai-queue/002-market-radar-view ai-queue/001-market-radar-foundation` failed: `fatal: 'ai-queue/001-market-radar-foundation' is not a commit`. The old `determineBranchBase()` (`scripts/ai/run-queue.ts`) unconditionally reused a completed dependency's *recorded branch name* as the next task's git base, forever, with no check for whether that branch still existed. It required every merged dependency branch to survive indefinitely — a guarantee no normal PR workflow (including this repository's own habit of deleting merged branches) makes. This wasn't a one-off; it would have recurred on every dependent task after every merge.

## What was built

1. **`scripts/ai/reconcile.ts`**: new `resolveDependencyBase()` — replaces the single unconditional assumption with three explicit, GitHub-verified cases:
   - **Merged** (verified via a real `gh pr view` lookup, not the locally-recorded branch): resolves to the PR's actual merge target (normally `origin/main`), with the recorded merge commit's ancestry independently checked (`git merge-base --is-ancestor`) before it's trusted. A merged dependency's branch is never required to still exist.
   - **Open** (unmerged): uses the dependency's own branch, preferring the remote-tracking ref (`origin/<branch>`) over a possibly-stale local one. Fails clearly if that branch can't be resolved either way.
   - **Unverifiable** (neither a merged PR nor a resolvable branch for a `"completed"` dependency): stops with an actionable error. Never falls back to guessing `origin/main`.
   - Also added: `lookupPrByUrl()` (exact PR lookup by number, more reliable than a branch-name search when the branch itself may be gone), `resolveGitRef()`/`isAncestorRef()` (real git ref/ancestry checks), extended `PrLookupResult` with `baseRefName`.
2. **`scripts/ai/run-queue.ts`**: retired `determineBranchBase()` entirely. `main()`'s loop now does a cheap preflight per selected task — `git fetch origin --prune` then `resolveDependencyBase()` — **before** the expensive quality-gate baseline is captured (moved from an unconditional pre-loop capture to a lazy, first-successful-preflight capture). A resolution failure is now recorded via a new `failPreflight()` helper (mirrors `attemptTask()`'s own in_progress→failed bookkeeping) without ever touching the baseline or invoking the agent. `attemptTask()` now receives the already-resolved `baseResolution` instead of computing its own; the resolved ref and reasoning are recorded in the task's own log (prepended before any other content), `RUN_SUMMARY.md` (a `Base:` line per task), and `RUN_STATUS.json` (a `base_resolution` field per task) — every `fail()` call site and the success path all carry it through.
3. **`.ai/queue/QUEUE_STATUS.json`**: Task 002 reset from `"failed"` back to `"pending"` (branch/commit/pr/started_at/tests/blocker all `null`) — never fabricated as completed. Task 001's own `"completed"` entry was left completely untouched. `resume_eligible` corrected to `true`. **Verified: `selectNextEligibleTask` returns Task 002 against this state**, and — more importantly — `resolveDependencyBase()` run against this repo's real, live `gh`/`git` state independently resolves Task 002's base to `origin/main`, with PR #101's real merge commit confirmed as a real ancestor (not a unit-test fake).
4. Preserved the failed run's evidence: `.ai/runs/2026-08-02T151115309Z/{RUN_SUMMARY.md,RUN_STATUS.json,baseline.json}` committed (the raw `task-002.log` stays local-only per this repo's log policy). That evidence is itself part of what motivated the preflight-before-baseline ordering — it shows a full ~2-minute baseline was captured before the cheap branch-checkout failure was ever discovered.
5. Docs: `docs/AI_OVERNIGHT_QUEUE.md` gained a "Dependency-base resolution" section and an updated daytime-dry-run step 4; `docs/AI_QUEUE_TROUBLESHOOTING.md` gained an "'... is not a commit' when a task tries to branch" section. `.ai/DECISIONS.md` gained ADR-0015. `.ai/OPEN_ITEMS.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json` updated with the incident and fix.

## Tests

- **`unit-tests/ai-queue-base-resolution.test.ts`** (new, 14 tests) — every required scenario explicitly: a merged dependency with a deleted local *and* remote branch resolves to `origin/main` (the exact real incident, reproduced); a merged dependency's commit must be verified as an ancestor of the chosen base (including two **real-git** tests — one proving `isAncestorRef`/`resolveGitRef` against an actual merge commit vs. an orphan/unrelated commit, one proving an actual `git checkout -b` from the resolved ref lands on the right commit with the dependency's real files present); an open dependency PR uses its own branch for a stacked build; a missing/unresolvable branch for an open PR fails clearly; a stale local dependency branch that still happens to exist does **not** override verified merged-PR state; Task 002 becomes eligible once Task 001 is correctly recorded completed; plus the trivial no-dependency and `independent`-strategy cases.
- `unit-tests/ai-queue-run.test.ts`: the 3 obsolete `determineBranchBase` tests removed (one of them literally asserted the buggy behavior — a bare, un-prefixed branch name as the base); replaced by the new file above.
- `unit-tests/ai-queue-reconcile.test.ts` / `ai-queue-status.test.ts`: fixture helpers updated for `PrLookupResult`'s new `baseRefName` field — no behavioral changes, all still passing.
- **A real, verified end-to-end check beyond unit tests**: `resolveDependencyBase()` was run directly against this repository's actual `.ai/queue/RUN_QUEUE.yaml` and (corrected) `QUEUE_STATUS.json`, using the real `lookupPrByUrl`/`resolveGitRef`/`isAncestorRef` (real `gh`/`git` calls, not fakes) — confirmed it resolves Task 002's base to `origin/main`, verified via PR #101's actual merge commit.
- **Full unit suite** (`npm run test:unit`): **1787/1787 passing.**
- **Lint** (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- **Typecheck** (`npm run typecheck`): 18 pre-existing errors, identical set to before this branch — none touched by it.
- **Build** (`npm run build`): succeeds.
- **Playwright** (`npx playwright test`): **302/302 passing**, run serially (`--workers=1`) for a clean count. A first `--workers=2` run showed 17 failures, all clustered in `tests/first-impression.spec.ts` (a file this branch's changes cannot affect — this branch touches only `scripts/ai/`, `unit-tests/`, `.ai/`, and docs); re-running that file alone (`--workers=1`) passed 22/22, and a full serial re-run passed 302/302, confirming parallel-worker resource contention in this sandbox, not a regression.
- **`npm run ai:queue:validate`**: valid.

## PR

Opened against `main` from this branch — see this repository's PR list for the number/URL (`gh pr list --head fix/queue-merged-dependency-base-resolution`). Not merged. Not deployed.

## Blockers

None blocking this task's own completion. One carried-forward limitation, consistent with every fix in this file today:

**The preflight/resolution change has real end-to-end test coverage (including two tests against an actual git repository) and was independently verified against this repo's real, live GitHub/git state — but has not yet been exercised by an actual `npm run ai:queue` invocation completing Task 002 end-to-end.** No `claude` binary was available in this fix's own build sandbox either (same standing limitation as every queue fix so far).

Unrelated, pre-existing, not touched by this branch: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the pre-existing TypeScript debt (18 errors, unchanged).

## Recommended next step

1. Review this PR (root cause, `resolveDependencyBase()`'s three cases, the corrected `QUEUE_STATUS.json`, the tests — especially the two real-git ones) before doing anything else.
2. Once merged, in an environment where `claude --version`/`claude --help` (mentioning `--dangerously-skip-permissions`) actually work:
   ```bash
   npm run ai:queue:validate
   git checkout main && git pull
   npm run ai:queue:status   # confirm: 001 completed, 002 pending, resume_eligible: true
   npm run ai:queue          # attended, in the foreground — runs Task 002
   ```
3. Watch for: the preflight log line (`Task 002: base resolved to origin/main — ...`) appearing *before* "Capturing repository quality baseline," confirming the ordering fix; a real PR opening for Task 002; and — per the completion-state fix (ADR-0014) — `QUEUE_STATUS.json` on `002`'s own branch correctly showing `"completed"` before the run ends.
4. If a dependency-base resolution failure is ever seen again, `npm run ai:queue:status`'s blocker text and `RUN_SUMMARY.md`'s new `Base:` line will now state exactly which of the three cases failed and why — see `docs/AI_QUEUE_TROUBLESHOOTING.md`.
5. Separately, unrelated to this queue-tooling fix: the product-track recommendations in `OPEN_ITEMS.md` remain the highest-priority carried-forward items.
