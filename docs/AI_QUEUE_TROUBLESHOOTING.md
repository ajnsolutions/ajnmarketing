# AI Queue Troubleshooting

Recovery and troubleshooting for `.ai/queue/`. Start with `npm run ai:queue:status` for any problem — its output (current task, per-task blocker, resume eligibility) is the first thing every section below assumes you've already looked at.

## Troubleshooting index

- [GitHub CLI (`gh`) problems](#troubleshooting-github-cli)
- [Claude CLI problems](#troubleshooting-claude-cli)
- [A task shows in_progress but its PR already merged](#a-task-shows-in_progress-but-its-pr-already-merged)
- ["... is not a commit" when a task tries to branch](#is-not-a-commit-when-a-task-tries-to-branch)
- [Recovering from a failed task](#recovering-from-a-failed-task)
- [Reviewing PRs in dependency order](#reviewing-prs-in-dependency-order)
- [A queue file that won't validate](#a-queue-file-that-wont-validate)
- [Something looks like it might contain a secret](#something-looks-like-it-might-contain-a-secret)

## "... is not a commit" when a task tries to branch

This is the exact bug Task 002 surfaced on 2026-08-02, immediately after the completion-state fix above landed (`.ai/DECISIONS.md` ADR-0015, `.ai/OPEN_ITEMS.md`'s "Dependency-base resolution bug" entry): a dependent task tried to branch directly from its dependency's *recorded branch name*, which no longer existed because that dependency had already merged and its branch was (correctly) cleaned up.

**This should no longer happen** — `scripts/ai/reconcile.ts`'s `resolveDependencyBase()` now resolves a merged dependency to its real, GitHub-verified merge target instead of assuming the old branch survives. If you see this error anyway:

1. Check the task's blocker via `npm run ai:queue:status` — it now states exactly which of the three resolution cases failed (unverified PR, unresolvable open-PR branch, or no evidence at all) rather than a raw git error.
2. If the blocker says a merge commit "could not be verified as an ancestor" of the base branch, your local `origin/<base>` may just be stale — run `git fetch origin` and retry.
3. If the blocker says the dependency's PR "could not be verified via gh pr view", check `gh auth status` and confirm the PR referenced in `QUEUE_STATUS.json`'s `pr` field still exists.
4. If none of those explain it, this may be a genuinely new gap in the resolution logic — check `.ai/runs/<run-id>/RUN_SUMMARY.md`'s `Base:` line (or the task's own log) for the full resolution reasoning before assuming it's the same known issue.

## A task shows in_progress but its PR already merged

This is the exact bug PR #101 (Task 001) surfaced on 2026-08-02 (see `.ai/DECISIONS.md` ADR-0014 and `.ai/OPEN_ITEMS.md`'s "Queue completion-state bug" entry) — `QUEUE_STATUS.json` said `"in_progress"` on `main` even though the task's PR had already merged. Two commands make this easy to distinguish and fix now:

1. `npm run ai:queue:status` — an `in_progress` task now shows a `live status:` line telling you exactly which situation you're in: `RUNNING` (leave it alone, something is actually working on it), `STALE, but PR merged` (this is the fix case), or `STALE — no PR found`/`STALE — PR closed` (a real failure, not a bookkeeping lag).
2. If it says `STALE, but PR merged`: run `npm run ai:queue:reconcile`. It corrects `QUEUE_STATUS.json` from the real, verified GitHub PR data — never fabricated — and only ever touches that one task. `npm run ai:queue` also runs this automatically before selecting a new task, so simply re-running the queue will self-heal this too.

If you instead see `STALE — no PR found` for a task you believe actually did succeed, do not run `ai:queue:reconcile` expecting it to "find" the PR — it only trusts `gh pr list`, so if that genuinely returns nothing, either the branch was never pushed or the PR was deleted. Investigate by hand (check the branch exists: `git ls-remote origin <branch>`) before assuming reconciliation missed something; it is deliberately conservative and will mark the task `"failed"` rather than guess.

## Troubleshooting GitHub CLI

The queue shells out to `gh pr create` after each task's commit is pushed. `run-queue.ts` checks `gh --version` succeeds before starting at all, but that only proves the binary exists — it doesn't prove you're authenticated for this repository.

- **`gh --version` fails / command not found** — install: `brew install gh` (macOS) or see https://cli.github.com. This is a real, human, one-time setup step; the queue will not do it for you.
- **`gh pr create` fails partway through a run** (task committed and pushed, but no PR) — check `gh auth status`. Re-authenticate (`gh auth login`), then re-run `npm run ai:queue`; on resume it will not re-do the already-pushed commit, but you may need to open that one PR by hand (`gh pr create --base <base> --head <branch>`) since the queue's own attempt already failed and won't silently retry an unknown state. Check `npm run ai:queue:status` for the exact branch name.
- **Wrong GitHub account / org** — `gh auth status` shows which account is active; `gh auth switch` if you have multiple.

## Troubleshooting Claude CLI

- **`claude` command not found** — the queue's own capability probe (`scripts/ai/adapters/claude.ts`) catches this before running anything and prints an actionable message. Install the Claude Code CLI (see https://docs.claude.com/claude-code), confirm `claude --version` works, then re-run.
- **Installed, but the queue still refuses to start** — the probe checks that `claude --help` mentions both non-interactive mode (`-p`/`--print`) and a permission-bypass flag (`--dangerously-skip-permissions` or `--permission-mode`). If your installed version's flags differ, that's a real signal the adapter needs updating for your CLI version — see `.ai/OPEN_ITEMS.md`'s "Live dry-run incident" entry, and update `scripts/ai/adapters/claude.ts` to match your actual CLI's documented flags rather than forcing it past the check.
- **A task's PR shows no real file changes, but the run reported success** — this is the exact failure mode a 2026-08-02 live incident found and this repo's adapter was fixed for (see `.ai/DECISIONS.md` ADR-0013 and the "Reliability hardening" section of `docs/AI_OVERNIGHT_QUEUE.md`): every tool call silently blocked on a permission approval no one was present to give. If you see this on a CLI version newer than when that fix was written, the fix's `detectSilentPermissionFailure()` check (`scripts/ai/adapters/claude.ts`) may need updating to match a changed response shape — inspect the raw task log's JSON `result`/`permission_denials` fields first to confirm before assuming it's the same bug.
- **A task fails with "process killed after exceeding its ... timeout"** — a gate or git/gh command didn't finish in time (see `scripts/ai/subprocess.ts` and the per-command timeout constants in `run-queue.ts`/`qualityGates.ts`). Re-run the same command by hand outside the queue to see whether it's genuinely slow (raise that specific timeout constant) or actually hanging (a real bug to fix, not a timeout to extend).
- **Task runs but produces something clearly wrong** — the queue's baseline-aware quality gates (TypeScript, ESLint errors/warnings, unit tests, Playwright, build — see `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue v2" section) and its required-`.ai/`-update check will catch a lot, but not everything. Read the PR like you'd read any PR before merging; the queue opening a PR is not the same as the queue vouching for its correctness.

## Recovering from a failed task

1. `npm run ai:queue:status` — find the failed task and read its `blocker` line.
2. Common blocker categories and what they mean:
   - *"quality gate failed after N auto-repair attempt(s) — new regression(s): ..."* — the task introduced a genuine new regression (per `.ai/runs/<run-id>/task-<id>-quality.json`'s baseline-vs-current comparison) that the automatic repair loop couldn't fix within `max_repair_attempts` tries. Read that JSON file (or the matching section of `RUN_SUMMARY.md`) for exactly which gate(s) failed and why — it explicitly lists new regressions separately from any pre-existing historical debt, which never causes this blocker on its own. Check out the task's branch locally and reproduce (`npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`), fix the listed regression(s) by hand, then either resume the queue or open the PR yourself.
   - *"did not update any .ai/ memory file"* — the agent completed the task's stated goal but skipped the memory-update step `AGENTS.md` requires. Check out the branch, add the missing `.ai/` update, commit, push by hand, then `gh pr create` by hand — or discard the branch and let a corrected prompt run again.
   - *"could not create branch" / "could not fetch base branch"* — usually a stale local branch with the same name already exists, or the base branch reference is wrong. Delete the stale local branch (`git branch -D <name>`, only if you're sure it's not someone's in-progress work) and re-run.
   - *"agent invocation did not succeed"* — see Claude CLI troubleshooting above.
3. Fix the underlying cause, then `npm run ai:queue` again — it resumes at the next eligible task; it does not re-run tasks already marked `completed`.
4. If a task is unrecoverable as written, mark it `disabled` in `RUN_QUEUE.yaml` (don't delete it — that loses the record), fix the prompt or dependencies, add a new task with a new id if needed, then `npm run ai:queue:validate` before trying again.

`npm run ai:queue:reset -- --confirm` is the last resort for wiping state — see `docs/AI_OVERNIGHT_QUEUE.md`'s note on exactly what it does and doesn't touch (never branches, PRs, commits, or logs).

## Reviewing PRs in dependency order

`npm run ai:morning-brief` states the merge order explicitly for whatever ran that session, under "Merge order" — read that first. In general: a task with `depends_on: ["001"]` under `branch_strategy: stacked` was built on top of `001`'s branch, so its PR's diff against `main` includes `001`'s changes too until `001` is merged. Review and merge `001` first; after that merges, `002`'s PR (assuming it targets `001`'s branch, or is rebased onto `main`) will show a clean, minimal diff.

## A queue file that won't validate

`npm run ai:queue:validate` prints every problem, not just the first — fix them together rather than one at a time. Two categories worth knowing about specifically:

- **"Production schedule gate appears ENABLED in the repository itself"** — this means `lib/trigger/scheduleActivation.ts`'s `ATTACH_DECLARATIVE_PRODUCTION_CRONS` is `true` right now, independent of anything in the queue file. This is a repository-level production-safety issue, not a queue-config mistake — stop and resolve it directly (see `.ai/ARCHITECTURE.md` and `.ai/DECISIONS.md` ADR-0004) before touching the queue at all.
- **"could never become eligible"** — a pending task depends on a task marked `disabled`. Either enable the dependency too, or mark the dependent task `disabled` as well until it's ready.

## Something looks like it might contain a secret

`.ai/exports/` files run through `scripts/ai/redact.ts` before being written, which catches common secret shapes (OpenAI-style keys, Supabase tokens, JWTs, GitHub tokens, PEM private keys, bearer tokens) — but it's a safety net, not a guarantee. If you spot something that looks sensitive in an export or a run log:

1. Do not commit or upload it further.
2. Delete the affected file(s) locally.
3. Rotate whatever credential it was, treating it as exposed.
4. Improve the pattern list in `scripts/ai/redact.ts` so the same shape is caught next time, and note what happened in `.ai/OPEN_ITEMS.md`.

Raw per-task logs (`.ai/runs/*/task-*.log`) are gitignored specifically because they're the most likely place for something unexpected to show up — see `.ai/runs/README.md`.
