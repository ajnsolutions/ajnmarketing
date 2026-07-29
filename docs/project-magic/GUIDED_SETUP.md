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
 */
