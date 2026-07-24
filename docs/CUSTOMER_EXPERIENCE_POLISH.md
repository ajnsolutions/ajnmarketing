# Customer Experience Polish

**Project Magic Phase 3A.** Presentation and usability polish for pilot readiness.

## Goals

Make AJN Marketing feel cohesive, understandable, trustworthy, responsive, accessible, and commercially ready for pilot customers — without adding another intelligence engine or changing strategic behavior.

## Audit methodology

1. Inventory authenticated destinations and their primary user goals.
2. Prioritize Head of Marketing and adjacent strategic surfaces.
3. Consolidate shared empty/loading/error/status primitives.
4. Apply hierarchy, terminology, accessibility, and mobile fixes on primary pages.
5. Extend shared benefits to secondary surfaces (Command Center, Calendar page, nav).

## Pages reviewed

Primary (completed thoroughly):

- Head of Marketing
- Dashboard / Command Center (detailed workspace)
- Decision Intelligence
- Strategic Calendar (preview + full page)
- Campaigns
- Experiments
- Interactive Head of Marketing
- Executive Brief

Secondary (shared-component / targeted fixes):

- Navigation / More tools
- Recommendations / Approvals / Publishing / Plan / GBP / Reviews / Content / Settings / Onboarding / Admin (terminology and discoverability touchpoints only)

## Design-system improvements

Extended existing `components/dashboard/ui/` rather than inventing a parallel system:

| Primitive | Location |
|---|---|
| Empty / Error / Loading / PartialData | `dashboard-states.tsx` |
| StatusBadge / ConfidenceBadge | `status-badge.tsx` |
| PageHeader / SectionHeader / ReadOnlyNotice / LastUpdated / PrimaryActionBar | `page-chrome.tsx` |
| Status vocabulary | `lib/customer-ux/statusVocabulary.ts` |

Standardized:

- focus rings via `.hom-focusable`
- skip link via `.hom-skip-link`
- min touch target `min-h-11` on key controls
- customer status labels (no raw snake_case enums)

## Navigation changes

- Added **Why the plan changed** → `/dashboard/decision-intelligence` to advanced nav
- Added Decision Intelligence link under HoM “More tools”
- Preserved Great Simplification four-item primary nav

## Head of Marketing hierarchy

Recommended order implemented:

1. Greeting / health
2. Proactive presence + Executive Brief
3. Primary next action (moved above the fold)
4. Why the Plan Changed
5. Strategic Calendar preview
6. Campaigns
7. Experiments
8. Ask Your Head of Marketing
9. Supporting detail (Monthly Focus, handled/noticed/health/history)
10. Journal + More tools

## Dashboard / Command Center

- Back link to Head of Marketing
- Attention summary above metrics
- Priorities reframed as “Needs attention”
- Softened “AI Recommendations” wording

## Decision Intelligence

- PageHeader + ReadOnlyNotice
- Customer evidence-type labels
- Partial-data notice
- Honest empty states
- Keyboard evidence disclosure retained

## Strategic Calendar

- UTC fallback explanation
- Back link
- Preview empty state uses shared EmptyState
- Read-only notice on preview

## Campaigns / Experiments

- StatusBadge + shared empty states
- Read-only notices clarifying measurement/execution boundaries
- Experiments: inconclusive language, no winner, no truncated internal IDs

## Interactive HoM

- Suggested prompts grouped (Current priorities, Why the plan changed, Campaigns, Experiments, Performance, Preferences, Uncertain)
- Clearer loading copy
- Partial-data notice when answers are evidence-limited

## Executive Brief

- Top priorities above the fold
- Last updated indicator
- Watch items preview
- Full details remain progressive disclosure

## Empty / loading / error / partial-data

Empty states now carry a `kind` hint answering why empty / what next.

Partial-data warnings use `PartialDataNotice` instead of muted footnotes.

## Status vocabulary

Centralized customer labels for campaigns, experiments, publishing, recommendations, memory kinds, confidence, and evidence types. Tests lock key mappings.

Review fixes (PR #63 review pass): `RECOMMENDATION_STATUS` previously used invented keys and was missing the real `"open"` value; `CONFIDENCE` was missing `developing` / `inconclusive` / `not_applicable`, the real `DecisionEvidenceConfidenceState` values used on the live Decision Intelligence page (`not_applicable` is the value on every recommendation/campaign evidence trace — the majority case). Both maps now cover the full real enums; regression tests added in `unit-tests/customer-experience-polish.test.ts`. `PUBLISHING_STATUS` is not yet wired into any production caller and mixes three different underlying enums (`ContentApprovalStatus`, `PublishingQueueStatus`, `publishing_jobs.status`) — flagged as remaining UX debt below rather than fixed speculatively, since the correct single source enum needs a product decision before wiring it up.

## Mobile / accessibility

- Touch targets on primary CTAs and disclosures
- Skip link to next action on HoM
- Status text always accompanies tone/color
- Dialog focus restore on calendar retained
- Prompt groups remain keyboard operable

## Performance perception

- No new sequential fetches introduced
- HoM primary action moved earlier to reduce “what do I do?” scroll
- Progressive disclosure retained for dense brief details

## Non-goals

- No new recommendation / campaign / experiment engines
- No Marketing Director logic changes
- No Marketing Memory behavior changes
- No publishing/approval mutation changes
- No LLM / ML / providers / schedules
- No database migration
- No public marketing site redesign

## Follow-on: Phase 3B Guided Setup

Phase 3A primitives (status vocabulary, StatusBadge, PageHeader, empty/partial states) are reused by Guided Onboarding & Setup. See [`GUIDED_ONBOARDING_AND_SETUP.md`](./GUIDED_ONBOARDING_AND_SETUP.md).

## Remaining UX debt

- Deeper Approvals / Publishing / Recommendations body chrome
- Content Generator draft-vs-published clarity pass
- GBP permission diagnostics still somewhat technical in edge cases
- Authenticated visual QA on real pilot data (requires logged-in session)
- Optional future: responsive table → list conversions on dense admin tables
- `experiments-section.tsx`'s measured (non-inconclusive) confidence badge builds an inline presentation object from `ExperimentDashboardCard.confidenceLabel` (already a formatted string) with a hardcoded `tone: "info"`, so it doesn't get success/muted color-coding by actual confidence level. Fixing properly requires threading the raw `ExperimentConfidenceLevels` enum onto the card type instead of a pre-formatted string — left as debt rather than reshaping the data layer in a presentation-only PR.
- `publishingStatusLabel` (`lib/customer-ux/statusVocabulary.ts`) is unwired and its `PUBLISHING_STATUS` map conflates three different real enums; needs a product decision on which one it should represent before it's wired into any page.
- **[RC-1]** Fixed: `components/dashboard/brand-voice-page.tsx` previously hardcoded a "Strong Match" badge and a fabricated "AI Learning Timeline" (fake dated events) regardless of real data, plus several dead buttons with no `onClick` handler. See [`RC1_AUTHENTICATED_PILOT_VALIDATION.md`](./RC1_AUTHENTICATED_PILOT_VALIDATION.md).
- Approval Center's "Approved" and "Published" status badges use identical visual styling despite distinct, accurate text labels — a low-risk visual clarity follow-up, not fixed in RC-1.

## Manual smoke-test checklist

1. Open `/dashboard` — primary action visible without excessive scroll.
2. Confirm Why the Plan Changed preview and calendar preview.
3. Open Campaigns / Experiments — statuses readable as text.
4. Complete/inconclusive experiment language shows no winner.
5. Ask HoM — grouped prompts work; insufficient evidence stays honest.
6. Open Decision Intelligence — expand evidence by keyboard.
7. Open Strategic Calendar — day/week/month + filters; Escape closes dialog and restores focus.
8. Resize to 375px — HoM / DI / Calendar / Campaigns / Experiments remain usable.
9. Confirm no edit controls on read-only DI / Calendar pages.
10. Confirm cron gate remains false.
