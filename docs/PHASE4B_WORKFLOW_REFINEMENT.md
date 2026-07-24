# Phase 4B — Workflow Refinement & Everyday Usability

**Project Magic Phase 4B.** Follows Phase 4A (Pilot Experience & UX Polish). Presentation polish for daily use — not a new intelligence phase.

## Objective

Make every everyday workflow feel obvious, fast, trustworthy, connected, predictable, and satisfying. Reduce cognitive load without redesigning the product or adding large features.

## Non-goals / regression freeze

No changes to:

- Marketing Director, recommendation ranking/scoring
- Campaign Intelligence, Experimentation, Decision Intelligence, Marketing Memory
- Publishing approval rules, OAuth, Billing
- Trigger.dev schedules / cron gate

`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains **false**.

No merge, deployment, or schedule activation in this phase.

## Workflow improvements

### 1. Approval Center

- Attention banner answers “What needs my attention today?”
- KPI hierarchy: Needs you today / Approved this month / Rejected
- Bulk approve discoverability (`Approve all needing review`) using existing per-item approve API
- Reject clarity + confirmation microcopy
- Confidence signal language (not ranking jargon)
- Optional history/helpers collapsed to reduce scan noise
- Continuity: Next → Publishing; full journey trail

### 2. Publishing Queue

- Plain-language statuses: Approved · Ready, Waiting · Scheduled, Published, Failed · Retry available
- Per-item guide: What’s happening? Do you need to act? What’s next?
- Live publishing activity renamed (no “engine” terminology)
- Job statuses: Queued, Waiting, Publishing, Published · Confirmed, Retry available
- Attention banner for retries / ready items

### 3. Content Library

- PageHeader + orientation + breadcrumbs
- “Where things live” zone map (drafts, awaiting opinion, publishing, published, history)
- Status labels aligned with publishing vocabulary
- Continuity hints based on pending/ready counts

### 4. Results

- Framed as wins / completed marketing / successful publications / engagement progress
- Reduced operational noise (score badges softened; winners highlighted)
- Journey trail + next step back to recommendations

### 5. Cross-workflow continuity

- Shared `FULL_CUSTOMER_JOURNEY_STEPS`: Recommendation → Content → Approval → Publishing → Results
- `NextStepHint` on Recommendations, Library, Approvals, Publishing, Results
- Existing `CONTENT_WORKFLOW_STEPS` / `RECOMMENDATION_WORKFLOW_STEPS` retained

### 6. Navigation

- Advanced group descriptions clarified (“Deeper insights”, “keep folded away until you need them”)
- Primary four-item nav unchanged (Library / Results / Approvals / HoM pattern)

### 7. Microcopy

- Encouraging, professional labels across approve/reject/publish/retry/refresh
- Loading/processing hints avoid uncertainty
- No internal pipeline / engine terminology on customer surfaces

### 8. Loading experience

- `ProcessingNotice` for approve, bulk approve, publish, refresh, history
- Results refresh explains expected wait

### 9. Visual consistency

- Reused Phase 4A chrome: PageHeader, OrientationNote, WorkflowTrail, AttentionBanner, NextStepHint
- Consistent min-h-11 touch targets and badge language

### 10. Accessibility

- `role="status"` / `aria-live` on attention and processing notices
- Filter `aria-pressed`, dialog labelling on history drawer
- Focusable controls via `hom-focusable`
- Text + tone on statuses (not color-only)

### 11. Mobile

- Stacked attention banners and action bars
- Collapsible optional sections on Approvals
- Touch-friendly filter/action buttons across Approvals, Publishing, Library, Results

## Performance

- No new engines, polling, or duplicate fetches
- Presentation-only helpers in `lib/customer-ux/workflowPresentation.ts`

## Customer journey improvements

| Step | Customer answer |
| --- | --- |
| Recommendation | Why this idea, and what accepting does |
| Content / Library | Where drafts vs published vs history live |
| Approval | What needs me today; approve ≠ publish |
| Publishing | What’s happening / do I act / what’s next |
| Results | Wins and progress, not pipeline noise |

## Remaining UX backlog (Phase 4C candidates)

- True multi-select checkboxes for approvals (beyond approve-all)
- Due dates if/when product data supports them
- Unified publishing timeline combining queue + live activity
- Results empty-state guided tour after first publish
- Deeper mobile calendar for Approvals
- Optional progressive disclosure of Command Center metrics on HoM

## Recommendation for Phase 4C

**Phase 4C — Trust & Recovery Loops:** deepen failure recovery, first-publish celebration, and “what changed since last visit” without adding intelligence engines — keep everyday trust high after the Phase 4B clarity pass.
