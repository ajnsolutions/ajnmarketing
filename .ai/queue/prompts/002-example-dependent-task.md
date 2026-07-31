# Example task 002 — depends on task 001

> **Example only.** This task is `status: disabled` in `RUN_QUEUE.yaml` and will not run until a human enables it. It exists to show how a queue task declares a dependency on another task's branch.

## Objective

Add a one-line cross-reference from `docs/AI_QUEUE_TROUBLESHOOTING.md`'s troubleshooting index pointing to the "Terminology" section that task 001 added to `docs/RUNBOOKS.md`.

## Depends on

Task `001` (`depends_on: ["001"]` in `RUN_QUEUE.yaml`). This task must not run until 001 has completed successfully and its branch/PR exists — the term this task links to doesn't exist until 001 has shipped it.

## Scope

- Touches exactly one file: `docs/AI_QUEUE_TROUBLESHOOTING.md`.
- Documentation only.

## Done means

- A single added line/link in `docs/AI_QUEUE_TROUBLESHOOTING.md` referencing the term defined in task 001.
- No other file changes.
- `npm run lint` and `npm run test:unit` still pass.

## Standing rules (restated, already covered by `AGENTS.md`)

Same as task 001 — nothing here touches secrets, migrations, deployment, merges, or production schedules.
