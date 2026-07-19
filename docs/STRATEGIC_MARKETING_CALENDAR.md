# Strategic Marketing Calendar

**Project Magic Phase 2D.** Unified, read-only visibility into marketing strategy and activity already produced by AJN Marketing.

## Purpose

Answer:

- What is happening today?
- What is planned this week?
- What is coming over the next ~30 days?
- Which campaigns are active?
- What content is scheduled?
- Which approvals are waiting?
- Which market events may affect the plan?
- What is Marketing Director prioritizing?

## Architecture

Runtime aggregation of authoritative records. **No writable calendar table.** No second planner.

```
Batched source reads
  → source-specific normalizers
  → dedupe + deterministic order
  → client-safe events
  → HoM preview / full calendar UI
```

Marketing Director remains the only strategic decision-maker. The calendar never creates recommendations, campaigns, schedules, approvals, or publishes.

## Read-only boundary

Forbidden in this surface:

- drag-and-drop / reschedule / inline edit / quick-create
- campaign or content creation
- approval or publish mutations
- Marketing Memory writes
- LLM ranking

Event activation opens the existing authoritative feature (`detailTarget`).

## Source-of-truth map

| Category | Authoritative source | Notes |
|---|---|---|
| `executive_priority` | Marketing Director primary action + Executive Brief `today` | MD wins title+day dedupe over brief |
| `campaign` / `campaign_step` | Campaign Intelligence timeline | Only steps with `scheduledFor` |
| `publishing` / `google_business` / `social_content` / `email_content` | Publishing Queue | Requires `scheduled_for`; unscheduled never shown as committed |
| `approval` | Approval Center pending rows | No due date — anchored to **today** as action-required, never “scheduled” |
| `holiday` / `local_event` / `market_context` | Market Context items | Informational only; news/competitor omitted |
| `recommendation` | — | Not dated in model; not fabricated |

## Normalized event model

`StrategicMarketingCalendarEvent` in `lib/strategic-marketing-calendar/calendar-types.ts`.

Client-safe only: no internal scores, evidence packages, or unrestricted payloads.

## Date ranges

| View | Default span | Max span |
|---|---|---|
| day | selected day | 3 days |
| week | Mon–Sun containing anchor | 28 days |
| month | calendar month | 93 days |

Invalid / inverted / oversized ranges are rejected by the API.

## Timezone handling

`business_profiles` has **no timezone column**. Convention: **UTC** (`DEFAULT_BUSINESS_TIMEZONE`).

- All-day events use noon UTC on the date key to avoid day-boundary shifts.
- Timed publishing uses the stored ISO timestamp.
- Server never infers timezone from the browser.
- When a business timezone is added later, `resolveBusinessTimezone` is the single adapter.

## Deterministic ordering

1. action-required  
2. executive priorities  
3. scheduled publishing  
4. campaign milestones  
5. approvals  
6. dated recommendations  
7. informational / market context  

Tie-break: `startAt` → priority → `sourceType` → `sourceId` → `id`.

## Deduplication

- Same calendar day + title for `executive_priority`: Marketing Director wins over Executive Brief.
- Campaign step suppressed when a publishing event shares the same day + title.

## Partial failure

Optional source failures become `warnings[]`. Remaining sources still render.

## API

`GET /api/strategic-marketing-calendar`

Query: `view`, `start`, `end`, `anchor`, `categories`, `filterGroups`

Auth required. No POST/PATCH/DELETE. Business ID taken only from the authenticated profile.

## UI

- HoM preview: next 7 days, between Campaigns and Ask Your Head of Marketing
- Full page: `/dashboard/strategic-marketing-calendar` (agenda-first for accessibility)
- Filters: Priorities / Campaigns / Publishing / Approvals / Recommendations / Market context

## Performance

One batched `Promise.all` of source loaders per request. No per-event queries. Soft cap ~250 events. HoM preview reuses the briefing already composed (no second Marketing Director resolve).

## Explicit non-goals

Email/export sync, Google/Outlook connectors, drag-and-drop, approval-from-calendar, background refresh schedules, Trigger.dev calendars.

`ATTACH_DECLARATIVE_PRODUCTION_CRONS` remains `false`.

## Modules

| File | Role |
|---|---|
| `calendar-types.ts` | Contracts |
| `calendar-timezone.ts` | UTC/business TZ helpers |
| `calendar-range.ts` | Bounded ranges |
| `calendar-normalizers.ts` | Source → event |
| `calendar-ordering.ts` | Sort + dedupe |
| `calendar-filters.ts` | Category groups |
| `calendar-dependencies.ts` | Batched reads |
| `calendar-aggregator.ts` | Pure aggregate |
| `calendar-presentation.ts` | Buckets / preview |
| `calendar-service.ts` | Auth entrypoints |
