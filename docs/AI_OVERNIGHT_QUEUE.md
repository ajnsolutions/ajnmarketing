# AI Overnight Task Queue

A sequential, unattended queue that runs pre-approved prompts through Claude Code, one at a time, stopping immediately on any failure, ambiguity, or safety-rule violation. This document is the usage guide; `AGENTS.md` has the permanent rules, `.ai/queue/README.md` orients the directory layout, and `docs/AI_QUEUE_TROUBLESHOOTING.md` covers recovery and troubleshooting.

## What the queue never does

Enforced by `scripts/ai/validate-queue.ts` before a single task runs — not just documented, checked:

- Never merges a pull request.
- Never deploys, or triggers/configures a deployment.
- Never applies a production database migration.
- Never changes a secret, environment value, or credential.
- Never activates a production schedule — the validator independently cross-checks the real, code-level `ATTACH_DECLARATIVE_PRODUCTION_CRONS` gate (`lib/trigger/scheduleActivation.ts`) in addition to the queue file's own `safety:` block, and refuses to run if either one is anything other than `false`.

A queue file that requests any of the above — at the `safety:` block level or on any individual task (`requires_migration`, `requires_deployment`, `requires_secret_change`, `activates_production_schedule`) — is rejected outright. This is by design: the queue should be safe to leave running overnight without a human in the loop, and safety here means "can't", not "is asked not to."

## Directory layout

See `.ai/queue/README.md`. Short version: `RUN_QUEUE.yaml` (the queue definition, hand-authored), `QUEUE_STATUS.json` (live run state, machine-written), `prompts/*.md` (one file per task).

## Adding a prompt

1. Write the task prompt as its own file under `.ai/queue/prompts/`, numbered to match the task id (see `prompts/README.md` for what makes a good unattended prompt — the short version: it must not need real-time human judgment to execute safely).
2. Add a task entry to `RUN_QUEUE.yaml`'s `tasks:` list with a unique `id` and `branch`, the right `depends_on`, and `status: pending` (not `disabled`).
3. Validate before anything else: `npm run ai:queue:validate`.

## Validating a queue

```bash
npm run ai:queue:validate
```

Prints every problem found (not just the first) with a scope (`queue` or a task id) and an actionable message. Exit code 0 = valid.

## Running a daytime test (do this before any overnight run)

Never trust a new or edited queue file's first real execution to happen unattended. Before enabling any real task:

1. `npm run ai:queue:validate` — must pass.
2. `git status` — must be clean (the runner refuses otherwise).
3. Confirm prerequisites: `gh --version` (authenticated), and `claude --version` — the runner's own capability probe will refuse cleanly and tell you exactly what's missing if either isn't ready, including whether the installed CLI supports the permission-bypass flag this queue now requires (see "The Claude Code adapter's current honesty" below for why). No sandbox this project's own build/fix sessions have run in has had a `claude` binary on `PATH` — confirm it actually works in your real environment before trusting an overnight run.
4. `RUN_QUEUE.yaml` currently holds two real, `status: pending` tasks (Market Radar's persistence foundation and its owner-facing view — see the file's own header comment and `.ai/HANDOFF.md` for how they were selected and their current status), prepared but not yet run. Before trusting an unattended overnight run, run `npm run ai:queue` attended once, in the foreground, watching it: confirm two real PRs open, in the right order (002 based on 001's branch, per `branch_strategy: stacked`), each with the `.ai/` memory updates present, each passing quality gates. This is a real run, not a throwaway demonstration — its PRs are meant to be reviewed and merged (in dependency order) like any other PR, not reverted.
5. Only after a real daytime run has produced a real, reviewed PR should you trust a first overnight run with real tasks.

## Running overnight (macOS)

```bash
caffeinate -dimsu npm run ai:queue
```

`caffeinate -dimsu` prevents the Mac from sleeping (display, idle, disk, system) for the duration — without it, an overnight run can be silently paused by the machine going to sleep. Optional log redirection (never redirects anything containing secrets — the queue's own logs are already local-only and gitignored, see `.ai/runs/README.md`):

```bash
caffeinate -dimsu npm run ai:queue > /tmp/ai-queue-overnight.log 2>&1
```

In the morning: `npm run ai:morning-brief`, then read `.ai/exports/MORNING_BRIEF.md` — it's written for a quick, non-technical read.

## Checking status

```bash
npm run ai:queue:status
```

Reports: queue name, current task, completed/pending/in-progress/failed/disabled tasks, per-task branch/commit/PR/tests/blocker, and whether the queue is resume-eligible.

## Resuming after a failure

The queue **stops immediately** on the first failed task, an ambiguous requirement, a failed quality gate (including a gate that timed out — see "Reliability hardening" above), a missing project-memory update, a permission-denial from the agent itself, or any git/GitHub operation failure (including one that timed out) — it does not skip ahead. To resume:

1. Run `npm run ai:queue:status` and read the failed task's `blocker` line.
2. Fix the underlying problem by hand (it could be in the repo, in the task's prompt file, or an environment/prerequisite issue — the blocker message says which).
3. If the failure left a half-finished branch behind, decide by hand whether to fix it in place or delete it and let the queue recreate it (the queue will refuse to silently overwrite an existing branch it didn't expect — see `docs/AI_QUEUE_TROUBLESHOOTING.md`).
4. Re-run `npm run ai:queue` — it picks up at the next eligible task, it does not re-run already-completed tasks.

`npm run ai:queue:reset -- --confirm` is a different, more drastic action: it wipes `QUEUE_STATUS.json` back to everything-pending. It never touches remote branches, PRs, commits, or `.ai/runs/` logs — see `.ai/queue/README.md`.

## Stacked vs. independent branches

Set once, queue-wide, via `RUN_QUEUE.yaml`'s `queue.branch_strategy`:

- **`independent`** — every task branches from `queue.base_branch` (e.g. `main`), regardless of `depends_on`. Use this when tasks touch disjoint files and each should be independently reviewable and mergeable in any order. A dependent task under `independent` mode will not actually see its dependency's file changes until a human merges the dependency's PR first — only use `depends_on` here for *ordering* (e.g. "don't even attempt this until that one's reviewed"), not for tasks that need the earlier task's files.
- **`stacked`** — a task with `depends_on` branches from its dependency's own branch tip instead of `base_branch`, so its changes are actually present to build on. Use this whenever a later task genuinely needs an earlier task's files (the current Market Radar tasks demonstrate this — see `RUN_QUEUE.yaml`'s own header comment).

Either way, **PRs must be reviewed and merged in dependency order** — `npm run ai:morning-brief`'s "Merge order" section states this explicitly for whatever ran last.

## Queue v2 — baseline-aware quality gates

The first real daytime dry run of this queue surfaced a design flaw: v1's quality gate ran `npm run lint`, `npm run typecheck`, and `npm run test:unit` and required a perfectly clean result. This repository intentionally carries a small number of documented, pre-existing baseline issues (see `.ai/OPEN_ITEMS.md`'s "Pre-existing type-check debt"), so v1's gate stopped the queue even on a task that introduced zero regressions of its own — the queue was evaluating **repository-wide** quality instead of **task-specific** quality.

Queue v2 (`scripts/ai/qualityGates.ts`) fixes this:

1. **Baseline capture.** Before this run's first eligible task begins, `run-queue.ts` runs the full quality suite once — TypeScript (`tsc --noEmit`), ESLint (errors and warnings separately), unit tests (`test:unit`), Playwright (`test:e2e`), and the production build — and persists the result as one `QualitySnapshot` to `.ai/runs/<run-id>/baseline.json`. If no task is eligible this invocation (e.g. the queue is already exhausted), no baseline is captured — there's nothing to compare against.
2. **Per-task comparison.** After each task's agent invocation finishes, the same quality suite runs again and is compared against that same baseline (`compareQualitySnapshots`), never against a different or updated baseline, and never against the *previous* task's result — every task in a run is judged against the one snapshot taken before the run started:
   - **TypeScript / ESLint errors / ESLint warnings** — PASS if the count did not increase. A baseline count of 18 staying at 18 is a PASS; existing debt is never held against a task that didn't touch it.
   - **Unit tests / Playwright** — identity-aware, not just count-based. A currently-failing test passes this gate only if the *same test, by name*, was already failing in the baseline. This catches the case a raw count comparison would miss: an old failure gets fixed while a different, new one appears, netting to the same total count but still a real regression.
   - **Build** — must succeed, unless the baseline build was itself already broken (pre-existing breakage isn't this task's fault either — same philosophy as every other gate).
3. **Bounded auto-repair.** If the comparison fails, `run-queue.ts` re-invokes the same agent with a narrow repair prompt (`buildRepairPrompt`) listing exactly the new regressions found and explicitly forbidding scope expansion or "fixing" unrelated historical debt, then re-runs the full comparison. This repeats up to `queue.max_repair_attempts` times (default 3, see `RUN_QUEUE.yaml`) before the task is marked `failed` and the queue stops — pre-existing debt never triggers a repair attempt, since it never fails the gate in the first place.
4. **Persistence and reporting.** Every task's `baseline`/`current`/`comparison`/`repairAttempts` are written to `.ai/runs/<run-id>/task-<id>-quality.json`, and `RUN_SUMMARY.md`/`RUN_STATUS.json` include a per-task table of every gate's baseline value, current value, and result, plus explicit "new regressions," "fixed regressions," and "remaining historical debt" lists (`formatQualityComparisonMarkdown`).

This means: **existing repository debt never stops autonomous execution; any regression a task itself introduces always does**, and the queue gets a bounded number of automatic attempts to fix its own regression before giving up and asking a human to look.

## Safety boundaries, restated

Every boundary in this section is enforced independently by `scripts/ai/validate-queue.ts` and is also part of the permanent rules in `AGENTS.md` — the queue is not the only place these rules are stated, and the queue's enforcement does not replace the human review step of actually reading each PR before merging it.

## Reliability hardening (2026-08-02)

The queue's first real, *live, unattended* run (`.ai/runs/2026-08-02T065749882Z/`, evidence preserved) surfaced two classes of problem, both fixed on branch `harden-ai-queue-unattended-execution`:

1. **The agent adapter could report success while having done nothing.** See "The Claude Code adapter's current honesty" below for the full incident and fix.
2. **Nothing in the queue had a timeout.** Every subprocess call — git operations, `gh`, and every quality-gate command (`tsc`, `eslint`, unit tests, Playwright, build) — now goes through `scripts/ai/subprocess.ts`, which requires an explicit timeout at every call site. A hung command is killed and treated as a real failure (a gate that times out is always a new regression if it wasn't already timing out in the baseline — see `qualityGates.ts`'s `timedOutGates`), not silently ignored or waited on forever.

Three smaller but related fixes shipped alongside these:

- **`QUEUE_STATUS.json` writes are now atomic** (write-to-temp-then-rename, `queueIO.ts`) — a process killed mid-write (machine sleep despite `caffeinate`, `SIGKILL`, power loss) can no longer leave the state file corrupted.
- **A crash mid-task no longer disappears silently.** `run-queue.ts` catches an unexpected exception during any single task's attempt, records it as that task's failure, and still writes a normal `RUN_SUMMARY.md`/`RUN_STATUS.json` — a human checking `npm run ai:morning-brief` the next morning always has something to read, regardless of how the run actually ended.
- **The whole run now has a wall-clock ceiling** — `queue.max_run_duration_minutes` in `RUN_QUEUE.yaml` (default 360 minutes / 6 hours, `DEFAULT_MAX_RUN_DURATION_MINUTES` in `queueTypes.ts`). Checked at the top of every loop iteration; if exceeded, the run stops cleanly with remaining tasks left `pending` for the next invocation, rather than potentially running indefinitely.

## The Claude Code adapter's current honesty

**Live incident, 2026-08-02:** the queue's first real unattended task invocation ran `claude -p --output-format json` with no permission-mode flag. Claude correctly tried to use its Write/Edit/Bash tools, correctly triggered the CLI's normal interactive per-tool-call approval flow — and with no human present to approve anything in an unattended session, every one of those approvals sat pending until Claude gave up and exited 0 with a text explanation, having made zero file changes. The old adapter checked only the exit code, saw 0, and reported success. The queue's auto-repair loop then burned a second, identically-blocked invocation before self-diagnosing the real cause in its own response text. Full evidence: `.ai/runs/2026-08-02T065749882Z/` (raw log not committed, per this repo's log policy — see `.ai/runs/README.md`).

**Fixed:** `scripts/ai/adapters/claude.ts` now invokes `claude -p --output-format json --dangerously-skip-permissions`, and — as an independent second layer — parses the JSON response body afterward: a non-empty `permission_denials` array or `is_error: true` is now treated as a real failure regardless of exit code. `checkAvailability()` also verifies the installed CLI's `--help` mentions a permission-bypass flag before reporting the agent available at all. See `.ai/DECISIONS.md` ADR-0013 for the full safety reasoning on why running with `--dangerously-skip-permissions` is an acceptable tradeoff here (short version: the thing that actually keeps an unattended run safe was never per-tool-call human approval — that's incompatible with "unattended" by definition — it's `validate-queue.ts`'s safety gate plus the fact that `run-queue.ts`'s own code never calls merge/deploy/migration/secret-change/schedule-activation anywhere).

**Still unverified:** the fix's *failure-detection* path was proven correct against the real incident's actual response shape (`unit-tests/ai-queue-claude-adapter.test.ts`). Its *success* path — a real `claude --dangerously-skip-permissions` invocation actually completing a real task end-to-end — has **not** been observed anywhere yet; no `claude` binary was on `PATH` in the sandbox that built this fix either. Do the daytime dry run above, in an environment where `claude --version` actually works, before trusting this for a real overnight run — and update this note once it's been verified.

## The Cursor/Grok adapter is not implemented

`scripts/ai/adapters/cursor-placeholder.ts` exists only to define the interface shape (`scripts/ai/adapters/types.ts`) a future headless Cursor/Grok backend would need. It reports itself unavailable unconditionally. `"cursor"` and `"grok"` are not valid values for a task's `agent` field — `scripts/ai/queueTypes.ts`'s `SUPPORTED_AGENTS` only lists `"claude"`, and the validator rejects anything else.
