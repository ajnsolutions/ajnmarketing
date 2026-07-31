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
3. Confirm prerequisites: `gh --version` (authenticated), and `claude --version` — the runner's own capability probe will refuse cleanly and tell you exactly what's missing if either isn't ready. **This build's own sandbox did not have the `claude` CLI installed** — its capability probe was verified against that exact failure case, but a real, successful non-interactive `claude` invocation has not yet been observed end-to-end. Confirm it works in your actual environment before trusting an overnight run.
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

The queue **stops immediately** on the first failed task, an ambiguous requirement, a failed quality gate, a missing project-memory update, or any git/GitHub operation failure — it does not skip ahead. To resume:

1. Run `npm run ai:queue:status` and read the failed task's `blocker` line.
2. Fix the underlying problem by hand (it could be in the repo, in the task's prompt file, or an environment/prerequisite issue — the blocker message says which).
3. If the failure left a half-finished branch behind, decide by hand whether to fix it in place or delete it and let the queue recreate it (the queue will refuse to silently overwrite an existing branch it didn't expect — see `docs/AI_QUEUE_TROUBLESHOOTING.md`).
4. Re-run `npm run ai:queue` — it picks up at the next eligible task, it does not re-run already-completed tasks.

`npm run ai:queue:reset -- --confirm` is a different, more drastic action: it wipes `QUEUE_STATUS.json` back to everything-pending. It never touches remote branches, PRs, commits, or `.ai/runs/` logs — see `.ai/queue/README.md`.

## Stacked vs. independent branches

Set once, queue-wide, via `RUN_QUEUE.yaml`'s `queue.branch_strategy`:

- **`independent`** — every task branches from `queue.base_branch` (e.g. `main`), regardless of `depends_on`. Use this when tasks touch disjoint files and each should be independently reviewable and mergeable in any order. A dependent task under `independent` mode will not actually see its dependency's file changes until a human merges the dependency's PR first — only use `depends_on` here for *ordering* (e.g. "don't even attempt this until that one's reviewed"), not for tasks that need the earlier task's files.
- **`stacked`** — a task with `depends_on` branches from its dependency's own branch tip instead of `base_branch`, so its changes are actually present to build on. Use this whenever a later task genuinely needs an earlier task's files (the two shipped example tasks demonstrate this).

Either way, **PRs must be reviewed and merged in dependency order** — `npm run ai:morning-brief`'s "Merge order" section states this explicitly for whatever ran last.

## Safety boundaries, restated

Every boundary in this section is enforced independently by `scripts/ai/validate-queue.ts` and is also part of the permanent rules in `AGENTS.md` — the queue is not the only place these rules are stated, and the queue's enforcement does not replace the human review step of actually reading each PR before merging it.

## The Claude Code adapter's current honesty

`scripts/ai/adapters/claude.ts` is implemented against documented Claude Code CLI non-interactive conventions (`-p`/`--print`, `--output-format json`). Its capability-detection path (`checkAvailability()`) was verified live during this build — in that sandbox, no `claude` binary was on `PATH`, and the adapter correctly reported that and refused to proceed. The success path (an actual completed non-interactive task) has not been observed end-to-end anywhere yet. Do the daytime dry run above before trusting this for a real overnight run, and update this note once it's been verified.

## The Cursor/Grok adapter is not implemented

`scripts/ai/adapters/cursor-placeholder.ts` exists only to define the interface shape (`scripts/ai/adapters/types.ts`) a future headless Cursor/Grok backend would need. It reports itself unavailable unconditionally. `"cursor"` and `"grok"` are not valid values for a task's `agent` field — `scripts/ai/queueTypes.ts`'s `SUPPORTED_AGENTS` only lists `"claude"`, and the validator rejects anything else.
