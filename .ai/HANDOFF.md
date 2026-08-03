# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`ai-queue/003-competitor-observation-engine` (built on `main` @ `7177304`, the merge of PR #105 — Task 001's own branch had already merged by the time this task started, so per ADR-0015's dependency-base resolution this task's base is `main`, not Task 001's branch name).

## Task status

**Complete.** Task 003 — Competitor Observation Engine: the evidence, confidence, and persistence foundation for competitor observations. No UI, no route, no cron wiring — exactly as scoped in `.ai/queue/prompts/003-competitor-observation-engine.md`.

## What was built

1. **`supabase/migrations/038_competitor_observations.sql`** (new, not applied to any database per `AGENTS.md` rule 13) — `public.competitor_observations` table: `id`, `user_id` → `auth.users`, `business_profile_id` → `public.business_profiles`, `market_radar_entry_id` → `public.market_radar_entries` (the tracked competitor this observation is about), `summary text not null`, `confidence text not null check (in low/medium/high)`, `source_label text not null`, `occurred_at timestamptz` (nullable), `created_at`/`updated_at` with the same trigger pattern as `037_market_radar.sql`. Indexed on `business_profile_id`, `user_id`, `market_radar_entry_id`. RLS enabled with select/insert/update/delete policies scoped to `auth.uid() = user_id`, mirroring `037_market_radar.sql` exactly.
2. **`lib/competitor-observations/types.ts`** — `CompetitorObservationConfidences`/`CompetitorObservationConfidence` (`low`/`medium`/`high`, matching `ConfidenceLevels`'s spirit from `lib/business-knowledge-graph/types.ts`) and `CompetitorObservation` (camelCase, mirrors the table).
3. **`lib/competitor-observations/scoring.ts`** — the actual judgment-and-filtering logic, pure and unit-tested: `scoreCompetitorSignal(signal: MarketContextItemInput, trackedEntry: MarketRadarEntry): { meaningful, confidence, summary } | null`. Returns `null` when the signal doesn't pertain to the tracked entry at all (wrong `MarketRadarEntry.kind` — benchmarks are never scored; wrong `signal.category`; `metadata.isFallback === true`; no `metadata.competitorName`; or the competitor name doesn't plausibly match the tracked entry's owner-typed name). Otherwise scores by `signal.confidenceScore` (0-100) against three documented, load-bearing thresholds: below 40 → not meaningful (filtered out); [40, 55) → meaningful, `low`; [55, 75) → meaningful, `medium` (this is where the real, live `competitorProvider.ts` profile-declared signal currently lands — confidenceScore 68); [75, 100] → meaningful, `high` (not yet produced by the live provider, exercised only by a synthetic test input — documented as such in the code). Name matching is a deliberately permissive normalize + substring-containment heuristic (documented inline), not exact equality, since owner-typed tracked-competitor names and profile-parsed competitor names are real free text that rarely match exactly. The returned `summary` is always the signal's own summary text, verbatim — never fabricated.
4. **`lib/competitor-observations/persistence.ts`** — `listCompetitorObservationsForUser`, `recordCompetitorObservationForUser` (null-on-failure, matching `lib/opportunity-engine/persistence.ts`'s convention), and `generateCompetitorObservationsForUser` (the orchestration function: lists the owner's tracked competitors via Task 001's `listMarketRadarEntriesForUser`, filters to `kind: "competitor"`, builds a `MarketContextProviderContext` the same way `lib/market-context/marketContextService.ts` does — loads the `business_profiles` row and AI marketing profile, then calls `CompetitorProvider().fetchItems()` — scores every tracked-entry/signal pair via `scoreCompetitorSignal`, and persists only the meaningful ones). De-duplication rule (documented in code): an observation is a duplicate of one already recorded if it has the same `market_radar_entry_id` **and** the same `summary` text — `competitorProvider.ts`'s profile-declared signal is deterministic per business-profile state, so this is stable across repeated runs against unchanged profile data.
5. **`unit-tests/competitor-observation-engine.test.ts`** (new, `node:test`/`node:assert` style) — 11 tests covering `scoreCompetitorSignal` exclusively (raw Supabase persistence functions are deliberately not unit-tested, per this repo's established convention — see `lib/opportunity-engine/persistence.ts`'s own test coverage): fallback/mock signal never meaningful; a signal about an untracked competitor is never scored; benchmarks are never scored; non-competitor-category signals are never scored; low-confidence-score signal maps to `low`, still meaningful; a signal below the meaningful floor is filtered out entirely; the real provider's live confidence score (68) maps to `medium`; a high confidence score maps to `high`; fuzzy name matching (case/punctuation-insensitive); summary text is passed through verbatim; a signal with no competitor-name metadata is never scored.
6. **Docs**: `docs/project-magic/MARKET_RADAR.md`'s "Implementation status" note extended — records that the observation/evidence/confidence engine has shipped and is deliberately not live monitoring. `.ai/ROADMAP.md`'s Market Radar "Next" bullet updated to reflect Task 003 shipped, Tasks 004/005 now unblocked. `.ai/CURRENT_STATUS.md` and `.ai/STATUS.json` updated to match (see diffs in this branch).

## Tests

All run from a clean state on this branch before opening the PR:

- **`unit-tests/competitor-observation-engine.test.ts`** (new, standalone run): 11/11 passing.
- **`npm run lint`**: clean — 0 errors, 7 pre-existing warnings in files this task did not touch (`google-business-review-card.tsx`, `background-jobs/service.ts`, `google-business-profile/persistence.ts`, `contextScoringService.ts`, `marketing-agent-server.ts`, `openai-extractor.ts`).
- **`npm run typecheck`**: 18 errors — identical to the documented pre-existing baseline (`.ai/OPEN_ITEMS.md`'s "Pre-existing type-check debt"), same 10 unrelated unit-test files, zero new errors, none in any file this task added or touched.
- **`npm run test:unit`**: **1808/1808 passing** (full suite, including the 11 new tests above).
- **`npm run build`**: succeeded, exit 0, no errors.
- **Playwright (`npm run test:e2e`)**: not run — this task adds no route, no component, no UI; matches Task 001's own precedent (persistence/types-only scope) for when Playwright is out of scope.

## PR

Being opened immediately after this commit is pushed — branch `ai-queue/003-competitor-observation-engine` → base `main` (Task 001 had already merged into `main` via PR #101 by the time this task started, so per `resolveDependencyBase()`/ADR-0015 the correct base is `main`, not Task 001's own now-deleted branch). See the final task report for the actual PR URL and commit SHA once created. Not merged. Not deployed.

## Blockers

None. Requirements were unambiguous once the actual repository state was verified against `.ai/`'s description of it (Task 001/002 both already merged, migration `037` present, `lib/market-radar/` and `lib/market-context/providers/competitorProvider.ts`/`competitorProfile.ts` all present and matching the prompt's description — no drift found).

## Confirmation of safety boundaries

No deployment occurred. No Supabase migration was applied — `038_competitor_observations.sql` is a written file only, never run against any database. No secrets, environment variables, or credentials were modified or added. No production schedule was activated — `ATTACH_DECLARATIVE_PRODUCTION_CRONS` (`lib/trigger/scheduleActivation.ts`) untouched, still `false`. No cron job, scheduled trigger, or background job wiring was added — `generateCompetitorObservationsForUser` is a plain callable function; when/how it runs is explicitly deferred to Task 004/005 or later, per this task's own "Explicitly out of scope" section. No merge was performed automatically. No new external data source, scraper, or API integration was added — the only signal source consulted is the existing, unmodified `lib/market-context/providers/competitorProvider.ts`/`competitorProfile.ts`, which this task reads but does not change.

## Recommended next step

Tasks 004 and 005 are both ready to run against this branch/PR once it merges — both depend only on Task 003, not on each other (non-linear dependency graph, per `.ai/OPEN_ITEMS.md`'s "First multi-task queue sprint" section). Reviewers should specifically check: (1) the scoring thresholds in `lib/competitor-observations/scoring.ts` are a real judgment call, not an accident — worth a deliberate sanity check, not just a diff skim; (2) `generateCompetitorObservationsForUser`'s de-duplication rule (entry id + summary text) before Task 004/005 build UI or reporting on top of it, in case either implementer wants a different dedupe granularity.
