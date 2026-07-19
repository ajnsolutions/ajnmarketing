/**
 * Business timezone helpers for Strategic Marketing Calendar.
 *
 * Authoritative convention: UTC until business_profiles stores a timezone.
 * Never infer from the browser when assembling server events.
 */

import { DEFAULT_BUSINESS_TIMEZONE } from "@/lib/strategic-marketing-calendar/calendar-types";

export function resolveBusinessTimezone(configured: string | null | undefined): string {
  const trimmed = configured?.trim();
  if (!trimmed) return DEFAULT_BUSINESS_TIMEZONE;
  try {
    // Validate IANA zone via Intl.
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE;
  }
}

/** Calendar date key (YYYY-MM-DD) in the business timezone. */
export function zonedDateKey(isoOrDate: string | Date, timeZone: string): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Stable all-day anchor: noon UTC on the calendar date (avoids day-boundary shifts). */
export function allDayStartAt(dateKey: string): string {
  return `${dateKey}T12:00:00.000Z`;
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`));
}

/** Add calendar days to a YYYY-MM-DD key (UTC noon arithmetic — DST-safe for date keys). */
export function addDateKeyDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Format a client-facing date/time label in the business timezone.
 * All-day events show the calendar date only.
 */
export function formatEventWhen(
  startAt: string,
  allDay: boolean,
  timeZone: string,
): string {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return "";
  if (allDay) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
