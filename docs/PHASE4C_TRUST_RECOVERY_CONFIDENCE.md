# Phase 4C — Trust, Recovery & Customer Confidence

**Project Magic Phase 4C.** Follows RC-1, Phase 4A, and Phase 4B. Presentation polish for calm trust — not a new intelligence phase.

## Objective

Help every paying customer answer: “Can I trust this system?”

Every major workflow should communicate what happened, what changed, whether work is safe, what to do next, what to ignore, whether AI finished, and whether action is required.

## Non-goals / regression freeze

No Marketing Director, ranking/scoring, Campaign/Experiment/DI/Memory, publishing-rule, OAuth, billing, Trigger.dev, or schedule changes. `ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false**.

No merge, deployment, or schedule activation in this phase.

## Trust improvements

- Shared helpers in `lib/customer-ux/trustPresentation.ts` (success, recovery, awareness, milestones, since-last-visit, trust signals)
- Chrome primitives: `SuccessNotice`, `RecoveryNotice`, `AwarenessChip`, `TrustSignalList`, `MilestoneNotice`
- Real timestamps only via `buildTrustSignals` / `LastUpdatedIndicator` — never fabricated
- Head of Marketing confidence panel: priorities, pending work, completed marketing, awareness chip

## Recovery improvements

- Website analysis failure → structured recovery (work safe / retry / ignore)
- Google unavailable → recovery + empty-state guidance
- Publishing failures → recovery notice on Publishing page
- Generation interrupted → recovery on Content Generator
- Marketing plan failure → recovery copy without engineering internals

## Success-state improvements

- Generation completion explains drafts ready + approve ≠ publish
- Sent-to-approval toast explains where to find work and next step
- Website analysis complete banner + last analyzed timestamp
- Marketing plan ready banner + last updated
- Empty states answer why empty / is it normal / what next

## Dashboard confidence improvements

- `CustomerConfidencePanel` on Head of Marketing
- “Since your last visit” from existing briefing facts + optional last-visit timestamp in localStorage (no new fetches/jobs)
- Calm single milestone celebration with dismiss (localStorage seen set)
- Surfaces already-computed `briefing.confidence` counts (no new engines)

## Notification / messaging improvements

- Consistent success / warning / recovery / processing language
- Live regions on success toasts and processing notices
- Concise, actionable CTAs

## Accessibility & mobile

- `role="status"` / `role="alert"` / `aria-live` on trust messaging
- `min-h-11` touch targets on CTAs and chips
- Stacked confidence grid on small screens

## Performance

- No new polling, engines, or duplicate fetches
- Last-visit / milestone dismiss are client localStorage only

## Remaining pilot backlog

- True multi-select approval checkboxes
- Unified publishing timeline
- Server-persisted last-visit (optional) instead of localStorage
- First-publish guided celebration tour
- Assisted Pilot (Phase 5) operator workflows

## Recommendation for Phase 5 (Assisted Pilot)

**Phase 5 — Assisted Pilot:** guided operator + customer co-pilot loops using existing engines — scheduled assistance remains gated (`ATTACH_DECLARATIVE_PRODUCTION_CRONS=false`) until explicitly activated after pilot confidence is proven.
