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

Invalid / inverted / oversized ranges are rejected by the API. An unrecognized `view` value is also rejected (`400`) — it does not silently fall back to month (fixed during review; the original behavior treated any unrecognized string as `month`, which could mask a client bug). A missing `view` still defaults to month, since that's a normal, expected request shape.

Month-view "Previous"/"Next" navigation uses real calendar-month arithmetic (`addCalendarMonths`), clamped to the last real day of the target month (e.g. Jan 31 → Feb 28). Fixed during review: the original implementation shifted the anchor by a fixed 28 days, which can fail to leave a 30/31-day month at all when starting near its beginning (e.g. clicking "Next" from the 1st of March would land on the 29th — still March — making the button appear to do nothing), and would drift the anchor's day-of-month over repeated clicks. Day and week navigation are unaffected — a day is always exactly 1 day and a week is always exactly 7 days, so a fixed offset is correct for those views.

## Timezone handling

`business_profiles` has **no timezone column**. Convention: **UTC** (`DEFAULT_BUSINESS_TIMEZONE`).

- All-day events use noon UTC on the date key to avoid day-boundary shifts.
- Timed publishing uses the stored ISO timestamp.
- Server never infers timezone from the browser — day-boundary assignment always uses the business timezone constant, tested explicitly against a timed event near the UTC midnight boundary in both a negative-offset zone (`America/Los_Angeles`) and a positive-offset zone (`Asia/Tokyo`) to confirm neither browser zone silently substitutes for the server's own.
- DST is tested for both the US spring-forward and fall-back transition weeks — noon-UTC date-key arithmetic does not shift, duplicate, or omit a day across either transition.
- When a business timezone is added later, `resolveBusinessTimezone` is the single adapter. This remains a **future** requirement — no second timezone preference or per-business timezone field was added in this PR.

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

- Same calendar day + title for `executive_priority`: Marketing Director explicitly wins over Executive Brief. This is decided by a dedicated winner-selection rule (`dedupeCalendarEvents` in `calendar-ordering.ts`), not by the general sort tie-break — a prior version relied on the tie-break's alphabetical `sourceType` comparison, under which `"executive_brief"` sorts before `"marketing_director"` and would have silently won every time, the opposite of the documented and intended behavior (fixed during review).
- Title-based matching is used for this one case because `HeadOfMarketingPrimaryAction` and `ExecutiveBriefItem` carry no shared identifier (`ExecutiveBriefItem` is just `{ text: string }`) — there is no stable id or explicit relationship to dedupe on instead. It is scoped as tightly as the available data allows: exact match after trim/lowercase (never fuzzy or substring), same calendar day only, and restricted to the single `executive_priority` category.
- **Campaign step vs. publishing title matching was removed during review.** `CampaignTimelineStep` has no link to a `publishing_queue`/`content_approval` row, and campaign step labels are per-template constants (e.g. "Publish social post") that are more likely to accidentally collide with an unrelated publishing item's title than to correctly identify a genuine relationship. Both events are now always shown distinctly; a real campaign-step↔publishing link should be added as an explicit relationship in a future phase, not inferred from text.

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

## Accessibility

Agenda list, not a visual grid — day/week/month controls and category filters use `aria-pressed`; the range label updates via `aria-live="polite"`; source-load warnings render with `role="status"`; event buttons carry a full accessible name (title, category, when, status, action-required) built by `eventAccessibleLabel`, never color-only category signaling. The event detail overlay is `role="dialog"` / `aria-modal="true"`, closes on Escape or an explicit Close button, and — fixed during review — now moves focus into the dialog when it opens and restores focus to the triggering event button when it closes (`dialogRef`/`triggerRef` in `strategic-marketing-calendar-page.tsx`); previously focus was left stranded on whatever was focused before the overlay opened, and was never returned on close.

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

## Claude Review — Findings and Fixes

Independent architecture/security/accessibility/timezone review performed after the PR's own verification pass. Every finding below was reproduced (a failing test written first where practical) before being fixed, and a passing test now guards it.

| Finding | Severity | Fix |
|---|---|---|
| Month-view "Previous"/"Next" used a fixed 28-day jump, which can fail to leave a 30/31-day month when starting near its beginning (button appears to do nothing) and drifts the anchor's day-of-month over repeated clicks | Real navigation bug, reachable on first load (month is the default view) | Added `addCalendarMonths` (real calendar-month arithmetic, clamped to the target month's last real day); `shiftAnchor` now uses it for month view only |
| "MD wins" dedupe for `executive_priority` was not actually implemented — it relied on `sortCalendarEvents`' tie-break, which compares `sourceType` alphabetically, and `"executive_brief"` sorts before `"marketing_director"`, so Executive Brief silently won every collision, contradicting both the code comment and this doc's own "MD wins" claim | Real bug — the documented behavior was inverted | `dedupeCalendarEvents` now selects the winner via an explicit rule, independent of display sort order |
| Campaign step ↔ publishing dedup used title-only matching with no stable identifier or explicit relationship, and campaign step labels are per-template constants likely to accidentally collide with unrelated publishing titles | Matches the explicit "do not use title-only fuzzy matching unless justified and tightly bounded" review requirement | Removed; both events now always show distinctly |
| Executive-priority dedup also uses title matching | Reviewed and kept | No stable identifier exists in the current `ExecutiveBriefItem`/`HeadOfMarketingPrimaryAction` types to dedupe on instead — justified in code comments and here; scoped to exact match, same day, one category only |
| An explicitly invalid `view` query value silently fell back to month instead of being rejected | Minor — masks client bugs, not a security issue | `resolveCalendarRange` now rejects an unrecognized (but non-empty) `view` with `400`; a *missing* `view` still defaults to month |
| Event detail dialog never moved focus in on open or restored it on close | Accessibility gap (WCAG dialog pattern) | Added focus management (`dialogRef`/`triggerRef`) |
| `getStrategicCalendarPreviewForCurrentUser` (calendar-service.ts) is unused dead code that, if wired into the HoM page in a future change, would trigger a second full Marketing Director/Executive Brief resolve per page load | Latent footgun, not an active bug | Added an explicit doc comment on the function warning against this; the actual HoM preview path (`getHeadOfMarketingBriefingForCurrentUser` → `briefing.calendarPreview`) was confirmed correct and untouched |

**Confirmed correct on inspection, no fix needed:** tenant isolation (every normalizer filters by `business_profile_id`; `loadCalendarSources` applies the same filter again as defense-in-depth; `businessProfileId` is never taken from client input anywhere in the API/service layer — always `getBusinessProfileForUser()`, which re-derives the session server-side); read-only boundary (zero write-verb calls anywhere in `lib/strategic-marketing-calendar/`, `app/api/strategic-marketing-calendar/`, or the two UI components; only `GET` is exported from the route); honest status mapping (unscheduled publishing items are skipped before they ever reach a status; pending approvals are always `awaiting_approval`, never `scheduled`, and are only ever anchored to today); partial-failure handling (`Promise.allSettled`, warnings surfaced to the UI via `role="status"`, no single source failure blanks the calendar); no duplicate Marketing Director/Executive Brief resolve on the actual HoM page path; zero diff in `lib/marketing-director/`, `lib/marketing-decisions/`, `lib/recommendation-learning/`, `lib/campaign-intelligence/`, `lib/publishing-queue/`, `lib/content-approval/`, `lib/market-context/`, `lib/executive-briefing/`, or `trigger/`; `ATTACH_DECLARATIVE_PRODUCTION_CRONS` untouched and `false`.

### Manual smoke-test steps (not run — no authenticated session in this environment)

No seeded test-user credentials are available in this environment, matching the constraint noted for prior Project Magic phase reviews. The automated Playwright coverage above only exercises the unauthenticated redirect and static file-content assertions; the following steps were **not executed** and this is **not** a claim that the authenticated path passed. A human with a real login should verify:

1. Log in, open **Head of Marketing** (`/dashboard`). Confirm a "Strategic calendar" preview section renders between Campaigns and Ask Your Head of Marketing, showing up to the next 7 days, with no loading flash that reads as an error.
2. Open `/dashboard/strategic-marketing-calendar` directly. Confirm it loads in month view by default, agenda-first (list, not a grid), with day/week/month toggle buttons.
3. Click **Next** then **Previous** on month view starting from a date near the 1st of a 30- or 31-day month (e.g. navigate to land on the 1st of a month first). Confirm the visible range label actually changes on **Next** and returns to the original month on **Previous** (this is the month-nav bug fixed in this review — verify it no longer reproduces).
4. Open an event's detail dialog. Confirm keyboard focus visibly lands inside the dialog on open (e.g. on the Close button or dialog container), and pressing Escape or clicking Close returns focus to the event button that opened it (this is the focus-management fix — verify with visible focus rings, not just click-through).
5. Toggle each category filter (Priorities / Campaigns / Publishing / Approvals / Recommendations / Market context) individually and confirm the agenda list updates to match and the `aria-live` range/status text updates.
6. If the business has both a Marketing Director primary action and an Executive Brief item with the same title on the same day, confirm only one `executive_priority` event shows and it is sourced from the Marketing Director (this is the MD-wins fix — inspect via browser dev tools or a temporary console log of `sourceType` if visual sourcing isn't distinguishable).
7. Confirm no control on the page creates, edits, reschedules, approves, or publishes anything — every event, when activated, should navigate to (or open) the existing authoritative feature (e.g. Publishing Queue, Approval Center) rather than mutate state in place.
8. Log in as a second business/tenant (if available) and confirm its calendar shows zero events belonging to the first tenant.
