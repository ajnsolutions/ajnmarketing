/**
 * Category filter groups for Strategic Marketing Calendar.
 */

import {
  StrategicCalendarCategories,
  StrategicCalendarFilterGroups,
  type StrategicCalendarCategory,
  type StrategicCalendarFilterGroup,
  type StrategicMarketingCalendarEvent,
} from "@/lib/strategic-marketing-calendar/calendar-types";

export const FILTER_GROUP_CATEGORIES: Record<
  StrategicCalendarFilterGroup,
  readonly StrategicCalendarCategory[]
> = {
  [StrategicCalendarFilterGroups.PRIORITIES]: [
    StrategicCalendarCategories.EXECUTIVE_PRIORITY,
  ],
  [StrategicCalendarFilterGroups.CAMPAIGNS]: [
    StrategicCalendarCategories.CAMPAIGN,
    StrategicCalendarCategories.CAMPAIGN_STEP,
  ],
  [StrategicCalendarFilterGroups.PUBLISHING]: [
    StrategicCalendarCategories.PUBLISHING,
    StrategicCalendarCategories.GOOGLE_BUSINESS,
    StrategicCalendarCategories.SOCIAL_CONTENT,
    StrategicCalendarCategories.BLOG_CONTENT,
    StrategicCalendarCategories.EMAIL_CONTENT,
    StrategicCalendarCategories.WEBSITE_CONTENT,
  ],
  [StrategicCalendarFilterGroups.APPROVALS]: [
    StrategicCalendarCategories.APPROVAL,
  ],
  [StrategicCalendarFilterGroups.RECOMMENDATIONS]: [
    StrategicCalendarCategories.RECOMMENDATION,
  ],
  [StrategicCalendarFilterGroups.MARKET_CONTEXT]: [
    StrategicCalendarCategories.MARKET_CONTEXT,
    StrategicCalendarCategories.HOLIDAY,
    StrategicCalendarCategories.LOCAL_EVENT,
    StrategicCalendarCategories.REVIEW_ACTIVITY,
  ],
  [StrategicCalendarFilterGroups.DECISION_INTELLIGENCE]: [
    StrategicCalendarCategories.DECISION_INTELLIGENCE,
  ],
};

const ALL_CATEGORIES = new Set<string>(Object.values(StrategicCalendarCategories));

export function parseCategoryAllowlist(
  raw: string | null | undefined,
): StrategicCalendarCategory[] | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const allowed: StrategicCalendarCategory[] = [];
  for (const part of parts) {
    if (!ALL_CATEGORIES.has(part)) {
      throw new Error(`Invalid category: ${part}`);
    }
    allowed.push(part as StrategicCalendarCategory);
  }
  return allowed;
}

export function parseFilterGroups(
  raw: string | null | undefined,
): StrategicCalendarFilterGroup[] | null {
  if (!raw || !raw.trim()) return null;
  const valid = new Set<string>(Object.values(StrategicCalendarFilterGroups));
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const groups: StrategicCalendarFilterGroup[] = [];
  for (const part of parts) {
    if (!valid.has(part)) {
      throw new Error(`Invalid filter group: ${part}`);
    }
    groups.push(part as StrategicCalendarFilterGroup);
  }
  return groups;
}

export function categoriesForFilterGroups(
  groups: StrategicCalendarFilterGroup[],
): Set<StrategicCalendarCategory> {
  const set = new Set<StrategicCalendarCategory>();
  for (const group of groups) {
    for (const category of FILTER_GROUP_CATEGORIES[group]) {
      set.add(category);
    }
  }
  return set;
}

export function filterCalendarEvents(
  events: StrategicMarketingCalendarEvent[],
  categories: Set<StrategicCalendarCategory> | null,
): StrategicMarketingCalendarEvent[] {
  if (!categories || categories.size === 0) return events;
  return events.filter((event) => categories.has(event.category));
}

export const FILTER_GROUP_LABELS: Record<StrategicCalendarFilterGroup, string> = {
  [StrategicCalendarFilterGroups.PRIORITIES]: "Priorities",
  [StrategicCalendarFilterGroups.CAMPAIGNS]: "Campaigns",
  [StrategicCalendarFilterGroups.PUBLISHING]: "Publishing",
  [StrategicCalendarFilterGroups.APPROVALS]: "Approvals",
  [StrategicCalendarFilterGroups.RECOMMENDATIONS]: "Recommendations",
  [StrategicCalendarFilterGroups.MARKET_CONTEXT]: "Market context",
  [StrategicCalendarFilterGroups.DECISION_INTELLIGENCE]: "Decision history",
};
