# `.ai/runs/`

Each queue execution (`npm run ai:queue`) creates one directory here, named for its run ID (a UTC timestamp, e.g. `2026-07-31T020000Z`):

```
.ai/runs/<run-id>/
  RUN_SUMMARY.md     # human-readable summary of what happened this run
  RUN_STATUS.json    # machine-readable summary, same content as RUN_SUMMARY.md
  task-001.log       # full stdout/stderr for task 001's agent invocation
  task-002.log       # ...one per task actually attempted this run
```

## What is and isn't committed

`RUN_SUMMARY.md` and `RUN_STATUS.json` are safe, redacted summaries and are committed. Raw `task-*.log` files are **not committed** — they can contain full tool output, file contents, or command output that may include incidental sensitive data (see `.gitignore`'s `.ai/runs/*/task-*.log` rule). If you need to inspect a raw log, look at it locally; do not remove the ignore rule to force one into a commit.

`generate-morning-brief.ts` reads the most recent run's `RUN_STATUS.json`/`RUN_SUMMARY.md` to build `.ai/exports/MORNING_BRIEF.md` — that's the file meant for a quick, non-technical read the next morning.

Run directories are never deleted automatically, including by `npm run ai:queue:reset` — see `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue reset" section for exactly what reset does and does not touch.
