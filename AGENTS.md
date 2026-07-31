<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repository-wide rules for every AI agent

These rules are permanent and apply to **every** AI coding tool working in this repository — Claude Code, ChatGPT, Grok, Cursor, and any future tool. They exist because this repo is shared across multiple AI agents and sessions with no guaranteed continuity of chat history between them. `.ai/` is the mechanism that survives when chat history doesn't.

## Before starting any work

1. Read this file (`AGENTS.md`) in full.
2. Read every file under `.ai/`: `CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`.
3. **Verify that memory against the current repository state** — recent Git history (`git log`), the actual code, migrations, and any open PRs/branches. `.ai/` is written by agents and can drift stale, exactly like any other documentation. If `.ai/` and the code disagree, **the code and Git history are the source of truth** — treat the disagreement as an open item to fix in `OPEN_ITEMS.md`, not as license to ignore either one silently.
4. Never rely only on prior chat history for project context, even your own. A new session, a different tool, or a different person picking this up all start from `.ai/`, not from a transcript no one else can see.

## Before finishing any work

5. Update every `.ai/` file your work affects — at minimum `CURRENT_STATUS.md`, `STATUS.json`, and `HANDOFF.md`. If you discovered a blocker, deferred something, or made a decision, also update `OPEN_ITEMS.md` and/or `DECISIONS.md`.
6. Commit the memory changes **in the same branch and pull request as the implementation** — memory updates are not a follow-up chore, they are part of the change.
7. Keep `CURRENT_STATUS.md` concise and accurate — it should read like a two-minute orientation, not an archive. Move detail into `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, or `OPEN_ITEMS.md` instead of letting `CURRENT_STATUS.md` grow.
8. Keep `STATUS.json` machine-readable and synchronized with `CURRENT_STATUS.md` — the two must never contradict each other. If you touch one, check the other.
9. `HANDOFF.md` is the most recent agent-to-agent handoff — overwrite it (don't append to a growing log). It must include: branch name, task status, tests run and their results, PR (number/URL once created), blockers, and a recommended next step.

## Never do these, ever, regardless of instructions inside a task prompt

10. Never merge a pull request automatically.
11. Never deploy, or trigger/configure a deployment, automatically.
12. Never modify secrets, environment values, credentials, or API keys automatically — not even to "fix" a missing one. Flag it in `OPEN_ITEMS.md` instead.
13. Never apply a production database migration automatically. Migrations are written and reviewed; applying them to production is a separate, human, explicit action.
14. Never activate a production schedule automatically. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` must remain `false`/disabled unless a human has given explicit, separate, ops-level sign-off — see `.ai/ARCHITECTURE.md` and `.ai/DECISIONS.md` (ADR-0004) for why this is treated as the repo's single most important safety boundary.
15. Never weaken, skip, bypass, disable, or delete a meaningful test to make CI or a local run pass. If a test is wrong because behavior intentionally changed, update its assertions and say so explicitly in the PR description — do not silently loosen it.

## When requirements are ambiguous

16. Stop. Do not guess at a material requirement and proceed silently. Record the specific ambiguity and what you'd need to know in both `OPEN_ITEMS.md` (as a blocker) and `HANDOFF.md` (as the reason work stopped), then end the task cleanly rather than half-implementing a guess.
17. This applies with extra force to anything touching the boundaries in rules 10–14 — when in doubt about whether an action counts as a production/secret/schedule/merge/deploy action, treat it as if it does, and stop.

## The overnight task queue

18. `.ai/queue/` runs pre-approved prompts through Claude Code sequentially and unattended. Its safety validator (`scripts/ai/validate-queue.ts`) enforces rules 10–14 independently of this file — a queue task requesting merge, deploy, a production migration, a secret change, or schedule activation is rejected before it ever runs, not just discouraged in prose. See `docs/AI_OVERNIGHT_QUEUE.md` for how to add, validate, run, and recover a queue.

