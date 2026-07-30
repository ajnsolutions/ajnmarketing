# Project Magic — Phase 2: Experience Simplification

**Companion to:** every prior Project Magic document — this sprint touches presentation only. No
new AI capability, no new scoring engine, no new persisted data model.

**Status:** Shipped.
**Branch:** `project-magic/phase-2-experience-simplification`
**Cron gate:** `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false** — untouched

The mission for this sprint was explicit: AJN Marketing should feel like hiring a Head of
Marketing, not operating marketing software. The objective was **not** to add intelligence — the
prior ten-plus sprints already built a genuinely rich Business Brain (Business Discovery, Customer
Voice, Search Console, Smart Uploads, the Business Knowledge Graph, the Business Learning Engine,
Growth Advisor, the Weekly Growth Plan, Marketing Health, Business Connections, Guided Setup). The
objective here was to make that existing intelligence dramatically easier to understand and act
on — fewer clicks, less duplicate information, more confidence, more delight.

## Part 1 — UX audit

The audit covered the authenticated dashboard end to end. Findings, in priority order:

| # | Finding | Where | Impact |
|---|---|---|---|
| 1 | **Marketing Health was fragmented across five separate, disconnected signals** shown as four stacked, uncoordinated badges on the Growth Advisor's supporting context (Head of Marketing state, Customer Voice health, Business Understanding score, Learning Maturity score) plus a fifth, entirely separate "Business Health Score" on the advanced Command Center page. Each badge had its own tone/label vocabulary and none referenced a next action. | `growth-advisor/supporting-context.tsx` | High — the exact duplicate-information problem Part 1 asked to find, and the direct subject of Part 4. |
| 2 | **Business Connections showed a "wall of integrations"** below the one genuine recommendation — every connection, grouped by category, fully expanded, repeating the same "What will I learn if you connect this?" framing over and over — despite the module's own code comments explicitly warning against exactly this pattern. | `business-connections-page.tsx` | High — directly the subject of Part 6. |
| 3 | **An inconsistent confirmation pattern**: rejecting a single draft in Approvals already used a calm, inline two-step confirm (click "Reject" → inline "Confirm reject" / "Keep reviewing"), but bulk-approving used a blocking native `window.confirm()` dialog for what is a reversible, non-destructive action (nothing publishes until a separate, later step). | `approval-queue.tsx` | Medium — friction, and inconsistent with the app's own established pattern. |
| 4 | **Content Generator's "Content Goal" always defaulted to the same hardcoded value** ("Promote a service") regardless of what Customer Voice, Search Console, Smart Uploads, or Testimonials already knew about the business, even though the generation backend already threads all of that intelligence into the AI prompt. The form made the customer re-decide from a blank slate every time. | `content-generator-page.tsx` | Medium — the subject of Part 7. |
| 5 | **Business Timeline rendered a single flat, undifferentiated list** of up to 25 entries across six different types (recommendations, campaigns, uploads, search milestones, Customer Voice milestones, learning milestones) with no way to focus on one kind of change. | `business-timeline-page.tsx` | Medium — the subject of Part 5. |
| 6 | **Guided Setup always fully expanded every milestone**, including ones already marked "Complete" — for a business further along, this pushed the genuinely relevant "what's next" content further down the page. | `guided-setup-experience.tsx` | Low-medium. |
| 7 | Growth Advisor Home's conversational structure (What I noticed → Why it matters → What I recommend → Expected impact) was, on inspection, **already fully implemented** from prior sprints (`GROWTH_ADVISOR_EXPERIENCE.md`), with locked section ordering enforced by existing Playwright tests. No structural change was needed or made — see Part 2 below. | `growth-advisor-page.tsx` | Informational — confirms scope, avoids needless churn. |
| 8 | The onboarding forms (`setup-business-form.tsx`, `setup-goals-form.tsx`) were, on inspection, **already lean** — one required field, clear optional labeling, inline hints and examples throughout. No question was removed because none was found to be unnecessary. | `setup-business-form.tsx`, `setup-goals-form.tsx` | Informational. |

Findings 1–6 were implemented this sprint. Findings 7–8 are documented as verified-already-correct
rather than changed for the sake of changing something, per the standing "don't add features
beyond what's needed" discipline this whole project follows.

## Part 2 — Growth Advisor Home

Audited and confirmed already correct. The existing page (`components/dashboard/growth-advisor/growth-advisor-page.tsx`)
already implements the requested conversational shape:

- **What I noticed** — with an inline **Why it matters** line under every observation.
- **What I recommend** — the single Recommendation section.
- **Expected impact** — its own explicit subsection under the recommendation, with expected outcome
  chips.
- **What changed since last week** — the existing "This week" section at the top of the page.

Section ordering is enforced by two existing Playwright specs
(`tests/growth-advisor.spec.ts`, `tests/growth-advisor-experience.spec.ts`) that assert the exact
sequence: greeting → This week → What I noticed → Recommendation → Next week → primary action →
supporting context. Reordering these sections purely for cosmetic reasons would have meant
weakening or rewriting tests that verify real, intentional prior design decisions — exactly what
the Regression Policy says not to do. Instead, Phase 2's contribution to "everything else should
support the conversation" is Part 4 below: consolidating what used to be four separate,
competing score widgets in the page's supporting context into one coherent card, so the
conversation isn't undercut by a wall of disconnected numbers underneath it.

## Part 3 — Remove friction

**Bulk approve now uses an inline confirm, not a native browser dialog.** `approval-queue.tsx`'s
`approveAllPending()` previously called `window.confirm(...)` — a blocking, unstyled, unskippable
native dialog. It now mirrors the same inline two-step pattern the single-item Reject flow already
used: clicking "Approve all needing review (N)" reveals an inline confirmation banner ("Approve
all N items...? Nothing publishes until you send approved work to publishing.") with "Confirm
approve" / "Cancel" buttons, and only calls the API once the customer explicitly confirms inline.
Same safety, no jarring native modal, and now consistent with the rest of the page.

## Part 4 — Marketing Health, transformed into a coaching experience

A new, presentation-only composition module,
`lib/growth-advisor/marketingHealthCoaching.ts::buildMarketingHealthCoaching`, replaces four
separate badges (Head of Marketing state, Customer Voice health, Business Understanding score,
Learning Maturity score) with **one** coaching card in the Growth Advisor's supporting context.
It creates no new score, invents no number, and never re-ranks a recommendation — it only composes
what the existing signals already say:

- **What it means** — the existing Head of Marketing health message (`briefing.health.message`).
- **Why it matters** — the existing health `reason` field, which existed in the data model but was
  never actually rendered anywhere before this sprint. Surfacing it is real, honest value recovery,
  not new intelligence.
- **The next best action** — reuses the *same* primary action Growth Advisor already recommends
  (`briefing.primaryAction`). This was a deliberate choice: Marketing Health does **not** get its
  own second, competing recommendation engine. One action, cited twice for context, beats two
  actions that might disagree.
- **What improves next** — a qualitative, evidence-grounded sentence, never a fabricated score
  delta. It prefers, in order: the real top gap from `BusinessKnowledgeHealth.missingKnowledge`,
  then the weakest non-strong `LearningMaturity` dimension's existing `improvementTip`, then the
  Customer Voice health `reason` when it isn't yet healthy, then an honest "keep going" when
  everything is already strong.
- **What's behind this** — the three supporting scores (Customer Voice, Business Understanding,
  Learning Maturity) are still fully available, just tucked behind a `<details>` disclosure instead
  of competing for attention as separate badges.

## Part 5 — Business Timeline readability

`business-timeline-page.tsx` gained a client-side type filter (chips: All / Recommendation /
Campaign / Document / Search / Customer Voice / Learning), reusing the exact filter-chip pattern
already established in the Approval Queue. The underlying data and its existing noise controls
(a 25-entry cap, campaigns/uploads filtered to genuinely completed/extracted, search and Customer
Voice milestones capped at 5 each — all pre-existing from the original Business Timeline sprint)
are unchanged; this is purely a scanning aid so a customer can focus on one kind of change instead
of a long, mixed list. No new fetch, no new entry types.

## Part 6 — Business Connections, simplified

`business-connections-page.tsx` still leads with exactly one thing: the highest-value next
connection, with its own "What you'll learn" explanation (unchanged — this was already correct).
What changed is everything below it: the full, always-expanded, grouped-by-category wall of every
connection card is now tucked behind a single "See all connections" disclosure, closed by default —
the same progressive-disclosure pattern already used for "More tools" and, as of this sprint, for
Guided Setup's completed milestones. The honest "What the Business Brain can see" readiness summary
stays visible by default, since it's compact and answers a genuinely different question
("what's connected right now") than the full connection-by-connection detail does.

## Part 7 — Content Generator pre-fill

A new, presentation-only helper, `lib/content-generator/suggestions.ts::buildContentGeneratorSuggestion`,
looks at the same Customer Voice intelligence already computed elsewhere in the app and — only when
there's real, multi-evidence support — proposes a starting content type, goal, and topic:

1. A customer-praised strength theme (`evidenceCount >= 2`, not low confidence) → "Build trust" /
   Google Business Profile Post, citing the theme directly.
2. Otherwise, a frequently-mentioned service theme with the same evidence bar → "Promote a
   service" / Promotion, citing the theme.
3. Otherwise, **no suggestion** — an honest empty state beats a guessed one.

The Content Generator route (`app/dashboard/content/generator/page.tsx`) now fetches the current
user's Customer Voice intelligence server-side and passes the suggestion to the page. When present,
a "Suggested for you" banner explains *why* in plain language and offers one click ("Use this") to
apply the content type, goal, and topic together — or "Not now" to dismiss and configure manually,
exactly as before. The customer is never auto-generated at; the suggestion only pre-fills a form
they still review and can change.

## Part 8 — Guided Setup

The onboarding forms themselves (`setup-business-form.tsx`, `setup-goals-form.tsx`) were reviewed
and found already lean — one required field (business name), everything else clearly optional with
inline hints. No question was removed, because none was found to be unnecessary busywork.

The one concrete change: `guided-setup-experience.tsx`'s "Meaningful milestones" list no longer
always shows every milestone fully expanded. Milestones already marked Complete are now tucked
behind a "See N completed steps" disclosure, and the always-visible list focuses on what's
current, optional, or upcoming — the part of the page that actually answers "what should I do
next," surfaced without scrolling past a growing list of already-finished steps.

## Part 9 — Polish

Every new interactive element introduced this sprint reuses the existing design system rather than
inventing new patterns: the `hom-focusable` focus-visible utility and `min-h-11` touch-target
sizing on every new button, the same `<details>`/`<summary>` disclosure markup (with the same
rotating chevron and `hom-disclose-content` reveal styling) already used for "More tools," the same
filter-chip markup already used in the Approval Queue, and the same inline-confirm markup already
used for single-item rejection. No new visual language was introduced — consistency was the polish.

## Part 10 — Testing

- `unit-tests/project-magic-phase-2.test.ts` — 10 tests covering `buildMarketingHealthCoaching`
  (real "why" surfaced, next-best-action reuse, honest fallback chain for "what improves next",
  no-fabrication guard, supporting-scores composition) and `buildContentGeneratorSuggestion`
  (strength-first preference, service fallback, honest null when there's no real evidence).
- `tests/project-magic-phase-2.spec.ts` — source-level coverage confirming: the Business
  Connections wall is behind a disclosure while the recommendation and readiness summary stay
  visible; the Marketing Health coaching module is wired into the supporting context and the four
  old separate badges are gone; the bulk-approve flow no longer uses `window.confirm`; the Content
  Generator route and page are wired to the new suggestion; the Business Timeline filter chips
  exist; Guided Setup's completed-milestones disclosure exists; the cron gate is unchanged; and
  this document covers the required sections.
- Full existing unit (1,591 tests) and Playwright suites were re-run after every change in this
  sprint and stayed green throughout — nothing pre-existing was weakened to make room for this
  work.

## Future opportunities

- The fifth "Business Health Score" on the advanced Command Center page (SEO/Google/Reviews/
  Content/Consistency sub-scores) was **not** touched this sprint — Command Center is explicitly
  labeled "for most weeks, you don't need this," and folding it into the new coaching model would
  be a larger, riskier change than this sprint's scope justified. A future sprint could extend
  `buildMarketingHealthCoaching` to optionally incorporate it once there's a clear customer need to
  see them side by side.
- Content Generator's suggestion currently draws only from Customer Voice. Once the same evidence
  bar is applied to Search Console demand trends and Smart Uploads/Testimonial knowledge facts, the
  suggestion could grow richer without changing its "one honest suggestion or none" contract.
- Business Timeline's type filter is client-side only; a future iteration could persist the last
  selected filter across visits.
- Guided Setup's completed-milestones disclosure could auto-expand once for a customer's very first
  completed milestone, so the "first win" is seen at least once before it collapses.
