/**
 * Autonomous Growth Planner
 *
 * **Status:** Shipped (weekly strategic planning engine)  
 * **Branch:** `project-magic/autonomous-growth-planner`  
 * **Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched
 *
 * Transforms Growth Advisor from a single-recommendation meeting into a **strategic
 * planning** experience. The Business Brain generates one complete weekly marketing
 * plan from available intelligence. This is **not autopilot**.
 *
 * > The advisor recommends. The customer approves. Nothing executes automatically.
 *
 * Companion docs: [`GROWTH_ADVISOR_EXPERIENCE.md`](./GROWTH_ADVISOR_EXPERIENCE.md) ·
 * [`BUSINESS_BRAIN.md`](./BUSINESS_BRAIN.md) · [`GOALS_AND_STRATEGY.md`](./GOALS_AND_STRATEGY.md) ·
 * [`CUSTOMER_VOICE.md`](./CUSTOMER_VOICE.md) · [`EXTERNAL_INTELLIGENCE.md`](./EXTERNAL_INTELLIGENCE.md)
 *
 * ---
 *
 * ## Product decision filter
 *
 * | Check | How this sprint meets it |
 * | --- | --- |
 * | Feel like a marketing strategist | Weekly plan with objective, why now, actions, metric, watch list |
 * | Actionable weekly plans | Practical supporting actions (GBP, web, email, social, reviews…) |
 * | One primary objective | Enforced in `resolvePrimaryObjective` / `buildWeeklyGrowthPlan` |
 * | Increase customer trust | Observed / Likely / Recommended + explainability disclosure |
 * | Never automate execution | Status starts `proposed`; UI copy; no publish/cron hooks |
 *
 * ---
 *
 * ## Planning engine
 *
 * Package: `lib/growth-planner/`
 *
 * | Module | Role |
 * | --- | --- |
 * | `buildWeeklyGrowthPlan.ts` | Pure composer — one `WeeklyGrowthPlan` |
 * | `primaryObjective.ts` | Exactly one objective from MD action → goals → CV/EI |
 * | `evidence.ts` | Multi-source evidence synthesis |
 * | `supportingActions.ts` | Practical recommended actions (never executed) |
 * | `successMetric.ts` | One meaningful metric — no fabricated projections |
 * | `history.ts` | Encode/decode/compare plan history |
 * | `service.ts` | Load + persist for the signed-in user |
 * | `trust.ts` | Observed / Likely / Recommended |
 *
 * Marketing Director remains the sole prioritizer of the ranked recommendation.
 * The planner **wraps** that direction into a weekly strategy — it does not re-rank.
 *
 * ### Weekly plan output
 *
 * - Primary Objective (exactly one)
 * - Why Now
 * - Expected Impact (business language)
 * - Estimated Effort
 * - Supporting Actions (recommendations only)
 * - Success Metric (one; no fake ROI)
 * - What I'll Watch
 * - Evidence + Explainability (why now, evidence, confidence, impact, related goals)
 *
 * ---
 *
 * ## Evidence synthesis
 *
 * Sources (generate once / reuse):
 *
 * 1. Weekly Briefing / Marketing Director detail
 * 2. Business Discovery
 * 3. Goals & Strategy
 * 4. Customer Voice
 * 5. External Intelligence
 *
 * Trust labels on evidence and actions:
 *
 * - **Observed** — grounded in owner-confirmed or high-confidence signals
 * - **Likely** — inferred / medium-confidence Business Brain signals
 * - **Recommended** — advisor suggestion (never auto-run)
 *
 * Never expose chain-of-thought. Explainability is customer-safe summaries only.
 *
 * ---
 *
 * ## Weekly lifecycle
 *
 * ```
 * Generate plan (ISO week key)
 *   ↓
 * Status: proposed
 *   ↓
 * Customer reviews in Growth Advisor
 *   ↓
 * Customer approves individual actions (existing approval flows)
 *   ↓
 * (Future) status → approved / in_progress / completed + optional outcome
 * ```
 *
 * Same-week regenerations reuse the plan id, status, and outcome so history stays stable.
 *
 * ---
 *
 * ## History model
 *
 * Persisted as a Magic marker on `business_profiles.marketing_goals`:
 *
 * `__weekly_growth_plans_v1__:[...]`
 *
 * Same pattern as `__business_goals_v1__:`. No schema migration required.
 *
 * Each history entry tracks:
 *
 * - Generated date
 * - Objective (key + label)
 * - Status (`proposed` | `approved` | `in_progress` | `completed` | `skipped`)
 * - Outcome (when available)
 * - Full plan snapshot (for week-over-week comparison)
 *
 * Cap: 26 entries. `compareWeeklyPlans` produces a calm summary of objective/status shifts.
 *
 * Goal saves preserve the plan marker; UI goal pickers strip it via `stripMagicGoalMarkers`.
 *
 * ---
 *
 * ## Growth Advisor surface
 *
 * `WeeklyGrowthPlanSection` sits in the conversational flow after goal progress and
 * before the single Recommendation / One Action. Copy stresses approve-before-publish.
 *
 * Wired from `app/dashboard/page.tsx` via `getWeeklyGrowthPlanForCurrentUser`.
 *
 * ---
 *
 * ## Future autonomous execution
 *
 * Out of scope for this sprint. When execution arrives:
 *
 * 1. Keep human approval as the default gate.
 * 2. Only auto-run actions the customer has explicitly opted into (preferences).
 * 3. Record outcomes back onto the weekly plan history entry.
 * 4. Never flip `ATTACH_DECLARATIVE_PRODUCTION_CRONS` without an explicit production decision.
 * 5. Prefer drafting content into existing approval queues over silent publishing.
 *
 * ---
 *
 * ## Known limitations
 *
 * - External Intelligence providers may still be empty — plans degrade honestly.
 * - Outcome capture is modeled but not yet a customer-facing form.
 * - Status transitions beyond `proposed` are not yet UI-driven.
 * - History lives in a marketing_goals marker (bounded JSON) — a dedicated table may
 *   replace it if volume or querying needs grow.
 * - Planner does not create content; it recommends supporting actions only.
 *
 * ---
 *
 * ## Tests
 *
 * - `unit-tests/autonomous-growth-planner.test.ts` — generation, empty states, evidence,
 *   history, single objective, explainability, cron gate
 * - `tests/autonomous-growth-planner.spec.ts` — surface + no-autopilot regression
 */
