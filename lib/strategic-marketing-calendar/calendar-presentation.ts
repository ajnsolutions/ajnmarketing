/**
 * Presentation helpers: day buckets, preview, category labels.
 */

import { eventDayKey } from "@/lib/strategic-marketing-calendar/calendar-normalizers";
import { sortCalendarEvents } from "@/lib/strategic-marketing-calendar/calendar-ordering";
import { dateKeyInRange } from "@/lib/strategic-marketing-calendar/calendar-range";
import {
  addDateKeyDays,
  formatEventWhen,
} from "@/lib/strategic-marketing-calendar/calendar-timezone";
import {
  StrategicCalendarCategories,
  type StrategicCalendarCategory,
  type StrategicCalendarPreview,
  type StrategicMarketingCalendarEvent,
  type StrategicMarketingCalendarResponse,
} from "@/lib/strategic-marketing-calendar/calendar-types";

export const CATEGORY_LABELS: Record<StrategicCalendarCategory, string> = {
  [StrategicCalendarCategories.EXECUTIVE_PRIORITY]: "Priority",
  [StrategicCalendarCategories.CAMPAIGN]: "Campaign",
  [StrategicCalendarCategories.CAMPAIGN_STEP]: "Campaign step",
  [StrategicCalendarCategories.PUBLISHING]: "Publishing",
  [StrategicCalendarCategories.APPROVAL]: "Approval",
  [StrategicCalendarCategories.RECOMMENDATION]: "Recommendation",
  [StrategicCalendarCategories.REVIEW_ACTIVITY]: "Reviews",
  [StrategicCalendarCategories.MARKET_CONTEXT]: "Market context",
  [StrategicCalendarCategories.HOLIDAY]: "Holiday",
  [StrategicCalendarCategories.LOCAL_EVENT]: "Local event",
  [StrategicCalendarCategories.GOOGLE_BUSINESS]: "Google Business",
  [StrategicCalendarCategories.WEBSITE_CONTENT]: "Website",
  [StrategicCalendarCategories.SOCIAL_CONTENT]: "Social",
  [StrategicCalendarCategories.BLOG_CONTENT]: "Blog",
  [StrategicCalendarCategories.EMAIL_CONTENT]: "Email",
  [StrategicCalendarCategories.DECISION_INTELLIGENCE]: "Decision history",
};

export type CalendarDayBucket = {
  dateKey: string;
  label: string;
  events: StrategicMarketingCalendarEvent[];
  overflowCount: number;
};

export function bucketEventsByDay(
  response: StrategicMarketingCalendarResponse,
  options?: { maxPerDay?: number },
): CalendarDayBucket[] {
  const maxPerDay = options?.maxPerDay ?? 4;
  const map = new Map<string, StrategicMarketingCalendarEvent[]>();

  for (const event of response.events) {
    const key = eventDayKey(event, response.timezone);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }

  const keys = [...map.keys()].sort();
  return keys.map((dateKey) => {
    const events = sortCalendarEvents(map.get(dateKey) ?? []);
    const visible = events.slice(0, maxPerDay);
    return {
      dateKey,
      label: formatEventWhen(`${dateKey}T12:00:00.000Z`, true, response.timezone),
      events: visible,
      overflowCount: Math.max(0, events.length - visible.length),
    };
  });
}

export function buildCalendarPreview(
  response: StrategicMarketingCalendarResponse,
  todayKey: string,
): StrategicCalendarPreview {
  const weekEnd = addDateKeyDays(todayKey, 6);
  const inNextWeek = response.events.filter((event) => {
    const key = eventDayKey(event, response.timezone);
    return key && dateKeyInRange(key, todayKey, weekEnd);
  });

  const ordered = sortCalendarEvents(inNextWeek);
  const todayActionRequired = ordered.filter(
    (event) =>
      event.actionRequired && eventDayKey(event, response.timezone) === todayKey,
  );
  const nextCampaignMilestone =
    ordered.find(
      (event) =>
        event.category === StrategicCalendarCategories.CAMPAIGN_STEP &&
        event.status !== "completed",
    ) ?? null;

  return {
    timezone: response.timezone,
    todayLabel: formatEventWhen(`${todayKey}T12:00:00.000Z`, true, response.timezone),
    nextEvents: ordered.slice(0, 5),
    todayActionRequired: todayActionRequired.slice(0, 3),
    nextCampaignMilestone,
    pendingApprovalCount: response.pendingApprovalCount,
    fullCalendarHref: "/dashboard/strategic-marketing-calendar",
  };
}

export function eventAccessibleLabel(
  event: StrategicMarketingCalendarEvent,
  timeZone: string,
): string {
  const when = formatEventWhen(event.startAt, event.allDay, timeZone);
  const category = CATEGORY_LABELS[event.category] ?? event.category;
  const action = event.actionRequired ? ", action required" : "";
  return `${event.title}, ${category}, ${when}, ${event.status.replaceAll("_", " ")}${action}`;
}
