# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`ai-queue/006-marketing-director-evidence`, branched from `main` @ `f45ed15` (the merge of PR #110 — Task 005 — which already contains PRs #101/#104/#107/#108/#109 and Tasks 001–005).

## Task status

**Task 006 (Integrate Market Radar Evidence into Marketing Director Recommendations) is COMPLETE on this branch, not yet merged.** This was implemented directly in this session — not through the overnight queue's own `npm run ai:queue` subprocess mechanism — as part of a controlled validation exercise that also considered Task 007 (Seasonal Intelligence) as a pairing task. Task 007 was investigated and explicitly stopped before any implementation, per its own explicit instruction not to invent product scope to obtain a second task — see `OPEN_ITEMS.md`'s "Task 007 stop condition" entry for the full reasoning. Since a single-task run wouldn't demonstrate the queue's still-unproven multi-task-per-invocation continuation, Task 006 was built directly rather than staged through the queue for a validation that couldn't happen.

## What shipped

The fourth and last of Market Radar's originally-planned "How it surfaces" points (`docs/project-magic/MARKET_RADAR.md`) — real, current, sufficiently-confident competitor evidence now appears alongside Marketing Director recommendations.

1. **`lib/recommendation-presentation/types.ts`** — new `ClientCompetitorEvidence` type (`{ observation, competitorName, confidenceLabel, confidenceExplanation, sourceLabel }`) and a new, always-present `competitorEvidence: ClientCompetitorEvidence[]` field on `ClientRecommendationDecisionPackage` (`[]` when nothing qualifies — never omitted, matching Task 005's own established convention).
2. **`lib/recommendation-presentation/competitorEvidence.ts`** (new) — pure `buildCompetitorEvidence(observations, entries, businessProfileId, now?)`. Reuses, does not reimplement: `buildWhatChangedItems` (Task 004) for relevance (drops an observation whose tracked competitor no longer exists in Market Radar, rather than showing a fabricated name), `filterObservationsByConfidence` (Task 004) for the confidence bar (medium and above), and `lib/competitor-observations/confidenceLabels.ts`'s plain-language labels — deliberately never `lib/recommendation-presentation/confidenceLabels.ts`'s recommendation-flavored ones, the exact mistake Task 004's own prompt already identified and avoided. Adds: a 120-day staleness cutoff (`STALE_OBSERVATION_MAX_AGE_DAYS`, reusing `lib/marketing-memory/learningConfig.ts`'s `STRONG_PATTERN_MAX_RECENCY_DAYS` value as precedent rather than inventing an unrelated number); a defensive `businessProfileId` re-filter (tenant isolation, defense in depth); a malformed-observation guard (empty summary or source label); dedup to one entry per tracked competitor (most recent wins); a cap of 2.
3. **`lib/recommendation-presentation/service.ts`** — both `getRecommendationDecisionPackageForUser` and the batch `getRecommendationDecisionPackagesForApprovals` now fetch `listCompetitorObservationsForUser`/`listMarketRadarEntriesForUser` once per business (added to their existing `Promise.all` batches — not once per recommendation, matching this file's own established no-N+1 discipline for `signals`), compute `competitorEvidence` once, and thread it into `buildPackage()`.
4. **`components/dashboard/approval-queue.tsx`** — a new "Market Radar context" block inside the existing "Why this recommendation" disclosure, rendered only when `competitorEvidence.length > 0`, using `confidenceLabel` — never the raw `low`/`medium`/`high` value.
5. **Docs**: `docs/project-magic/MARKET_RADAR.md`'s implementation-status note extended — all four originally-planned "How it surfaces" points are now shipped, explicitly stated. `docs/CLIENT_RECOMMENDATION_EXPERIENCE.md` §4/§13 updated to record that real competitor evidence now exists, through a dedicated field, not the `OpportunityCategory` mechanism its own text had previously, correctly, declined to fabricate.

## Decisions Made (significant implementation choices, for reviewer visibility)

1. **Dedicated field, not folded into `ClientReason[]`.** `ClientReason` is a flat `{ text }` with no provenance. Competitor evidence needs to stay traceable (source label, honest confidence), so it got its own type — the same reasoning Task 005 used for `ExecutiveMarketRadarHighlight` instead of reusing the flat `ExecutiveBriefItem`.
2. **Not wired through `OpportunityCategory`/`translateOpportunityCategoryReasons`.** `reasonTranslation.ts`'s own header comment explicitly anticipated and deferred this ("the task brief's illustrative 'competitor_activity_detected' example does not correspond to any real OpportunityCategory... deliberately not implemented here to avoid fabricating a signal the platform doesn't actually produce"). Wiring through that mechanism would require new opportunity-detection logic linking a specific recommendation to a specific competitor — no such product concept exists anywhere in this codebase, and inventing one is explicitly out of scope ("do not redesign Marketing Director"). Instead, competitor evidence is presented as general, honest, business-level competitive context — never claimed as the specific cause of any one recommendation.
3. **Relevance = the tracked competitor still exists + fresh + confident**, not a fabricated causal link to a specific recommendation. There is no existing mechanism anywhere linking "this opportunity is about competitor X" — inventing one would be new opportunity-detection logic, out of scope. `buildWhatChangedItems`'s existing "drop if the competitor was removed" behavior already provides an honest, non-fabricated relevance signal, reused as-is.
4. **120-day staleness cutoff**, reusing `STRONG_PATTERN_MAX_RECENCY_DAYS`'s value (a different subsystem's constant, same number, not imported directly — that constant is scoped to Learning items, a different domain object) as precedent for "how long a recency-based signal in this codebase stays current," rather than inventing an unrelated number from nothing.
5. **Cap of 2 entries per package** — a handful of business-level context items, not a wall of every tracked competitor.

## Tests

- **`unit-tests/marketing-director-competitor-evidence.test.ts`** (new, 15 tests, all deterministic, no I/O): evidence-present, evidence-absent, stale (both boundary directions, plus the `occurredAt`-null fallback to `createdAt`), duplicate (collapses same-competitor observations, never collapses different competitors), relevance (competitor no longer tracked; below-medium confidence excluded; high confidence included), provenance (source label + plain-language label, never the raw value), malformed (empty summary; empty source label), tenant-isolation (a different business's observation never leaks through even if present in the input), and the display cap.
- **`tests/marketing-director-evidence.spec.ts`** (new, 8 Playwright source-level wiring checks, matching this repo's established style for queue-task coverage — no new route was added, so no redirect-behavior test): confirms the new module exists and genuinely reuses Task 003/004's infrastructure (not new logic); the new type/field exist; both service call sites are wired (not just one); the batch site computes evidence once, not per-approval; the UI renders the block only when non-empty and never a raw confidence value; the header comment's "never the specific cause" framing is present; the cron gate is unchanged; no new migration was added.
- **`unit-tests/weekly-approval-package.test.ts`**: one pre-existing fixture (`satisfies ClientRecommendationDecisionPackage`) updated with the new required `competitorEvidence: []` field — a legitimate fixture update for an intentional type change, not a weakened test.

All run from a clean state on this branch:

- **`npm run test:unit`** (full suite): **1879/1879 passing** (1864 baseline + 15 new).
- **`npm run lint`**: clean — 0 errors, 7 pre-existing warnings (identical set to the documented baseline; none in files this task touched). One self-caught issue during this task: the new Playwright spec initially used `module` as a local variable name, which Next.js's own ESLint rule (`no-assign-module-variable`) flags — renamed to `evidenceModule`, along with removing a now-unused `existsSync` import; both fixed before this report, not left in the diff.
- **`npx tsc --noEmit --project tsconfig.quality-gate.json --incremental false`** and **`npm run typecheck`**: **18 errors each — identical to the documented pre-existing baseline**, same 10 unrelated files, zero new. (One pre-existing fixture in `unit-tests/weekly-approval-package.test.ts` needed the new field added to keep compiling — done; this is a legitimate fixture update, not a new error.)
- **`npm run build`**: succeeded. No new route.
- **`npx playwright test`** (full suite, `--workers=1`): **329/329 passing** (321 baseline + 8 new). The Chromium browser binary was missing in this session's sandbox at the start of this task (`chrome-headless-shell` executable not found — a local environment gap, confirmed identical to the one already reported two turns earlier, not a code regression); installed via `npx playwright install chromium` (a local, non-repo, non-destructive, reversible operation — downloads to `~/Library/Caches/ms-playwright/`, touches nothing tracked by git) so the full suite could be verified for real rather than reporting the pre-existing gap as an excuse for skipping it.
- `ATTACH_DECLARATIVE_PRODUCTION_CRONS`: confirmed unchanged, still `false`.
- `.ai/STATUS.json`: valid JSON (verified via `python3 -c "import json; json.load(...)"`).
- No unresolved Git conflict markers in any file touched.

## Blockers

None for this task's own completion. Task 007 (Seasonal Intelligence) remains blocked on a genuine product decision from Sean — see `OPEN_ITEMS.md`'s "Task 007 stop condition" entry for exactly what needs deciding (which input(s), which surface(s), relationship to the existing AI-plan-derived `seasonalHint`). Standing, unrelated: spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, 18 pre-existing historical TypeScript errors, Task 003's migration still unapplied to any real database.

## Branches / commits / PRs

- **Task 006** — branch `ai-queue/006-marketing-director-evidence`, this update. Commit, push, and PR creation happen immediately after this file is saved — see the final report for the actual commit SHA / PR URL.
- **Tasks 001–005** — merged into `main` via PRs #101, #104, #107, #109, #110 (PR #108 was the Project Memory hardening fix, not a numbered task). Done.

## Next step

Review and merge Task 006's PR. This completes Market Radar's full originally-planned scope — Tasks 001–006 are all done or ready for review. Separately: (1) get a product decision from Sean on Seasonal Intelligence's actual MVP scope before a real Task 007 can be written; (2) once a second real, well-defined task exists, a real `npm run ai:queue` run with both queued is the next live test of the queue's still-unproven multi-task-per-invocation continuation; (3) resolve the three-competing-decision-systems architecture question (`docs/ARCHITECTURE_REVIEW_2026.md`); (4) patch the spoofable `x-forwarded-for` rate-limit key (§3.9 of that same review).

## Confirmation of safety boundaries

No deployment occurred. No Supabase migration was applied or added (this task's own scope explicitly required none, and none was needed — `supabase/migrations/038_competitor_observations.sql` remains the highest-numbered migration). No secrets, environment variables, or credentials were modified. No production schedule was activated (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` confirmed still `false`). No merge was performed automatically. No force-push occurred. No new persistence function was added — only existing `lib/competitor-observations/` and `lib/market-radar/` read functions were called, per this task's own scope boundary. `lib/marketing-director/`'s candidate-generation/scoring logic and `lib/decision-intelligence/`'s `DecisionEvidenceTrace` were not touched — Marketing Director itself was not redesigned.
