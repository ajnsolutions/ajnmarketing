/**
 * Strategic Marketing Calendar service entrypoints — read-only.
 */

import "server-only";

import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  loadCalendarSources,
  type CalendarDependencies,
} from "@/lib/strategic-marketing-calendar/calendar-dependencies";
import { aggregateStrategicMarketingCalendar } from "@/lib/strategic-marketing-calendar/calendar-aggregator";
import {
  categoriesForFilterGroups,
  parseCategoryAllowlist,
  parseFilterGroups,
} from "@/lib/strategic-marketing-calendar/calendar-filters";
import { resolveCalendarRange } from "@/lib/strategic-marketing-calendar/calendar-range";
import { buildCalendarPreview } from "@/lib/strategic-marketing-calendar/calendar-presentation";
import { zonedDateKey } from "@/lib/strategic-marketing-calendar/calendar-timezone";
import type {
  StrategicCalendarCategory,
  StrategicCalendarPreview,
  StrategicMarketingCalendarResponse,
} from "@/lib/strategic-marketing-calendar/calendar-types";
import { createClient } from "@/lib/supabase/server";

export type GetCalendarInput = {
  view?: string | null;
  start?: string | null;
  end?: string | null;
  anchor?: string | null;
  categories?: string | null;
  filterGroups?: string | null;
  now?: Date;
};

export type GetCalendarResult =
  | { ok: true; calendar: StrategicMarketingCalendarResponse }
  | { ok: false; status: number; error: string };

export async function getStrategicMarketingCalendarForCurrentUser(
  input: GetCalendarInput = {},
  deps?: CalendarDependencies,
): Promise<GetCalendarResult> {
  const supabase = deps?.supabaseClient ?? (await createClient());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return { ok: false, status: 404, error: "Business profile not found" };
  }

  const range = resolveCalendarRange({
    view: input.view,
    start: input.start,
    end: input.end,
    anchor: input.anchor,
    now: input.now,
    configuredTimezone: null, // no stored business timezone yet
  });

  if (!range.ok) {
    return { ok: false, status: 400, error: range.error };
  }

  let categories: Set<StrategicCalendarCategory> | null = null;
  try {
    const fromCategories = parseCategoryAllowlist(input.categories);
    const groups = parseFilterGroups(input.filterGroups);
    if (fromCategories) categories = new Set(fromCategories);
    if (groups) {
      const fromGroups = categoriesForFilterGroups(groups);
      categories = categories
        ? new Set([...categories].filter((item) => fromGroups.has(item)))
        : fromGroups;
    }
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Invalid filters",
    };
  }

  const sources = await loadCalendarSources(user.id, profile.id, {
    ...deps,
    supabaseClient: supabase,
  });

  const todayKey = zonedDateKey(input.now ?? new Date(), range.timezone);
  const calendar = aggregateStrategicMarketingCalendar({
    businessProfileId: profile.id,
    view: range.view,
    timezone: range.timezone,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    todayKey,
    sources,
    categories,
    now: input.now,
  });

  console.info("[StrategicMarketingCalendar]", {
    scope: "strategic-marketing-calendar",
    view: calendar.view,
    eventCount: calendar.events.length,
    warningCount: calendar.warnings.length,
    rangeStart: calendar.rangeStart,
    rangeEnd: calendar.rangeEnd,
  });

  return { ok: true, calendar };
}

/**
 * [Claude review] Not currently called anywhere — the Head of Marketing preview instead
 * gets its `calendarPreview` from `getHeadOfMarketingBriefingForCurrentUser`
 * (lib/head-of-marketing/service.ts), which builds it inline from the briefing it has
 * already computed, so there is exactly one Marketing Director/Executive Brief resolve
 * per HoM page load. This standalone helper independently calls
 * `getStrategicMarketingCalendarForCurrentUser`, which itself resolves a fresh HoM
 * briefing via `loadCalendarSources`'s `loadBriefing` — calling this on the same request
 * as `getHeadOfMarketingBriefingForCurrentUser` would recompute the whole MD/briefing
 * pipeline a second time. Kept for a future standalone-preview use case (e.g. an API
 * route that returns only the preview), but do not wire it into the HoM page — use
 * `briefing.calendarPreview` there instead.
 */
export async function getStrategicCalendarPreviewForCurrentUser(
  deps?: CalendarDependencies,
): Promise<StrategicCalendarPreview | null> {
  const result = await getStrategicMarketingCalendarForCurrentUser(
    { view: "week" },
    deps,
  );
  if (!result.ok) return null;
  const todayKey = zonedDateKey(new Date(), result.calendar.timezone);
  return buildCalendarPreview(result.calendar, todayKey);
}
