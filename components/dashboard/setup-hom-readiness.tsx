import Link from "next/link";
import type { GuidedSetupExperience } from "@/lib/guided-setup/types";

/**
 * Honest readiness gate — uses guided setup (one next step + calm empty states).
 * Never implies something is broken.
 */
export function SetupHomReadinessPanel({
  experience,
}: {
  experience: GuidedSetupExperience;
}) {
  const next = experience.recommendedNext;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Growth Advisor
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900">
          {experience.headline}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-text-muted">{experience.lead}</p>
      </header>

      {experience.latestFirstWin ? (
        <section className="rounded-2xl border border-emerald-200 bg-growth-50/50 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            First win so far
          </p>
          <p className="mt-2 text-base font-semibold text-navy-900">{experience.latestFirstWin.title}</p>
          <p className="mt-1 text-sm leading-6 text-text-muted">{experience.latestFirstWin.detail}</p>
        </section>
      ) : null}

      {next ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
          <h2 className="text-lg font-bold text-navy-900">Recommended next</h2>
          <p className="mt-2 text-base font-semibold text-navy-900">{next.title}</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{next.why}</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            <span className="font-medium text-slate-600">What improves after. </span>
            {next.brainImprovement}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href={next.href}
              className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {next.actionLabel}
            </Link>
            <Link
              href="/dashboard/setup"
              className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
            >
              Open guided setup
            </Link>
          </div>
        </section>
      ) : null}

      {experience.emptyStates[0] ? (
        <section className="rounded-2xl bg-[#F8FAFC] px-5 py-4 ring-1 ring-slate-200/70">
          <h2 className="text-sm font-semibold text-navy-900">What&apos;s missing</h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">{experience.emptyStates[0].whatMissing}</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            <span className="font-medium text-slate-600">Why it matters. </span>
            {experience.emptyStates[0].whyItMatters}
          </p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            <span className="font-medium text-slate-600">What I&apos;ll improve. </span>
            {experience.emptyStates[0].whatImproves}
          </p>
        </section>
      ) : null}
    </div>
  );
}
