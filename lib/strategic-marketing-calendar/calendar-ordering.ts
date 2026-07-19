/**
 * Deterministic ordering and deduplication for calendar events.
 *
 * Order groups:
 * 1. action-required
 * 2. executive priorities
 * 3. scheduled publishing
 * 4. campaign milestones
 * 5. approvals
 * 6. dated recommendations
 * 7. market context / informational
 *
 * Within a group: startAt → priority → sourceType → sourceId → id
 */

import {
  StrategicCalendarPriorityLevels,
  type StrategicMarketingCalendarEvent,
} from "@/lib/strategic-marketing-calendar/calendar-types";

const PRIORITY_RANK: Record<string, number> = {
  [StrategicCalendarPriorityLevels.ACTION_REQUIRED]: 0,
  [StrategicCalendarPriorityLevels.EXECUTIVE]: 1,
  [StrategicCalendarPriorityLevels.SCHEDULED]: 2,
  [StrategicCalendarPriorityLevels.CAMPAIGN]: 3,
  [StrategicCalendarPriorityLevels.APPROVAL]: 4,
  [StrategicCalendarPriorityLevels.RECOMMENDATION]: 5,
  [StrategicCalendarPriorityLevels.INFORMATIONAL]: 6,
};

function groupRank(event: StrategicMarketingCalendarEvent): number {
  if (event.actionRequired) return 0;
  return PRIORITY_RANK[event.priority] ?? 99;
}

export function compareCalendarEvents(
  a: StrategicMarketingCalendarEvent,
  b: StrategicMarketingCalendarEvent,
): number {
  const group = groupRank(a) - groupRank(b);
  if (group !== 0) return group;
  const start = a.startAt.localeCompare(b.startAt);
  if (start !== 0) return start;
  const priority =
    (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
  if (priority !== 0) return priority;
  const source = a.sourceType.localeCompare(b.sourceType);
  if (source !== 0) return source;
  const sourceId = a.sourceId.localeCompare(b.sourceId);
  if (sourceId !== 0) return sourceId;
  return a.id.localeCompare(b.id);
}

export function sortCalendarEvents(
  events: StrategicMarketingCalendarEvent[],
): StrategicMarketingCalendarEvent[] {
  return [...events].sort(compareCalendarEvents);
}

/**
 * Deduplicate overlapping priority markers from MD + Executive Brief.
 * Winner: marketing_director over executive_brief for the same calendar day + title.
 *
 * [Claude review] Title-based matching is used here deliberately, not as a shortcut:
 * `HeadOfMarketingPrimaryAction` and `ExecutiveBriefItem` (lib/head-of-marketing/types.ts,
 * lib/executive-briefing/types.ts) carry no shared identifier — `ExecutiveBriefItem` is
 * just `{ text: string }` — so there is no stable id or explicit relationship to dedupe
 * on. This is scoped as tightly as the available data allows: exact match only (not
 * fuzzy/substring), same calendar day only, and restricted to the single
 * `executive_priority` category. A prior version of this function additionally
 * suppressed a `campaign_step` whenever *any* `publishing` event shared its day+title —
 * removed during review: `CampaignTimelineStep` (lib/campaign-intelligence/campaign-types.ts)
 * has no link to a publishing_queue/content_approval row either, and unlike the MD/Brief
 * case, campaign step labels are per-template constants (e.g. "Publish social post")
 * that are far more likely to accidentally collide with an unrelated publishing item's
 * title than to correctly identify a genuine relationship — a false-positive dedupe here
 * would hide a real, distinct calendar item. Showing both is the honest default; a real
 * campaign-step<->publishing link should be added as an explicit relationship in a
 * future phase, not inferred from text.
 */
export function dedupeCalendarEvents(
  events: StrategicMarketingCalendarEvent[],
): StrategicMarketingCalendarEvent[] {
  // [Claude review] fix: winner selection must be explicit, not incidental. The prior
  // implementation relied on sortCalendarEvents' general tie-break order (which compares
  // sourceType alphabetically) to decide which duplicate survives — but "executive_brief"
  // sorts before "marketing_director" alphabetically, so Executive Brief silently won
  // every time, contradicting both this function's own doc comment and
  // docs/STRATEGIC_MARKETING_CALENDAR.md's documented "MD wins" behavior. Winner
  // selection is now a dedicated, explicit rule, independent of display order.
  const priorityWinners = new Map<string, StrategicMarketingCalendarEvent>();
  const other: StrategicMarketingCalendarEvent[] = [];

  for (const event of events) {
    if (event.category !== "executive_priority") {
      other.push(event);
      continue;
    }

    const day = event.startAt.slice(0, 10);
    const key = `${day}|${event.title.trim().toLowerCase()}`;
    const existing = priorityWinners.get(key);
    if (!existing || (existing.sourceType !== "marketing_director" && event.sourceType === "marketing_director")) {
      priorityWinners.set(key, event);
    }
  }

  return sortCalendarEvents([...other, ...priorityWinners.values()]);
}
