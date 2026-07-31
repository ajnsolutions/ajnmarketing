# Queue prompts

Each file here is the full instruction text for one queue task — exactly what gets handed to the agent (Claude Code, for now) as its prompt when `run-queue.ts` reaches that task.

## Writing a good prompt file

A queue prompt is unattended by design — no one will be watching to clarify anything mid-task. Write it the way you'd write a task for a careful contractor who will stop and ask nothing:

- State the objective and the specific files/areas involved.
- State what "done" looks like (tests that must pass, behavior that must work).
- Explicitly restate the standing safety rules relevant to this task if there's any risk of ambiguity (most tasks don't need this — `AGENTS.md` already covers it — but a task that touches something migration-adjacent or schedule-adjacent should say so explicitly anyway, as a second layer).
- If a task is genuinely safe only because of something narrow ("this only touches `docs/`, no code paths"), say that too — it helps the agent recognize if scope is creeping beyond what was reviewed when the task was approved.

A prompt file is a plan a human already reviewed and approved by adding it to `RUN_QUEUE.yaml` — it should not need real-time human judgment calls to execute safely. If you're not sure a task can be written that unambiguously, it's not ready for the overnight queue; run it interactively instead.

## Numbering

Prompt files are numbered to match their task `id` in `RUN_QUEUE.yaml` (`001-*.md` ↔ task id `"001"`), purely for human readability while browsing the directory. The queue itself resolves prompts by the `prompt:` path in `RUN_QUEUE.yaml`, not by filename pattern.

## The two example files in this directory

`001-example-safe-task.md` and `002-example-dependent-task.md` are documentation-only examples showing a safe task and a dependent task. They are marked `status: disabled` in `RUN_QUEUE.yaml` and will never run until a human changes that status — see that file's own header comment before doing so.
