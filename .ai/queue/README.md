# `.ai/queue/`

The overnight/sequential task queue. Full usage guide: [`docs/AI_OVERNIGHT_QUEUE.md`](../../docs/AI_OVERNIGHT_QUEUE.md). This file is just an orientation to what's in this directory.

| File | Purpose | Who writes it |
|---|---|---|
| `RUN_QUEUE.yaml` | The queue definition: safety settings, tasks, dependencies, branch strategy. | A human, by hand. Never auto-generated. |
| `QUEUE_STATUS.json` | Current run state: which task is active, completed, failed; branches/commits/PRs recorded per task. | `scripts/ai/run-queue.ts` and `scripts/ai/reset-queue.ts`. Do not hand-edit — run `npm run ai:queue:status` to read it, `npm run ai:queue:reset -- --confirm` to reset it. |
| `prompts/` | The full instruction text for each task, one file per task. | A human, by hand — see `prompts/README.md`. |

Related, one level up: `.ai/runs/` holds per-execution logs and summaries (`scripts/ai/run-queue.ts` writes these, including Queue v2's `baseline.json` and per-task `task-<id>-quality.json` — see `.ai/runs/README.md` and `docs/AI_OVERNIGHT_QUEUE.md`'s "Queue v2" section); `.ai/exports/` holds the human/ChatGPT-facing exports (`scripts/ai/export-memory.ts` and `scripts/ai/generate-morning-brief.ts` write these).

## Quick commands

```bash
npm run ai:queue:validate   # check RUN_QUEUE.yaml for errors, no execution
npm run ai:queue            # validate, then run the queue to completion or first failure
npm run ai:queue:status     # print current queue state
npm run ai:queue:reset -- --confirm   # reset local queue state only (see docs/AI_OVERNIGHT_QUEUE.md)
```

## The one rule that matters most

This queue can never merge a PR, deploy, apply a production migration, change a secret, or activate a production schedule — `scripts/ai/validate-queue.ts` enforces this by rejecting the whole queue file if any task or the `safety:` block asks for one of those, independent of whatever the task prompt itself says. See `docs/AI_OVERNIGHT_QUEUE.md`'s "What the queue never does" section.
