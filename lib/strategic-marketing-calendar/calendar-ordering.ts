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
 */
export function dedupeCalendarEvents(
  events: StrategicMarketingCalendarEvent[],
): StrategicMarketingCalendarEvent[] {
  const seenPriorityKeys = new Set<string>();
  const result: StrategicMarketingCalendarEvent[] = [];

  const sorted = sortCalendarEvents(events);
  for (const event of sorted) {
    if (event.category === "executive_priority") {
      const day = event.startAt.slice(0, 10);
      const key = `${day}|${event.title.trim().toLowerCase()}`;
      if (seenPriorityKeys.has(key)) continue;
      seenPriorityKeys.add(key);
    }

    // Prefer publishing-queue over a campaign_step with identical title+day when both exist.
    if (event.category === "campaign_step") {
      const day = event.startAt.slice(0, 10);
      const clash = result.some(
        (existing) =>
          existing.category === "publishing" &&
          existing.startAt.slice(0, 10) === day &&
          existing.title.trim().toLowerCase() === event.title.trim().toLowerCase(),
      );
      if (clash) continue;
    }

    result.push(event);
  }

  return sortCalendarEvents(result);
}
