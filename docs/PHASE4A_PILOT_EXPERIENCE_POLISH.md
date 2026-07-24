# Phase 4A — Pilot Experience & UX Polish

**Project Magic Phase 4A.** First implementation phase after RC-1. Presentation polish for a controlled customer pilot — not a new capability phase.

## Objective

Make AJN Marketing feel like a polished, premium SaaS product a paying customer can understand without training.

Every authenticated screen should answer:

- Where am I?
- What does this page do?
- Why does it matter?
- What should I do next?
- What happens after I click?

## Non-goals

No Marketing Director, ranking, Campaign/Experiment/DI/Memory, publishing-boundary, OAuth, billing, Trigger.dev, or schedule changes. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false**.

## UX improvements

### Shared primitives (`components/dashboard/ui/page-chrome.tsx`)

- `OrientationNote` — why it matters + what happens next
- `WorkflowTrail` — connected draft → approve → publish (and recommendation upstream)
- Reused existing `PageHeader` / status badge patterns

### Head of Marketing (homepage)

- Clearer orientation under the greeting
- Next-step CTA explains that clicking still keeps the customer in control
- Supporting detail collapsed by default to reduce noise
- Setup checklist added under More tools
- Health badge uses shared `StatusBadge` (text + tone, not color-only)

### Recommendations

- PageHeader + OrientationNote + workflow trail
- Cards lead with “Why you’re seeing this”
- “Expected impact”, “Effort from you”, and “If you accept” clarify outcomes
- Raw internal priority score removed from the primary card chrome (ranking unchanged)

### Content workflow

Approvals, Publishing, and Content Generator share the same workflow trail and clearer approve ≠ publish language.

### Marketing foundation

Business/settings hub, Brand Voice, Marketing Profile, Marketing Plan, and Google Profile pages explain why they exist and what comes next. Settings groups **Marketing foundation** vs **Account**.

### Google Business

Customer-safe empty/unavailable states (no OAuth/env internals). Connected state shows status text + last sync with orientation help.

## Navigation improvements

- Primary four-item nav unchanged (Great Simplification)
- Advanced “More tools” grouped into:
  - This week
  - Marketing foundation
  - Insights
  - Advanced workspace
- Added **Marketing profile** (`/dashboard/ai-profile`) to advanced nav
- Mobile drawer scroll + `min-h-11` nav targets

## Onboarding / setup improvements

- Setup remains discoverable from Settings, HoM More tools, and existing setup card
- Foundation pages link back into the setup mental model without trapping users

## Dashboard improvements

- HoM noise reduced (supporting detail progressive disclosure)
- Command Center / detailed workspace remain advanced destinations
- Workflow continuity across recommendations → draft → approve → publish

## Accessibility improvements

- Status text on health / connection badges
- `role="note"` orientation blocks
- Workflow trail uses `aria-current="step"`
- Focusable controls keep `.hom-focusable` + min touch height
- Grouped nav sections expose `aria-label`s

## Mobile improvements

- Workflow trail stacks on small screens
- Nav groups remain usable in the mobile drawer with overflow scroll
- Action buttons keep `min-h-11` and column stacking where needed

## Performance improvements

- No new fetches or engines
- Prefer progressive disclosure over rendering dense supporting detail by default on HoM
- No client-side ranking recomputation

## Tests

- Unit: nav group coverage + page-chrome workflow primitives + cron gate
- Playwright: Phase 4A surface/contract suite (unauthenticated + static source checks)

## Remaining UX backlog (candidates for Phase 4B)

- Deeper Approvals KPI density reduction / mobile card conversion
- Results and Library page orientation pass
- Notification preferences product (still coming soon)
- Content hub parent page consistency with generator
- Authenticated visual QA on real pilot accounts
- Optional: breadcrumb component beyond workflow trail for deep nested admin pages

## Phase 4B recommendation

Focus Phase 4B on **authenticated visual QA + workflow density** (Approvals/Publishing/Library/Results) with a live pilot session, not another architecture phase. Keep engines frozen; measure time-to-first-approval and confusion points.
