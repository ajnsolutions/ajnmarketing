# Open Items

Verified 2026-08-02 against `origin/main` @ `dc537d2` (merge of PR #99). Update this file whenever an item is resolved, deferred further, or a new one is discovered — do not let it silently go stale (see `ADR-0010`'s caveat in `DECISIONS.md` for why that matters).

## Active blockers

1. **Unpatched security gap (High)** — the public interactive-demo endpoint's rate limit key is derived from a spoofable `x-forwarded-for` header, allowing unbounded OpenAI cost abuse. Source: `docs/ARCHITECTURE_REVIEW_2026.md` §3.9. Explicitly noted there as **not fixed**. This should be prioritized ahead of new feature work touching that endpoint.
2. **Three competing "what should this business do" systems** — Marketing Recommendations, Tasks, and Marketing Plan, plus Assisted Pilot as a fourth adjacent layer. Called "the single biggest prerequisite decision for Magic" in `docs/ARCHITECTURE_REVIEW_2026.md`. One narrow resolution exists (`/dashboard` → `lib/head-of-marketing`, ADR-0007 sub-decision) but the underlying multi-system question is not resolved.
3. **Production launch blockers** (`docs/PRODUCTION_READINESS.md`, 2026-07-14): Supabase service-role key rotation unconfirmed; assisted-vs-scheduled pilot mode undecided; production environment variables not yet provisioned. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` must stay `false` until a fourth, separate, explicit ops sign-off — this is a gate, not a blocker to resolve.
4. **Opportunity/Decision Engine has no trigger anywhere in the product** (`docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md`) — `/dashboard/marketing-recommendations` stays empty without manual admin invocation.

## Deferred work

- Approve/edit/comment/correct feedback loop that converts Assumed → Known insights on the Snapshot (Wave I, "still open" per `docs/project-magic/IMPLEMENTATION_ROADMAP.md`).
- A durable, cross-24h-window store for the 7 snapshot-confirmation fields without an existing column (`docs/BUSINESS_DISCOVERY_CONTINUATION.md`, Recommended Phase 2B2).
- Wave III: Market Radar and Seasonal Intelligence (scoped, not started).
- Wave IV: Business Pulse + Autopilot (scoped, explicitly blocked on Waves I–III producing real signal first).
- P2/P3 items from `docs/RC1_AUTHENTICATED_PILOT_VALIDATION.md`: Approved/Published badge color parity, an unreachable legacy `/dashboard/[section]` route, SMS Approval Preview remains a mockup.

## Known risks

- `GET /api/publishing` executes due jobs as a live side effect of a page load (`docs/RELEASE_CANDIDATE_END_TO_END_AUDIT.md`) — despite PR #23's "atomic claim + no page-load execution" fix, this specific route was found still doing it at RC audit time. Needs re-verification, not assumed-fixed.
- Approval Center UI copy overstates automation ("From AI draft to published — automatically") when the actual flow requires human approval.
- GBP Disconnect button is a no-op (does nothing when clicked).
- "Regenerate" on a recommendation silently severs its link to the original recommendation.
- Analytics → opportunities feedback loop is dead in production (recorded in the RC audit; current state not re-verified in this build).
- `lib/google-business` vs. `lib/google-business-profile` naming/execution split is real friction, not yet cleaned up (ADR-0006).

## Unresolved decisions

- Whether `docs/project-magic/IMPLEMENTATION_ROADMAP.md` (2.0 Wave I–IV) is stale: it does not mention Business Knowledge Graph, Business Learning Engine, Business Brain Inspector, Business Connections, Opportunity Detection Engine, or Head of Marketing Orchestrator, all of which are shipped (verified via `**Status:** Shipped` lines in their own `docs/project-magic/*.md` files and via `git log`/`gh pr list`). Recommend a human decide whether to update that roadmap doc to reflect actual delivery, or whether these features belong to an untracked third initiative.
- `origin/publishing-concurrency-verification` (commit `4e4a3de`, 2026-07-13, "Add real-DB publishing claim concurrency verification script") — unmerged, no associated PR found in `gh pr list --state all`. Unclear whether this was intentionally left as a manual one-off tool or is abandoned work-in-progress. Do not delete without human confirmation.
- `origin/project-magic/strategic-marketing-calendar` (commit `0631bfb`, 2026-07-19) — unmerged, but its commit message ("Fix calendar dedupe/nav/a11y bugs found in PR #59 review") is identical to PR #60's title, whose head branch (`project-magic/strategic-marketing-calendar-fixes`) *was* merged. Likely a stale duplicate branch pushed to the wrong ref and safe to delete — but confirm with a human before deleting any branch, per this repo's own safety posture.

## Pre-launch requirements

See `ROADMAP.md`'s "Pre-launch requirements" section and `docs/LAUNCH_CHECKLIST.md` in full before any production cutover discussion. Non-negotiable constant across all of them: `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

## Pre-existing type-check debt (discovered by this build, not caused by it)

This build added the first `typecheck` script (`tsc --noEmit`) this repository has ever had — none existed before, since `test:unit` runs `unit-tests/*.test.ts` through Node's type-*stripping* (which discards type annotations without checking them), not real type-checking. Running it for the first time surfaces **18 pre-existing type errors across 10 unrelated unit-test files**, none touched by this build: `ai-marketing-profile-errors.test.ts`, `campaign-intelligence-engine.test.ts`, `decision-intelligence-core.test.ts`, `decision-intelligence-persistence.test.ts`, `executive-briefing-engine.test.ts`, `marketing-decisions-ui.test.ts`, `project-magic-proactive-head-of-marketing.test.ts`, `recommendation-outcomes.test.ts`, `recommendation-pipeline-orchestrator.test.ts`, `recommendation-presentation-service.test.ts`. All of `scripts/ai/*` and the new `unit-tests/ai-queue-*.test.ts` files typecheck cleanly. Recommend a human triage and fix these in a dedicated follow-up — fixing 10 unrelated feature test files was out of scope for this build.

**Update (2026-08-01, Queue v2):** this debt no longer blocks the AI overnight queue — `scripts/ai/qualityGates.ts`'s baseline-aware comparison treats an unchanged pre-existing count as a PASS (see `DECISIONS.md` ADR-0012). It's still real debt worth fixing eventually; it's just no longer conflated with "did this queue task introduce a regression."

## Known limitation of Queue v2's identity-aware test comparison (2026-08-01)

`compareQualitySnapshots` (`scripts/ai/qualityGates.ts`) distinguishes a historical unit-test/Playwright failure from a new one by matching failing-test **name** between baseline and current. If a task legitimately renames or restructures a test (even without changing its underlying behavior), the comparator has no way to know the "new-named" failure is the same one — it would be classified as a new regression and could trigger an unnecessary auto-repair attempt or task failure. This is a known, accepted trade-off (matching by name is far more correct than matching by raw count alone — see ADR-0012's "alternatives considered") rather than a bug; a human resolving such a failure should recognize this pattern (a renamed test showing up as "new") rather than assume the repair loop's diagnosis is always literal.

## Live dry-run incident (2026-08-02) and its fix — read before trusting an overnight run

The queue's first real, live, unattended run (run id `2026-08-02T065749882Z`) actually executed — meaning a `claude` binary genuinely was available in whatever environment ran it, unlike every sandbox this project's own build/fix sessions have had access to. It surfaced the exact risk `OPEN_ITEMS.md` had previously only flagged as *unverified*: `scripts/ai/adapters/claude.ts` invoked `claude -p` with no permission-bypass flag, every Write/Edit/Bash tool call silently blocked on an approval no one was present to give, and Claude exited 0 having done zero work. The adapter reported success anyway (it only checked exit code). The queue's auto-repair loop (ADR-0012) then burned a second, identically-blocked invocation before self-diagnosing the true cause in its own response text (evidence preserved: `.ai/runs/2026-08-02T065749882Z/RUN_SUMMARY.md`, `RUN_STATUS.json`, `baseline.json`, `task-001-quality.json`; the raw `task-001.log` containing the full diagnostic transcript is local-only per this repo's log policy, not committed).

**Fixed this session** (see `DECISIONS.md` ADR-0013 for full reasoning): the adapter now passes `--dangerously-skip-permissions` and independently inspects the JSON response body (`permission_denials`, `is_error`) rather than trusting exit code 0 alone. Also hardened for reliability more broadly: every subprocess call across `run-queue.ts`/`qualityGates.ts` now has an explicit timeout (`scripts/ai/subprocess.ts`), `QUEUE_STATUS.json` writes are now atomic, an unexpected crash mid-task still produces a normal `RUN_SUMMARY.md`/`RUN_STATUS.json`, and the whole run now has a wall-clock ceiling (`queue.max_run_duration_minutes`, default 360 minutes).

**Still true after this fix, and still the main reason not to trust a fully-unattended *overnight* run yet:** the fix's *failure-detection* path was proven correct against the real incident's actual response shape (unit-tested directly). The fix's *success* path — a real `claude --dangerously-skip-permissions` invocation actually completing a task end-to-end — has now been observed once: PR #100 (the fix itself) merged to `main` at `5d60a07`, and this same environment then ran Task 001 (`ai-queue/001-market-radar-foundation`, 2026-08-02) as an attended daytime dry run, producing real file changes (`supabase/migrations/037_market_radar.sql`, `lib/market-radar/`, `unit-tests/market-radar-foundation.test.ts`) and passing quality gates — not another silent no-op. This is one successful data point on one task, attended, not yet a fully unattended multi-task overnight run; Task 002 and a genuinely unattended (no human watching) run are still open verification steps. **Drift note:** the `.ai/` snapshot this session started from still described PR #100 as unmerged/open — it was already merged; treat this as confirmation that `.ai/` can drift even within the same day and must be checked against `git log`, per `AGENTS.md` rule 3.
