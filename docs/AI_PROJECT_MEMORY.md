# AI Project Memory

This repository is worked on by multiple AI coding tools — Claude Code, ChatGPT, Grok (in Cursor), Cursor's own models, and whatever comes next — often in separate sessions with no shared chat history between them. `.ai/` is the mechanism that survives when chat history doesn't. This document explains the model; the rules themselves live in `AGENTS.md`.

## The shared memory model

```
.ai/
  CURRENT_STATUS.md   # two-minute orientation: mission, phase, blockers, next step
  ROADMAP.md           # Completed / In progress / Next / Later / Pre-launch requirements
  ARCHITECTURE.md       # framework, data, AI, jobs, publishing, testing, deployment, boundaries
  DECISIONS.md          # dated architecture decision records (ADRs)
  OPEN_ITEMS.md          # blockers, deferred work, risks, unresolved decisions, pre-launch reqs
  HANDOFF.md             # the most recent agent-to-agent handoff (overwritten, not appended)
  STATUS.json            # machine-readable twin of CURRENT_STATUS.md
  queue/                 # the overnight task queue — see docs/AI_OVERNIGHT_QUEUE.md
  runs/                  # queue execution logs
  exports/                # PROJECT_MEMORY.md and MORNING_BRIEF.md — see below
```

Two properties make this work:

1. **It's read before every task, by every tool.** `AGENTS.md` (universal), `CLAUDE.md` (Claude Code's entry point), and `.cursor/rules/project-memory.mdc` (Cursor, including Grok) all point here first, before any tool-specific instructions.
2. **It's updated after every task, in the same PR as the code.** Memory that lives in a separate follow-up commit — or worse, only in someone's head — drifts stale immediately. See `AGENTS.md`'s "Before finishing any work" section.

## Memory can go stale — verify it

`.ai/` is written by agents, and agents make mistakes or miss things, exactly like any other documentation in this repo (`docs/project-magic/IMPLEMENTATION_ROADMAP.md`'s drift from actually-shipped work, recorded in `.ai/OPEN_ITEMS.md`, is a real example this build found, not a hypothetical). **When `.ai/` and the code disagree, the code and Git history are the source of truth.** Every agent is required to verify memory against `git log`, the actual files, and any open PRs/branches before relying on it — never trust a summary blindly, including this one.

## How Claude Code reads it

`CLAUDE.md` is a thin pointer (`@AGENTS.md` plus an explicit list of `.ai/` files to read first). It intentionally does not duplicate any project context — that would create a second copy to keep in sync and a second place to go stale. See `docs/AI_AGENT_WORKFLOW.md` for the full read/verify/update cycle Claude Code (and every other tool) follows.

## How Grok in Cursor (or any Cursor-selected model) reads it

`.cursor/rules/project-memory.mdc` is set to `alwaysApply: true`, so it loads on every request in this repo regardless of which model Cursor is using. It restates the same read-before/update-after cycle and the same safety boundaries as `AGENTS.md`, because Cursor loads its own rule file, not `AGENTS.md` directly — the two are kept in sync deliberately; if you change one, check the other.

## How ChatGPT (or another AI without direct repository access) receives it

Run `npm run ai:memory:export`. It combines `CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`, and the most recent queue run's summary (if any) into a single file: `.ai/exports/PROJECT_MEMORY.md`. Upload that one file to ChatGPT (or paste its contents) when it can't browse this repository directly. It runs through a redaction pass (`scripts/ai/redact.ts`) before being written, as a safety net against ever exporting a secret-shaped string — see `docs/AI_QUEUE_TROUBLESHOOTING.md` if you think something sensitive ended up in there anyway.

`PROJECT_MEMORY.md` is a snapshot, not a live view — regenerate it (`npm run ai:memory:export`) before an important ChatGPT session if `.ai/` has changed since the last export.

## Why this isn't just "better docs/"

`docs/*.md` (70+ files) is rich, valuable, product-history documentation — it is not replaced or superseded by `.ai/`. The difference is purpose: `docs/` explains *why* and *how* a feature works in depth; `.ai/` is a fast, structured, machine-readable orientation layer that points into `docs/` rather than duplicating it. Read `.ai/CURRENT_STATUS.md` first to know where you are; follow its links into `docs/` for depth.
