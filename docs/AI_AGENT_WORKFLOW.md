# AI Agent Workflow

The read/verify/work/update cycle every AI tool follows in this repository, whether it's an interactive session (Claude Code, Cursor, ChatGPT with repo access) or an unattended queue task. The permanent rules this document walks through live in `AGENTS.md` — this is the narrative version.

## 1. Read before starting

Read, in order: `AGENTS.md`, then every file under `.ai/` (`CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`). This takes a few minutes and replaces what used to require either a long chat history no one else can see, or re-deriving context from scratch every session.

Tool-specific entry points just point here — they don't duplicate it:
- Claude Code: `CLAUDE.md` → `@AGENTS.md` + the `.ai/` file list.
- Cursor (including Grok): `.cursor/rules/project-memory.mdc`, `alwaysApply: true`.
- ChatGPT without repo access: `.ai/exports/PROJECT_MEMORY.md` (see `docs/AI_PROJECT_MEMORY.md`).

## 2. Verify memory against reality

Do not trust `.ai/` blindly — it's written by agents and can drift stale (this build's own research found `docs/project-magic/IMPLEMENTATION_ROADMAP.md`, a source `.ai/ROADMAP.md` draws from, already out of sync with shipped work; see `.ai/OPEN_ITEMS.md`). Before relying on anything in `.ai/`:
- `git log` for recent history the memory files might not reflect yet.
- Read the actual code/migrations/tests the task touches.
- Check for open PRs or unmerged branches (`gh pr list`, `git branch -r --no-merged`).

**When memory and code disagree, code and Git history win.** Record the disagreement in `.ai/OPEN_ITEMS.md` — don't silently pick one side and move on without leaving a trace.

## 3. Never rely only on chat history

Not yours, not another tool's. A new session — same tool or different — starts from `.ai/`, because that's the only thing guaranteed to be there. If something in this conversation's history contradicts `.ai/` or the repository, trust the repository.

## 4. Do the work, inside the standing safety rules

The full list is in `AGENTS.md`; the ones worth restating here because they apply regardless of what any task prompt says:

- Never merge, deploy, change secrets, apply a production migration, or activate a production schedule automatically.
- Never weaken, skip, bypass, or delete a meaningful test to make something pass.
- Follow this repository's normal branching/testing/PR conventions — no direct pushes to `main`, no skipped test suite because a change "looks small."

## 5. Stop on material ambiguity

If a requirement is genuinely ambiguous — not "I'd need to look something up" but "this could reasonably mean two different things and picking wrong matters" — stop. Record the specific ambiguity in `.ai/OPEN_ITEMS.md` and `.ai/HANDOFF.md`, and end the task cleanly instead of guessing, especially where the guess would touch merge/deploy/secrets/migrations/schedules.

## 6. Update memory before finishing

At minimum: `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, `.ai/HANDOFF.md`. Also update `.ai/OPEN_ITEMS.md` and/or `.ai/DECISIONS.md` if the task surfaced a blocker, deferred something, or made an architectural call. Keep `CURRENT_STATUS.md` and `STATUS.json` in sync with each other — they must never contradict.

`HANDOFF.md` gets overwritten, not appended to — it's a snapshot of the most recent handoff, not a growing log. It must include: branch name, task status, tests run and their results, PR (once created), blockers, and a recommended next step.

## 7. Commit memory with the implementation

In the same branch, same PR — not a follow-up commit, not a separate PR "for docs." A PR that changes behavior without updating `.ai/` is incomplete by this repository's own standard, exactly as much as a PR that skips its own tests.

## How the overnight queue fits this cycle

`.ai/queue/` (see `docs/AI_OVERNIGHT_QUEUE.md`) runs this exact same cycle per task, unattended: `scripts/ai/run-queue.ts` reads the task prompt, appends a standing reminder of this cycle to it, runs the agent, requires a quality-gate pass, **requires a `.ai/` memory file to have actually changed before it will commit** (a hard check, not a suggestion), then commits, pushes, and opens a PR. A task that doesn't touch `.ai/` fails the run rather than completing silently.
