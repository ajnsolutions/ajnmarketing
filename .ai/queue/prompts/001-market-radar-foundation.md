# Task 001 — Market Radar: owner-managed competitor & benchmark persistence foundation

> This is a REAL queue task (`status: pending` in `RUN_QUEUE.yaml`), not a documentation example. It was reviewed and approved by a human before being added to the queue. It still must not need real-time human judgment to execute safely — if anything below turns out to be ambiguous once you're in the code, stop per the "When requirements are ambiguous" rule and do not guess.

## Before you start

1. Read `AGENTS.md` in full.
2. Read every file under `.ai/`: `CURRENT_STATUS.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `OPEN_ITEMS.md`, `HANDOFF.md`, `STATUS.json`.
3. Read `docs/project-magic/MARKET_RADAR.md` (product design, especially its "Owner control" section), `docs/project-magic/EXISTING_SYSTEM_AUDIT.md` (the "Market Radar" table — it classifies "Owner-facing competitor add/remove/prioritize control" and "Aspirational-benchmark tracking" as **Needs Expansion** / **New Functionality**, and confirms `lib/market-context/` is a real, already-working foundation this task extends, not replaces), and `docs/project-magic/WIREFRAMES.md`'s "Market Radar" section (for context on what Task 002 will build on top of this).
4. Read `lib/market-context/types.ts` and `lib/market-context/providers/competitorProvider.ts` / `competitorProfile.ts` to see the existing competitor-signal code this task sits alongside (but does not modify — see Scope below).
5. Verify all of the above against the actual repository state (`git log`, current `supabase/migrations/` contents, current `lib/` structure) before writing any code. If the repository has drifted from what `.ai/` describes, trust the repository and code it as an open item rather than silently proceeding on stale assumptions.

## Objective

Add the **persistence foundation** for owner-managed Market Radar tracking: a database table plus typed, tenant-scoped functions that let an owner track named competitors and aspirational benchmarks, matching exactly the four controls named in `docs/project-magic/MARKET_RADAR.md`'s "Owner control" section:

- **Add a competitor** — name a specific business to track.
- **Remove a competitor** — stop tracking one.
- **Prioritize competitors** — signal which matter most (an ordering/ranking value).
- **Benchmark an aspirational company** — track a non-competitor business for inspiration (a distinct "kind" from a competitor, per the doc — never conflated with head-to-head competitive framing).

This task is **persistence and types only** — no UI, no new route, no wiring into the existing `lib/market-context/` signal/recommendation pipeline, no monitoring or scraping of any external competitor data. Task 002 (a separate, already-queued task that depends on this one) builds the owner-facing view on top of what you create here. Actual competitor/market *monitoring* is a future, larger, and explicitly out-of-scope phase — do not attempt any part of it here, and do not invent a design for it.

## Scope — exactly these changes

1. **A new Supabase migration file**, `supabase/migrations/037_market_radar.sql` (check the actual highest-numbered file in `supabase/migrations/` first in case a later migration has been added since this prompt was written, and number accordingly). Follow the exact structural convention of the most recent existing migrations (e.g. `035_website_testimonials.sql`, `036_opportunity_detection_engine.sql`): a `public.market_radar_entries` table with (at minimum) `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `business_profile_id uuid not null references public.business_profiles(id) on delete cascade`, a `kind` column constrained to exactly two values — `'competitor'` and `'benchmark'` — a `name text not null`, a nullable `priority integer` (meaningful only for competitors; leave null for benchmarks), an optional `notes text`, and `created_at`/`updated_at timestamptz` columns with the same `updated_at` trigger pattern the existing migrations use. Add indexes on `business_profile_id` and `user_id`, matching existing convention. Enable RLS and add **select/insert/update/delete** policies scoped to `auth.uid() = user_id` — mirror `035_website_testimonials.sql`'s exact policy style (the owner can genuinely delete their own tracked entry; this is not a system-lifecycle record like `detected_opportunities`, which retires rather than deletes). **Do not** add a `using (true)` policy anywhere. **Do not** apply/run this migration against any database — writing the file is the entire deliverable; applying a migration to any environment (local, staging, or production) remains a separate, human, explicit action per `AGENTS.md` rule 13.
2. **`lib/market-radar/types.ts`** — a `MarketRadarEntryKinds` const object (`{ COMPETITOR: "competitor", BENCHMARK: "benchmark" }`) and its derived type, plus a `MarketRadarEntry` type mirroring the table's columns (camelCase, following this repo's established mapping convention — see `lib/opportunity-engine/persistence.ts`'s `mapRow` for the pattern of converting a raw Supabase row into a typed object).
3. **`lib/market-radar/persistence.ts`** — tenant-scoped functions following the `*ForUser(userId, ...)` convention (ADR-0001 in `.ai/DECISIONS.md`), each taking an explicit `SupabaseClient` parameter (this repo's established pattern — see `lib/opportunity-engine/persistence.ts` for the exact shape to mirror):
   - `listMarketRadarEntriesForUser(supabase, userId, businessProfileId)` — returns all entries for that business, competitors ordered by priority (nulls last) then name, benchmarks after, ordered by name.
   - `addMarketRadarEntryForUser(supabase, userId, businessProfileId, input: { kind, name, notes? })` — inserts and returns the new entry, or `null` on failure (matching this repo's existing `insertOpportunity`-style error handling: log nothing sensitive, return `null`, never throw across this boundary).
   - `removeMarketRadarEntryForUser(supabase, userId, entryId)` — deletes an entry, scoped so a user can only delete their own (the RLS policy is the authoritative enforcement; the function itself should still filter by `user_id` in its query, matching this repo's defense-in-depth convention).
   - `setMarketRadarEntryPriorityForUser(supabase, userId, entryId, priority: number | null)` — updates only the priority column.
4. **Unit tests**: this repository's established convention (see `lib/opportunity-engine/persistence.ts` and its test coverage) does **not** unit-test raw Supabase CRUD wrapper functions directly, since `unit-tests/*.test.ts` run via plain Node (`node --import ./unit-tests/support/register.mjs --test`) without a live database. Instead, extract and unit-test any **pure** logic you introduce — specifically, the ordering/sorting rule in `listMarketRadarEntriesForUser` (competitors-by-priority-then-name, benchmarks-after) should live in its own small, pure, exported function (e.g. `sortMarketRadarEntries(entries: MarketRadarEntry[]): MarketRadarEntry[]` in `lib/market-radar/types.ts` or a new `lib/market-radar/sort.ts`) so it can be unit-tested directly without a database, following the exact pattern this repo already uses throughout `lib/business-brain-inspector/`, `lib/opportunity-engine/`, etc. (pure composition functions tested directly; DB IO wrappers not unit-tested in isolation). Add these tests under `unit-tests/market-radar-foundation.test.ts`, following the file-naming and `node:test`/`node:assert` style already used by every other `unit-tests/*.test.ts` file in this repo.
5. **Documentation**: add a short "Implementation status" note near the top of `docs/project-magic/MARKET_RADAR.md` (a few sentences, not a rewrite — that file is product-design source-of-truth per ADR-0010 in `.ai/DECISIONS.md` and must otherwise stay as-is) stating that the owner-managed persistence foundation (`lib/market-radar/`, migration `037_market_radar.sql`) has shipped, and that the owner-facing view is the next, already-queued phase. Update `.ai/ROADMAP.md`'s Market Radar "Next" bullet similarly (a sentence noting the foundation has landed), and update `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, and `.ai/HANDOFF.md` per `AGENTS.md`'s "Before finishing any work" section — `HANDOFF.md` should be overwritten (not appended to) with this task's own branch/status/tests/PR/blockers/recommended-next-step, per its own header instructions.

## Explicitly out of scope — do not do these

- No new route, page, or component. No UI at all.
- No changes to `lib/market-context/providers/competitorProvider.ts`, `competitorProfile.ts`, or any other existing market-context file — this task adds a new, separate module (`lib/market-radar/`) alongside the existing one, per the audit's framing ("expansion, not a rebuild"; a new capability, not a change to the existing signal pipeline).
- No monitoring, scraping, or detection of real competitor activity, pricing, or promotions — that is a separate, larger, unscoped future phase and is explicitly not part of this task or Task 002.
- No changes to `lib/marketing-director/`, `lib/opportunity-engine/`, Growth Advisor, or any recommendation surface.
- Applying (running) the migration against any database, local or otherwise.

## Standing rules (restated from AGENTS.md — read AGENTS.md itself for full context)

- Never merge a pull request automatically.
- Never deploy, or trigger/configure a deployment, automatically.
- Never modify secrets, environment values, credentials, or API keys.
- Never apply a production (or any) database migration automatically — write the migration file only.
- Never activate a production schedule. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` in `lib/trigger/scheduleActivation.ts` must remain `false`; do not touch that file.
- Never weaken, skip, bypass, disable, or delete a meaningful test to make a quality gate pass.
- If any requirement above turns out to be materially ambiguous once you're actually working in the code, stop. Record the specific ambiguity and what you'd need to know in both `.ai/OPEN_ITEMS.md` (as a blocker) and `.ai/HANDOFF.md` (as the reason work stopped), then end the task cleanly — do not half-implement a guess.

## Workflow requirements

- Create (or use, if it already exists) the feature branch `ai-queue/001-market-radar-foundation`.
- Batch related, safe shell operations together before executing them; minimize approval prompts by grouping safe commands and avoiding unnecessary shell invocations.
- Run autonomously through the full task without pausing for routine, non-destructive Bash approvals. Batch and defer any approval-requiring shell commands until the end whenever safely possible, then present the minimal grouped approval set once — but do not defer an approval that is required to proceed safely (e.g. before a genuinely irreversible step), and pause before any destructive or irreversible operation.
- Implement only the defined phase above — do not expand scope into Task 002's work or into the out-of-scope items listed.
- Run the applicable quality gates and fix any regression your own change causes: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`. (Note: the queue runner itself automatically re-checks `lint`, `typecheck`, and `test:unit` after you finish and will fail the task if any of them fail — running the fuller set including `build` yourself first catches problems the runner's own check wouldn't.) All meaningful CI-equivalent quality gates must pass. Do not weaken or bypass a test to make one pass.
- Update the affected `.ai/` project-memory files (see step 5 of Scope above) in this same branch — this is required before the queue runner will consider the task complete; it fails the task if no `.ai/` memory file changed.
- Commit your changes, push the branch, and open a pull request. Never merge it. Never deploy. Never apply a production migration. Never modify a secret. Never activate a schedule.
- After tests pass and the PR is created, send a macOS notification (if available in your environment) with the branch name and success/failure — if no such notification mechanism is available in your environment, say so honestly in your final report instead of silently skipping it.

## Report

At the end, report: branch name, final commit SHA, PR URL, which tests were run and their results, any blockers encountered, and your recommended next action (which should ordinarily be: "Task 002 is ready to run against this branch").
