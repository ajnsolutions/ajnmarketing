import Link from "next/link";
import type { StrategicCalendarPreview } from "@/lib/strategic-marketing-calendar/calendar-types";
import { CATEGORY_LABELS } from "@/lib/strategic-marketing-calendar/calendar-presentation";
import { formatEventWhen } from "@/lib/strategic-marketing-calendar/calendar-timezone";

export function StrategicCalendarPreviewSection({
  preview,
}: {
  preview: StrategicCalendarPreview | null;
}) {
  return (
    <section
      className="hom-disclose-content mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="strategic-calendar-preview-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
            Strategic calendar
          </p>
          <h2
            id="strategic-calendar-preview-heading"
            className="mt-2 text-xl font-bold text-navy-900"
          >
            Next 7 days
          </h2>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            A read-only view of priorities, campaigns, and scheduled work already in motion.
          </p>
        </div>
        <Link
          href="/dashboard/strategic-marketing-calendar"
          className="hom-focusable rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-50"
        >
          Open full calendar
        </Link>
      </div>

      {!preview || preview.nextEvents.length === 0 ? (
        <p className="mt-5 text-sm leading-7 text-text-muted">
          Nothing dated in the next week yet. Approvals and campaigns will show here when they have
          real dates.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Today
              </dt>
              <dd className="mt-1 text-navy-900">{preview.todayLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Pending approvals
              </dt>
              <dd className="mt-1 text-navy-900">{preview.pendingApprovalCount}</dd>
            </div>
          </dl>

          {preview.todayActionRequired.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Needs you today
              </p>
              <ul className="mt-2 space-y-2">
                {preview.todayActionRequired.map((event) => (
                  <li key={event.id} className="text-sm leading-6 text-navy-900">
                    <Link
                      href={event.detailTarget}
                      className="hom-focusable font-medium text-brand-600 hover:text-brand-700"
                    >
                      {event.title}
                    </Link>
                    <span className="text-text-muted">
                      {" "}
                      · {CATEGORY_LABELS[event.category]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="mt-5 space-y-3">
            {preview.nextEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-100 pt-3 text-sm first:border-t-0 first:pt-0"
              >
                <div>
                  <Link
                    href={event.detailTarget}
                    className="hom-focusable font-semibold text-navy-900 hover:text-brand-700"
                  >
                    {event.title}
                  </Link>
                  <p className="mt-0.5 text-text-muted">
                    {CATEGORY_LABELS[event.category]}
                    {event.actionRequired ? " · action required" : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {formatEventWhen(event.startAt, event.allDay, preview.timezone)}
                </span>
              </li>
            ))}
          </ul>

          {preview.nextCampaignMilestone && (
            <p className="mt-4 text-sm leading-7 text-text-muted">
              Next campaign milestone:{" "}
              <span className="font-medium text-navy-900">
                {preview.nextCampaignMilestone.title}
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
