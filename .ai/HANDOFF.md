# Handoff

This file is the most recent agent-to-agent handoff. **Overwrite it wholesale on your next task** — it is a snapshot of "what the last agent did and what the next one should know," not a growing log. If you need history, use Git (`git log -- .ai/HANDOFF.md`).

## Branch

`fix/queue-typescript-baseline-determinism` (based on `main` @ `912248a`, the merge of PR #103)

## Task status

**Complete.** This is the third infrastructure bug found by successive attempts to actually run Task 002, after the completion-state fix (PR #102) and the dependency-base resolution fix (PR #103). With PR #103 merged, Task 002 started and correctly resolved its base — then failed its own quality gate.
`ai-queue/002-market-radar-view` — created from (and, at the time this task started, already up to date with) `origin/main` @ `912248a` (merge of PR #103, the dependency-base resolution fix). `origin/main` at that commit already contains Task 001's work (PR #101, merged) as an ancestor — confirmed via `git merge-base --is-ancestor origin/ai-queue/001-market-radar-foundation HEAD` before starting.

## Task status

**Complete.** This is Task 002 from `.ai/queue/RUN_QUEUE.yaml` — the owner-facing Market Radar view, depending on Task 001's persistence foundation (`lib/market-radar/`).

## What was built

`.ai/runs/2026-08-02T163633130Z/baseline.json` recorded `typescriptErrorCount: 2`; the same run's later comparison capture for Task 002 (`task-002-quality.json`) reported `18`. `compareQualitySnapshots()` treated the gap as "16 new TypeScript error(s)" and failed the task; three independent auto-repair attempts each re-confirmed the same real 18 errors with nothing to actually fix.

Per this task's explicit mandate, no prior repair-attempt conclusion was trusted — the discrepancy was independently reproduced from a clean `main` checkout before any code was touched. Baseline capture and comparison capture already called the exact same shared function (`captureQualitySnapshot()`), so the divergence could only come from ambient, on-disk state that function's `tsc` invocation reads — not from different commands or different source. Two distinct, real causes were confirmed:

1. **Persistent, uncontrolled incremental cache.** The project's real `tsconfig.json` sets `incremental: true`, so a plain `tsc --noEmit` reads/writes a persistent, gitignored `tsconfig.tsbuildinfo` cache that is never reset between the queue's baseline and comparison captures, or between separate runs. `subprocess.ts`'s SIGKILL-on-timeout behavior can kill a `tsc` process mid-write of that cache; a later, faster run reading a cache corrupted that way can under-report by trusting stale per-file diagnostic state instead of re-checking. Proven experimentally (cold run 11.3s vs. warm run 2.9s, confirming the cache is read/reused across invocations); the exact byte-level corruption that produced "2" specifically was not force-reproduced, and the writeup is honest about that.
2. **Stale `.next/` build artifacts leaking into the count.** `tsconfig.json`'s own `include` pulls in every `.ts` file under `.next/types/` and `.next/dev/types/` — Next.js's auto-generated route-type validator files. `.next/` is a gitignored build artifact never cleaned between branch switches or task attempts; a `.next/` last built from a branch with different routes (in this incident, `ai-queue/002-market-radar-view`) leaks phantom "Cannot find module" errors for routes that only exist on that other branch. Reproduced directly: 18 errors clean, 24 with the stale directory present, 18 again once removed.
1. **`app/dashboard/market-radar/page.tsx`** — new route, redirects to `/dashboard/setup` if there's no business profile (exact pattern from `app/dashboard/business-brain/page.tsx`), otherwise fetches entries via Task 001's `listMarketRadarEntriesForUser` and renders the page.
2. **`components/dashboard/market-radar-page.tsx`** — new client component, modeled directly on `components/dashboard/testimonials-page.tsx`'s established add/remove-list pattern (local state + `fetch` to an API route + `router.refresh()`). Renders "Tracking N competitors" and a separate "Benchmarking" section (copy: "For inspiration and pattern-matching — not a head-to-head comparison"), each with an inline add form and a per-entry Remove button, plus an honest empty state per section. Deliberately carries **no** "recent activity," "changes detected," or any competitive-signal copy anywhere — this repo has no monitoring/detection layer yet, and fabricating that would violate `MARKET_RADAR.md`'s "no fabricated competitive claims" rule. Covered by a Playwright test that greps the component source for exactly those forbidden words.
3. **`lib/market-radar/display.ts`** (new file — not a change to Task 001's `persistence.ts`/`types.ts`) — `groupMarketRadarEntriesForDisplay()`, a pure function that calls Task 001's `sortMarketRadarEntries` and splits the result into `{ competitors, benchmarks }` for rendering. Reuses ordering logic rather than reimplementing it, per the task's explicit instruction.
4. **`app/api/market-radar/route.ts`** (POST, add) and **`app/api/market-radar/[id]/route.ts`** (DELETE, remove) — new API routes, modeled on `app/api/testimonials/route.ts` / `app/api/testimonials/[id]/route.ts`'s exact shape: `supabase.auth.getUser()` auth check, then `getBusinessProfileForUser()` (POST only), then a call into Task 001's `addMarketRadarEntryForUser`/`removeMarketRadarEntryForUser`, both of which are tenant-scoped by `userId` per ADR-0001. No new persistence function was added or needed.
5. **Navigation**: added `{ href: "/dashboard/market-radar", label: "Market Radar" }` to the existing "More tools" array in `components/dashboard/growth-advisor/supporting-context.tsx` — no new primary nav item.
6. **Tests**:
   - `unit-tests/market-radar-view.test.ts` (4 new tests) — `groupMarketRadarEntriesForDisplay`: splits competitors/benchmarks, preserves `sortMarketRadarEntries`' ordering within each group, handles the empty-list case, doesn't mutate its input.
   - `tests/market-radar.spec.ts` (9 new tests) — modeled on `tests/business-brain-inspector.spec.ts`'s source-level wiring-check style: all new files exist; the route redirects to setup with no profile; the page renders both sections with add/remove actions; benchmark copy is inspiration-framed; **no fabricated activity/detection copy** (greps for `/detected/i`, `/recent activity/i`, `/days ago/i` and asserts none match); both API routes call `supabase.auth.getUser()` and the correct persistence function; the display helper actually calls `sortMarketRadarEntries`; the nav link is present in "More tools" and absent from the two primary-nav files (`dashboard-nav.tsx`, `dashboard-sidebar.tsx`); the cron gate (`ATTACH_DECLARATIVE_PRODUCTION_CRONS = false`) is unchanged.
7. **Docs**: `docs/project-magic/MARKET_RADAR.md`'s "Implementation status" note extended to record the owner-facing view shipping, with an explicit list of what still depends on the not-yet-built monitoring/detection layer. `.ai/ROADMAP.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`, `.ai/OPEN_ITEMS.md` updated accordingly (see their diffs in this same branch).

## A deliberate deviation from the task prompt's literal PR-base fallback — read before merging

The task prompt says: open the PR against Task 001's branch, or if run outside the automated runner, `--base ai-queue/001-market-radar-foundation`. That branch (`origin/ai-queue/001-market-radar-foundation`, tip `79f2390`) still exists on GitHub, but its PR (#101) is **already merged into `main`**, and `main` has since gained two more merged PRs (#102, #103, both unrelated queue-tooling fixes) that are not reachable from that stale branch name. This session's own branch was created from (and stayed at) `origin/main`'s tip the entire time.

1. **`tsconfig.quality-gate.json`** (new, repo root): `extends: "./tsconfig.json"`, overrides `incremental: false`, excludes `node_modules`, `scripts/**/*`, `.next/**/*`. Must live at the repo root, not `scripts/ai/` — a config's `exclude` globs resolve relative to that config file's own directory, so a first attempt placed at `scripts/ai/tsconfig.quality-gate.json` silently meant `scripts/ai/scripts/**/*` (nonexistent) and let 2 extra errors leak back in (20 instead of 18). `unit-tests/ai-queue-typescript-determinism.test.ts` asserts the file's location directly so this can't silently regress.
2. **`scripts/ai/qualityGates.ts`**: extracted `buildTypescriptCheckArgs()` (pure, returns the exact `tsc` argv) and `runTypescriptCheck()` (runs it, parses the count) out of `captureQualitySnapshot()`, which now calls `runTypescriptCheck()` instead of inlining a bare `tsc --noEmit`. Both the baseline capture and every task's comparison capture already went through the same shared function — the fix makes the underlying `tsc` invocation itself immune to ambient cache/build-artifact state, not just textually identical. New header-comment paragraph documents the incident, both root causes, and the fix.
3. **`unit-tests/ai-queue-typescript-determinism.test.ts`** (new, 6 tests, all real `tsc` invocations — not mocked, since the bug was in command construction and on-disk state, not parsing logic): argv determinism (pure); two consecutive real checks of unchanged source report identical counts; an injected stale `.next/types` fixture doesn't change the count; no tsbuildinfo file is left behind by the check itself (starts from a clean slate so a pre-existing real editor/typecheck cache doesn't produce a false failure); `compareQualitySnapshots()` reports zero TypeScript regressions across two real captures of unchanged source; the dedicated tsconfig's root-level location is asserted directly.
4. **`.ai/DECISIONS.md`**: ADR-0016, full root cause / fix / alternatives-considered / consequences.
5. **`.ai/OPEN_ITEMS.md`, `.ai/CURRENT_STATUS.md`, `.ai/STATUS.json`**: updated with this incident and fix, consistent with each other.

## Self-caught issues during this build (both fixed before finishing, not left in the diff)

- A JSDoc block comment I wrote containing the literal glob text `` `.next/types/**/*.ts` `` prematurely closed the `/** ... */` block (the substring `**/*` contains `*/`), producing 144 cascading parse errors in `qualityGates.ts` itself. Caught by direct investigation (raw byte inspection, standalone reproduction), not assumed external. Fixed by rewording the comment to avoid literal `**/*` glob syntax.
- The Root-Cause-#1 regression test originally wrote its synthetic stale fixture to the real path `.next/types/validator.ts` (colliding with Next.js's own real output filename) and only deleted it conditionally (`if (!alreadyExisted)`). The first isolated test run left it behind (write succeeded, but a later `npm run typecheck` — run manually for verification, using the real project tsconfig which includes `.next/types/**` — then picked up the leaked garbage file and reported 19 errors instead of 18, a self-inflicted false regression). Fixed: the fixture now uses a uniquely-named file (`__typescript-determinism-test-fixture__.ts`) that can never collide with real Next.js output, and cleanup in the `finally` block is unconditional. The Root-Cause-#2 test had the same class of issue (asserted no `tsconfig.tsbuildinfo` exists at all, which false-failed against a legitimately-created real editor/typecheck cache from my own manual verification commands) — fixed by having the test start from a clean slate (delete both candidate files first) rather than asserting global absence. Re-verified clean after each fix: `npm run typecheck` and the quality-gate check both stayed at 18 across repeated runs, including after a real `npm run build` regenerated a legitimate `.next/`.

## Tests

- **`unit-tests/ai-queue-typescript-determinism.test.ts`** (new, 6/6 passing): see above. All real, non-mocked `tsc` invocations against this actual repository.
- **`unit-tests/ai-queue-quality-gates.test.ts`** (existing, 28/28 passing, unaffected by the `captureQualitySnapshot()` refactor).
- **Full unit suite** (`npm run test:unit`): **1793/1793 passing** (1787 previously + 6 new).
- **Lint** (`npm run lint`): clean — 0 errors, 7 pre-existing warnings in files this branch never touched.
- **Typecheck, real project config** (`npm run typecheck`): **18 errors, identical set to before this branch** — verified repeatedly, including after a fresh real `npm run build`.
- **Typecheck, quality-gate config** (`npx tsc --noEmit --project tsconfig.quality-gate.json --incremental false`): **18 errors**, deterministic across 3+ repeated runs, immune to an injected stale `.next` artifact.
- **Build** (`npm run build`): succeeds.
- **Playwright** (`npx playwright test --workers=1`): **302/302 passing**.
- **`npm run ai:queue:validate`**: valid.

## PR

[#105](https://github.com/ajnsolutions/ajnmarketing/pull/105) — `fix/queue-typescript-baseline-determinism` → `main`. Not merged. Not deployed.

## Blockers

None blocking this task's own completion. Standing limitation, same as every fix in this file today: real, non-mocked regression tests exist and were run directly against this repository, but the fix has not yet been exercised by an actual `npm run ai:queue` invocation completing Task 002 end-to-end (no `claude` binary was available in this fix's own build sandbox either). This is now the **third** infrastructure fix in a row surfaced by successive attempts to actually run Task 002 — the next real queue run is the first live test of all three fixes together.

Unrelated, pre-existing, not touched by this branch: the product-track blockers in `OPEN_ITEMS.md` (spoofable rate-limit key, three-competing-decision-systems question, production launch blockers, missing recommendation-engine trigger) and the 18 pre-existing historical TypeScript errors (unchanged, not this task's scope).

Task 002's own in-progress work (stashed under `ai-queue/002-market-radar-view`, PR #104) was verified to still apply cleanly to its own branch and was left there, untouched and uncommitted by this fix, exactly as found.

## Confirmation of safety boundaries

No deployment occurred. No Supabase migration was applied. No secrets, environment variables, or credentials were modified. No production schedule was activated (`ATTACH_DECLARATIVE_PRODUCTION_CRONS` untouched, still `false`). No merge was performed automatically.

## Recommended next step

1. Review this PR (root cause, the dedicated `tsconfig.quality-gate.json`, the `runTypescriptCheck()` extraction, the 6 new tests — especially that they use real `tsc` invocations, not mocks) before doing anything else.
2. Once merged, in an environment where `claude --version`/`claude --help` actually work:
   ```bash
   npm run ai:queue:validate
   git checkout main && git pull
   npm run ai:queue:status   # confirm: 001 completed, 002 pending or ready to retry
   npm run ai:queue          # attended, in the foreground — runs Task 002
   ```
3. Watch for: the quality gate's baseline and every task's comparison both reporting the same TypeScript count when the repository hasn't changed; no phantom "N new TypeScript error(s)" regression on a task that didn't touch any `.ts` file logic.
4. If a fourth infrastructure issue surfaces on the next real Task 002 attempt, treat it the same way this one was: reproduce independently from a clean checkout before trusting any prior log or conclusion.
5. Separately, unrelated to this queue-tooling fix: the product-track recommendations in `OPEN_ITEMS.md` remain the highest-priority carried-forward items.
Opening the PR with `--base ai-queue/001-market-radar-foundation` would therefore have pulled PR #102's and #103's entire diffs into this PR as if they were part of Task 002's own change — confusing for a reviewer and not an accurate reflection of what this task actually changed. Instead, **the PR was opened against `main` directly**, which is exactly what this repo's own `resolveDependencyBase()` (`scripts/ai/reconcile.ts`, added by PR #103 the same day) would compute for a dependency whose PR is confirmed merged: resolve to the real merge target, never require the dependency's branch name to still be meaningful. This is a judgment call under the task's own "when requirements are ambiguous" guidance, applied narrowly to a git-workflow mechanic (not a product requirement) — documented here and in `CURRENT_STATUS.md`/`STATUS.json` rather than silently deviating.

## Tests

- **Unit** (`npm run test:unit`): **1791/1791 passing** (1787 pre-existing + 4 new in `market-radar-view.test.ts`).
- **Lint** (`npm run lint`): clean — 0 errors, 7 pre-existing warnings, none in files this branch touched.
- **Typecheck** (`npm run typecheck`): 18 pre-existing errors, identical set to `OPEN_ITEMS.md`'s documented baseline — none in files this branch touched.
- **Build** (`npm run build`): succeeds; `/dashboard/market-radar` compiles as a dynamic route alongside the other `/dashboard/*` pages.
- **Playwright** (`npx playwright test --workers=1`): **311/311 passing** (302 pre-existing + 9 new in `market-radar.spec.ts`).

## PR

[#104](https://github.com/ajnsolutions/ajnmarketing/pull/104) — `ai-queue/002-market-radar-view` → `main` (see "A deliberate deviation..." above for why `main` and not `ai-queue/001-market-radar-foundation`). Not merged. Not deployed.

## Blockers

None. This task completed within its defined scope; nothing was deferred as a guess.

## Recommended next step

Both PRs are ready for human review, in dependency order: merge #101 (Task 001) before this task's PR (Task 002) — though note Task 002's PR is opened against `main` directly, not against #101's branch, per the deviation documented above (main already contains #101). After both merge:
1. Manually exercise `/dashboard/market-radar` in a browser against a real authenticated session (add a competitor, add a benchmark, remove one of each, confirm the empty state) — this session's own verification was source-level (Playwright wiring checks) plus unit tests, not a live browser session against a running dev server with real auth.
2. The next real Wave III scope item is Seasonal Intelligence (not started) — see `ROADMAP.md`.
3. Separately, unrelated to Market Radar: the three-competing-decision-systems architecture question and the spoofable rate-limit key (`OPEN_ITEMS.md`'s active blockers) remain the highest-priority carried-forward items.
