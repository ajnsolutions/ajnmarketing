/**
 * Bounded date-range parsing for Strategic Marketing Calendar.
 */

import {
  CALENDAR_RANGE_BOUNDS,
  StrategicCalendarViews,
  type StrategicCalendarView,
} from "@/lib/strategic-marketing-calendar/calendar-types";
import {
  addDateKeyDays,
  isValidDateKey,
  resolveBusinessTimezone,
  zonedDateKey,
} from "@/lib/strategic-marketing-calendar/calendar-timezone";

export type CalendarRangeRequest = {
  view?: string | null;
  start?: string | null;
  end?: string | null;
  /** Anchor date for navigation (YYYY-MM-DD). Defaults to today in business TZ. */
  anchor?: string | null;
  now?: Date;
  configuredTimezone?: string | null;
};

export type CalendarRangeResult =
  | {
      ok: true;
      view: StrategicCalendarView;
      timezone: string;
      rangeStart: string;
      rangeEnd: string;
      anchor: string;
    }
  | { ok: false; error: string };

function parseView(value: string | null | undefined): StrategicCalendarView {
  if (value === StrategicCalendarViews.DAY) return StrategicCalendarViews.DAY;
  if (value === StrategicCalendarViews.WEEK) return StrategicCalendarViews.WEEK;
  return StrategicCalendarViews.MONTH;
}

function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T12:00:00.000Z`);
  const b = Date.parse(`${end}T12:00:00.000Z`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

function startOfWeekMonday(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDateKeyDays(dateKey, diff);
}

function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function endOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  const last = new Date(Date.UTC(year!, month!, 0, 12));
  return last.toISOString().slice(0, 10);
}

export function resolveCalendarRange(input: CalendarRangeRequest): CalendarRangeResult {
  const timezone = resolveBusinessTimezone(input.configuredTimezone);
  const now = input.now ?? new Date();
  const view = parseView(input.view ?? null);
  const today = zonedDateKey(now, timezone);
  const anchor =
    input.anchor && isValidDateKey(input.anchor) ? input.anchor : today;

  let rangeStart: string;
  let rangeEnd: string;

  if (input.start || input.end) {
    if (!input.start || !input.end) {
      return { ok: false, error: "Both start and end are required when either is provided" };
    }
    if (!isValidDateKey(input.start) || !isValidDateKey(input.end)) {
      return { ok: false, error: "start and end must be YYYY-MM-DD" };
    }
    if (input.start > input.end) {
      return { ok: false, error: "start must be on or before end" };
    }
    rangeStart = input.start;
    rangeEnd = input.end;
  } else if (view === StrategicCalendarViews.DAY) {
    rangeStart = anchor;
    rangeEnd = anchor;
  } else if (view === StrategicCalendarViews.WEEK) {
    rangeStart = startOfWeekMonday(anchor);
    rangeEnd = addDateKeyDays(rangeStart, 6);
  } else {
    rangeStart = startOfMonth(anchor);
    rangeEnd = endOfMonth(anchor);
  }

  const span = daysBetween(rangeStart, rangeEnd);
  const max =
    view === StrategicCalendarViews.DAY
      ? CALENDAR_RANGE_BOUNDS.dayMaxDays
      : view === StrategicCalendarViews.WEEK
        ? CALENDAR_RANGE_BOUNDS.weekMaxDays
        : CALENDAR_RANGE_BOUNDS.monthMaxDays;

  if (span > max) {
    return {
      ok: false,
      error: `Range exceeds maximum of ${max} days for ${view} view`,
    };
  }

  return {
    ok: true,
    view,
    timezone,
    rangeStart,
    rangeEnd,
    anchor,
  };
}

export function dateKeyInRange(dateKey: string, rangeStart: string, rangeEnd: string): boolean {
  return dateKey >= rangeStart && dateKey <= rangeEnd;
}

export function isoInRange(
  iso: string,
  rangeStart: string,
  rangeEnd: string,
  timeZone: string,
): boolean {
  const key = zonedDateKey(iso, timeZone);
  return Boolean(key) && dateKeyInRange(key, rangeStart, rangeEnd);
}

export function enumerateDateKeys(rangeStart: string, rangeEnd: string): string[] {
  const keys: string[] = [];
  let cursor = rangeStart;
  while (cursor <= rangeEnd) {
    keys.push(cursor);
    cursor = addDateKeyDays(cursor, 1);
  }
  return keys;
}
