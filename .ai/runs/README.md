# `.ai/runs/`

Each queue execution (`npm run ai:queue`) creates one directory here, named for its run ID (a UTC timestamp, e.g. `2026-07-31T020000Z`):

```
.ai/runs/<run-id>/
  baseline.json           # Queue v2: the QualitySnapshot captured before this run's first task
  RUN_SUMMARY.md          # human-readable summary of what happened this run
  RUN_STATUS.json         # machine-readable summary, same content as RUN_SUMMARY.md
  task-001.log            # full stdout/stderr for task 001's agent invocation (+ any repair attempts)
  task-001-quality.json   # Queue v2: task 001's baseline/current/comparison/repairAttempts
  task-002.log            # ...one pair of files per task actually attempted this run
  task-002-quality.json
```

`baseline.json` and each `task-<id>-quality.json` are written by `scripts/ai/qualityGates.ts`'s `captureQualitySnapshot`/`compareQualitySnapshots`, invoked from `run-queue.ts` — see `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue v2 — baseline-aware quality gates" section for what they mean and why comparing against a captured baseline (rather than requiring a perfectly clean repository) is the whole point of Queue v2.

## What is and isn't committed

`RUN_SUMMARY.md`, `RUN_STATUS.json`, `baseline.json`, and `task-*-quality.json` are safe, redacted summaries (counts, test names, pass/fail — never raw tool output) and are committed. Raw `task-*.log` files are **not committed** — they can contain full tool output, file contents, or command output that may include incidental sensitive data (see `.gitignore`'s `.ai/runs/*/task-*.log` rule). If you need to inspect a raw log, look at it locally; do not remove the ignore rule to force one into a commit.

`generate-morning-brief.ts` reads the most recent run's `RUN_STATUS.json`/`RUN_SUMMARY.md` to build `.ai/exports/MORNING_BRIEF.md` — that's the file meant for a quick, non-technical read the next morning.

Run directories are never deleted automatically, including by `npm run ai:queue:reset` — see `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue reset" section for exactly what reset does and does not touch.
