/**
 * Guided Business Setup & First Wins
 *
 * **Status:** Shipped (milestone-based guided setup + Growth Advisor recognition)  
 * **Branch:** `project-magic/guided-setup-first-wins`  
 * **Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched
 *
 * Reduce time from signup to first value. Guide owners through the **minimum**
 * setup that produces meaningful recommendations — never every possible connection.
 *
 * Companion: [`GUIDED_ONBOARDING_AND_SETUP.md`](../GUIDED_ONBOARDING_AND_SETUP.md) ·
 * [`BUSINESS_CONNECTIONS.md`](./BUSINESS_CONNECTIONS.md) ·
 * [`GROWTH_ADVISOR_EXPERIENCE.md`](./GROWTH_ADVISOR_EXPERIENCE.md) ·
 * [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md)
 *
 * ---
 *
 * ## Product decision filter
 *
 * | Check | How this sprint meets it |
 * | --- | --- |
 * | Reduce time-to-value | Milestones + one next step; first wins after each completion |
 * | Increase customer confidence | Known / Learning / Waiting vocabulary |
 * | Explain why each connection matters | Brain-improvement copy on every milestone and next step |
 * | Preserve simplicity | No % bars; full checklist behind `?view=checklist` |
 * | Strengthen Growth Advisor | Setup progress strip + learning-state enrichment |
 *
 * ---
 *
 * ## Setup philosophy
 *
 * 1. **Milestones over checklists** — five meaningful stages, not a wall of tasks.  
 * 2. **One next step** — driven by required setup gaps, then Business Connections recommendation.  
 * 3. **Show value immediately** — first wins celebrate what unlocked, not just “step complete.”  
 * 4. **Missing ≠ broken** — empty states explain what/why/what improves.  
 * 5. **Reuse existing engines** — customer-setup facts + Business Connections readiness; no second progress calculator for completion status.
 *
 * Package: `lib/guided-setup/`
 *
 * ---
 *
 * ## First-win model
 *
 * When a milestone completes, generate a `FirstWin`:
 *
 * | Milestone | Value unlocked |
 * | --- | --- |
 * | Know your business | Accurate recommendations |
 * | Know what success looks like | Goal-aligned marketing plan focus |
 * | Understand your website | Better SEO / content insight |
 * | Hear customer feedback | Customer Voice authenticity |
 * | Weekly advisor ready | Trustworthy Growth Advisor meeting |
 *
 * Latest first win is celebrated on Guided Setup, readiness gate, and Growth Advisor.
 *
 * ---
 *
 * ## Readiness flow
 *
 * ```
 * CustomerSetupSnapshot (derived)
 * BusinessConnectionsSnapshot (readiness + recommendedNext)
 *         ↓
 * buildGuidedSetupExperience
 *         ↓
 * milestones · firstWins · one next · empty states · knowledge signals
 *         ↓
 * /dashboard/setup  ·  SetupHomReadinessPanel  ·  Growth Advisor strip
 * ```
 *
 * ---
 *
 * ## Business Brain activation
 *
 * Each milestone carries `brainImprovement` copy explaining how the Business Brain
 * gets stronger. Knowledge signals map to:
 *
 * - **Known** — evidence in place  
 * - **Learning** — in progress / needs reconnect  
 * - **Waiting for more information** — optional or not started (calm, not alarming)
 *
 * ---
 *
 * ## Surfaces
 *
 * | Surface | Behavior |
 * | --- | --- |
 * | `/dashboard/setup` | Guided experience (default) |
 * | `/dashboard/setup?view=checklist` | Existing detailed checklist |
 * | Dashboard readiness gate | One next step + first win + calm empty state |
 * | Growth Advisor | Setup progress strip when learning |
 *
 * ---
 *
 * ## Known limitations
 *
 * - First wins are milestone-based copy, not live A/B measurement of recommendation quality  
 * - Early First Days home (`connect_google`) path is unchanged  
 * - Detailed checklist still shows % for required steps when explicitly opened  
 *
 * ---
 *
 * ## Recommended next sprint
 *
 * 1. Persist “first win seen” dismissals lightly (preferences)  
 * 2. Deep-link first wins into Customer Voice / Weekly Plan surfaces after unlock  
 * 3. Soften First Days home to share the same milestone vocabulary  
 *
 * ---
 *
 * ## Tests
 *
 * - `unit-tests/guided-setup-first-wins.test.ts`  
 * - `tests/guided-setup-first-wins.spec.ts`  
 *
 * ---
 *
 * ## CI baseline (PR #87)
 *
 * `tests/guided-onboarding-setup.spec.ts` predates this sprint's copy change to
 * `components/dashboard/setup-hom-readiness.tsx` (the old percent-based readiness
 * gate read "A little more setup first" / "Nothing strategic is"; the milestone-based
 * panel shipped here reads "Recommended next" / "What's missing" instead). The
 * assertions were stale, not a regression — `tests/guided-setup-first-wins.spec.ts`
 * already asserted the current copy. Updated the two stale lines to check the
 * stable, current headings instead of the retired prose.
 *
 * While establishing a green baseline, also fixed (all pre-existing, unrelated to
 * this feature):
 * - `unit-tests/publishing-provider-client.test.ts`: one test constructed a
 *   Google Business fixture via `encryptToken` without wrapping it in the file's
 *   `withEnv(GOOGLE_OAUTH_ENV, …)` helper, so `TOKEN_ENCRYPTION_KEY` wasn't set yet
 *   — a missing test-env-setup bug, not a production secret requirement. Wrapped it
 *   like every other test in the file; uses only a deterministic non-production key
 *   (`"0".repeat(64)`, already defined in that file).
 * - `components/dashboard/schedule-post-modal.tsx`: lint error
 *   (`react-hooks/set-state-in-effect`) from setting default state synchronously in
 *   an effect. Moved the default-date computation to the render-time "adjust state
 *   when a prop changes" pattern instead.
 * - `tsconfig.json`: added `allowImportingTsExtensions` — `unit-tests/*.test.ts`
 *   import sibling modules with explicit `.ts` extensions (required for Node's
 *   native test runner), which plain `tsc --noEmit` rejected under `moduleResolution:
 *   "bundler"`. This only affects standalone `tsc` linting; `next build`'s own
 *   TypeScript pass was unaffected and already excluded `unit-tests/`.
 * - A handful of `unit-tests/*.test.ts` tenant-isolation tests declared two
 *   `const` fixture user ids that TypeScript narrowed to their string-literal
 *   types; combined with `assert.ok(ids.every(id => id === userA))` (an inferred
 *   type predicate under an assertion function), TS then statically flagged the
 *   companion `ids.includes(userB)` cross-tenant check as unreachable. Added
 *   explicit `: string` annotations to widen those fixture ids — no behavior
 *   change, standalone `tsc --noEmit` only.
 *
 * No Supabase Edge Functions, Deno config, or `runtime = "edge"` routes exist in
 * this repo (all API routes declare `runtime = "nodejs"`); the only Edge-runtime
 * code is Next's `middleware.ts`, already exercised end-to-end by the
 * unauthenticated-redirect Playwright tests.
 *
 * Quality gate commands used to validate this baseline:
 *
 * ```
 * npm run test:unit
 * npm run lint
 * npx tsc --noEmit
 * NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run build
 * CI=true NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run test:e2e
 * ```
 *
 * `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` only need to be
 * well-formed (e.g. `https://placeholder.supabase.co` / any string) for a local
 * build or test run — no production credentials required.
 */
