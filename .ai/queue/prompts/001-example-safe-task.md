# Example task 001 — safe, documentation-only

> **Example only.** This task is `status: disabled` in `RUN_QUEUE.yaml` and will not run until a human enables it. It exists to show the shape of a safe, well-scoped queue prompt.

## Objective

Add a short "Terminology" section to `docs/RUNBOOKS.md` defining the term "queue task" the way it's used in `.ai/queue/` — one or two sentences, no more.

## Scope

- Touches exactly one file: `docs/RUNBOOKS.md`.
- Documentation only. No application code, no migrations, no dependencies, no configuration changes.

## Done means

- `docs/RUNBOOKS.md` has a new short section defining the term, placed sensibly near the top or in an existing "Terminology"/"Glossary" section if one exists.
- No other file changes.
- `npm run lint` and `npm run test:unit` still pass (they should be unaffected, but confirm rather than assume).

## Standing rules (restated, already covered by `AGENTS.md`)

This task never touches secrets, migrations, deployment, merges, or production schedules — there is nothing here that could plausibly require any of that. If in the course of this task anything suggests otherwise, stop and record it in `.ai/OPEN_ITEMS.md` rather than proceeding.
