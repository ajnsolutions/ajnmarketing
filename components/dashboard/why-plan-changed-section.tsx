import Link from "next/link";
import type { WhyPlanChangedPreview } from "@/lib/decision-intelligence/dashboard";
import { PartialDataNotice, DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import { ReadOnlyNotice } from "@/components/dashboard/ui/page-chrome";

/**
 * Compact Head of Marketing preview of Decision Intelligence (Phase 2F). Read-only —
 * links to the full /dashboard/decision-intelligence page rather than duplicating it.
 */
export function WhyPlanChangedSection({ preview }: { preview: WhyPlanChangedPreview | null }) {
  if (!preview) {
    return (
      <section
        className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="why-plan-changed-heading"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Why the plan changed
        </p>
        <h2 id="why-plan-changed-heading" className="mt-2 text-xl font-bold text-navy-900">
          Decision history unavailable
        </h2>
        <div className="mt-3">
          <DashboardEmptyState
            kind="source_unavailable"
            title="Couldn’t load decision history"
            description="Try again shortly. Your Head of Marketing priorities above are still available."
            actionLabel="Retry Head of Marketing"
            actionHref="/dashboard"
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="why-plan-changed-heading"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Why the plan changed</p>
      <h2 id="why-plan-changed-heading" className="mt-2 text-xl font-bold text-navy-900">
        {preview.hasDecision ? "What changed" : "Getting started"}
      </h2>

      <ReadOnlyNotice>
        Explanation only — this section never changes your plan by itself.
      </ReadOnlyNotice>

      <p className="mt-3 text-sm leading-7 text-navy-900">{preview.headline}</p>

      {preview.supportingReasons.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {preview.supportingReasons.map((reason, index) => (
            <li key={index} className="text-sm leading-6 text-text-muted">
              {reason}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {preview.latestLearning && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Latest learning</dt>
            <dd className="mt-1 text-navy-900">{preview.latestLearning}</dd>
          </div>
        )}
        {preview.latestOverride && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Customer override</dt>
            <dd className="mt-1 text-navy-900">{preview.latestOverride}</dd>
          </div>
        )}
        {preview.latestInconclusiveExperiment && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Experiment</dt>
            <dd className="mt-1 text-navy-900">{preview.latestInconclusiveExperiment}</dd>
          </div>
        )}
      </dl>

      {preview.warningCount > 0 && (
        <div className="mt-3">
          <PartialDataNotice message="Some decision-history sources were unavailable when this was generated." />
        </div>
      )}

      <Link
        href="/dashboard/decision-intelligence"
        className="hom-focusable mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
      >
        See the full decision history →
      </Link>
    </section>
  );
}
