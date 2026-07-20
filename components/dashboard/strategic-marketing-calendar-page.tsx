"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  FILTER_GROUP_LABELS,
  categoriesForFilterGroups,
} from "@/lib/strategic-marketing-calendar/calendar-filters";
import {
  CATEGORY_LABELS,
  bucketEventsByDay,
  eventAccessibleLabel,
} from "@/lib/strategic-marketing-calendar/calendar-presentation";
import { addCalendarMonths, addDateKeyDays } from "@/lib/strategic-marketing-calendar/calendar-timezone";
import { formatEventWhen } from "@/lib/strategic-marketing-calendar/calendar-timezone";
import {
  StrategicCalendarFilterGroups,
  StrategicCalendarViews,
  type StrategicCalendarFilterGroup,
  type StrategicCalendarView,
  type StrategicMarketingCalendarEvent,
  type StrategicMarketingCalendarResponse,
} from "@/lib/strategic-marketing-calendar/calendar-types";

const ALL_FILTER_GROUPS = Object.values(StrategicCalendarFilterGroups);

type Props = {
  initialCalendar: StrategicMarketingCalendarResponse;
  initialAnchor: string;
};

function shiftAnchor(anchor: string, view: StrategicCalendarView, direction: -1 | 1): string {
  if (view === StrategicCalendarViews.DAY) return addDateKeyDays(anchor, direction);
  if (view === StrategicCalendarViews.WEEK) return addDateKeyDays(anchor, direction * 7);
  // month: real calendar-month arithmetic — a fixed +/-28-day jump can fail to advance
  // out of a 30/31-day month when starting near its beginning (see calendar-timezone.ts).
  return addCalendarMonths(anchor, direction);
}

export function StrategicMarketingCalendarPage({ initialCalendar, initialAnchor }: Props) {
  const headingId = useId();
  const dialogTitleId = useId();
  const [calendar, setCalendar] = useState(initialCalendar);
  const [view, setView] = useState<StrategicCalendarView>(initialCalendar.view);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [activeGroups, setActiveGroups] = useState<StrategicCalendarFilterGroup[]>([
    ...ALL_FILTER_GROUPS,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StrategicMarketingCalendarEvent | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openEvent = useCallback((event: StrategicMarketingCalendarEvent, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setSelected(event);
  }, []);

  const closeEvent = useCallback(() => {
    setSelected(null);
  }, []);

  const load = useCallback(
    (next: { view: StrategicCalendarView; anchor: string; groups: StrategicCalendarFilterGroup[] }) => {
      startTransition(async () => {
        try {
          setError(null);
          const params = new URLSearchParams({
            view: next.view,
            anchor: next.anchor,
            filterGroups: next.groups.join(","),
          });
          const response = await fetch(`/api/strategic-marketing-calendar?${params.toString()}`);
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? "Could not load calendar");
          }
          const data = (await response.json()) as { calendar: StrategicMarketingCalendarResponse };
          setCalendar(data.calendar);
          setView(next.view);
          setAnchor(next.anchor);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not load calendar");
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!selected) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Focus management: move focus into the dialog when it opens, and return it to the
  // event button that triggered it when it closes — otherwise a keyboard/screen-reader
  // user's focus is silently stranded behind the overlay, or lost entirely on close.
  useEffect(() => {
    if (selected) {
      dialogRef.current?.focus();
      return;
    }
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, [selected]);

  const buckets = useMemo(() => bucketEventsByDay(calendar, { maxPerDay: 8 }), [calendar]);
  const rangeLabel = `${calendar.rangeStart} → ${calendar.rangeEnd}`;

  function toggleGroup(group: StrategicCalendarFilterGroup) {
    const next = activeGroups.includes(group)
      ? activeGroups.filter((item) => item !== group)
      : [...activeGroups, group];
    const safe = next.length === 0 ? [...ALL_FILTER_GROUPS] : next;
    setActiveGroups(safe);
    load({ view, anchor, groups: safe });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="max-w-3xl">
        <p className="mb-3">
          <Link
            href="/dashboard"
            className="hom-focusable text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            ← Back to Head of Marketing
          </Link>
        </p>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Strategic Marketing Calendar
        </p>
        <h1 id={headingId} className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Your plan at a glance
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Read-only view of priorities, campaigns, publishing, and market context already produced
          by AJN Marketing. Nothing here schedules, approves, or invents work.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Times shown in {calendar.timezone}
          {calendar.timezone.toUpperCase() === "UTC"
            ? " (UTC fallback when a business timezone is not configured)."
            : "."}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="hom-focusable min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50"
          onClick={() =>
            load({
              view,
              anchor: new Date().toISOString().slice(0, 10),
              groups: activeGroups,
            })
          }
        >
          Today
        </button>
        <button
          type="button"
          className="hom-focusable min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50"
          aria-label="Previous range"
          onClick={() =>
            load({ view, anchor: shiftAnchor(anchor, view, -1), groups: activeGroups })
          }
        >
          Previous
        </button>
        <button
          type="button"
          className="hom-focusable min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50"
          aria-label="Next range"
          onClick={() =>
            load({ view, anchor: shiftAnchor(anchor, view, 1), groups: activeGroups })
          }
        >
          Next
        </button>
        <button
          type="button"
          className="hom-focusable min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
          disabled={isPending}
          onClick={() => load({ view, anchor, groups: activeGroups })}
        >
          {isPending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Calendar view"
      >
        {(
          [
            StrategicCalendarViews.DAY,
            StrategicCalendarViews.WEEK,
            StrategicCalendarViews.MONTH,
          ] as const
        ).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            className={`hom-focusable min-h-11 rounded-full px-4 py-2 text-sm font-semibold capitalize ${
              view === option
                ? "bg-[#081426] text-white"
                : "border border-slate-200 text-navy-900 hover:bg-slate-50"
            }`}
            onClick={() => load({ view: option, anchor, groups: activeGroups })}
          >
            {option}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-text-muted" aria-live="polite">
        Showing {rangeLabel}
        {isPending ? " · Updating…" : ""}
      </p>

      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Event category filters"
      >
        {ALL_FILTER_GROUPS.map((group) => {
          const pressed = activeGroups.includes(group);
          return (
            <button
              key={group}
              type="button"
              aria-pressed={pressed}
              className={`hom-focusable min-h-11 rounded-full px-3 py-2 text-xs font-semibold sm:text-sm ${
                pressed
                  ? "border border-brand-600 bg-brand-50 text-brand-700"
                  : "border border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
              onClick={() => toggleGroup(group)}
            >
              {FILTER_GROUP_LABELS[group]}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm text-amber-800" role="alert">
          {error}
        </p>
      )}

      {calendar.warnings.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-amber-800" role="status">
          {calendar.warnings.map((warning) => (
            <li key={`${warning.source}:${warning.message}`}>{warning.message}</li>
          ))}
        </ul>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6" aria-labelledby={headingId}>
        {buckets.length === 0 ? (
          <p className="text-sm leading-7 text-text-muted">
            No dated items in this range for the selected filters. Try another week or turn filters
            back on.
          </p>
        ) : (
          <ol className="space-y-6">
            {buckets.map((bucket) => (
              <li key={bucket.dateKey}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {bucket.label}
                </h2>
                <ul className="mt-3 space-y-2">
                  {bucket.events.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        className="hom-focusable flex w-full flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                        aria-label={eventAccessibleLabel(event, calendar.timezone)}
                        onClick={(clickEvent) => openEvent(event, clickEvent.currentTarget)}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-navy-900">
                            {event.title}
                          </span>
                          <span className="mt-1 block text-xs text-text-muted">
                            {CATEGORY_LABELS[event.category]}
                            {" · "}
                            {event.status.replaceAll("_", " ")}
                            {event.actionRequired ? " · action required" : ""}
                            {event.metadata.informational ? " · context only" : ""}
                          </span>
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatEventWhen(event.startAt, event.allDay, calendar.timezone)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {bucket.overflowCount > 0 && (
                  <p className="mt-2 text-xs text-slate-500">+{bucket.overflowCount} more</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="mt-6 text-sm text-text-muted">
        <Link href="/dashboard" className="hom-focusable font-medium text-brand-600 hover:text-brand-700">
          Back to Head of Marketing
        </Link>
      </p>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={closeEvent}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            tabIndex={-1}
            className="hom-focusable w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={dialogTitleId} className="text-lg font-bold text-navy-900">
              {selected.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">{selected.summary}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  When
                </dt>
                <dd className="text-navy-900">
                  {formatEventWhen(selected.startAt, selected.allDay, calendar.timezone)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Status
                </dt>
                <dd className="capitalize text-navy-900">
                  {selected.status.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Category
                </dt>
                <dd className="text-navy-900">{CATEGORY_LABELS[selected.category]}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={selected.detailTarget}
                className="hom-focusable inline-flex min-h-11 items-center rounded-full bg-[#081426] px-4 py-2 text-sm font-semibold text-white"
              >
                Open authoritative view
              </Link>
              <button
                type="button"
                className="hom-focusable min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900"
                onClick={closeEvent}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keep filter category set referenced for tree-shaking clarity in tests */}
      <span className="hidden">{categoriesForFilterGroups(activeGroups).size}</span>
    </div>
  );
}
