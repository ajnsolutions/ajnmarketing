import Link from "next/link";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import type { MarketingHealthState } from "@/lib/head-of-marketing/types";

function healthStyles(state: MarketingHealthState): string {
  switch (state) {
    case "excellent":
    case "healthy":
      return "bg-growth-50 text-growth-700 ring-emerald-100";
    case "needs_attention":
      return "bg-amber-50 text-amber-800 ring-amber-100";
    case "at_risk":
      return "bg-rose-50 text-rose-700 ring-rose-100";
  }
}

export function HeadOfMarketingPage({ briefing }: { briefing: HeadOfMarketingBriefing }) {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Your Head of Marketing
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            {briefing.greeting}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${healthStyles(briefing.health.state)}`}
          >
            {briefing.health.label}
          </span>
        </div>
        <p className="mt-4 text-lg leading-8 text-navy-900">{briefing.lead}</p>
        <p className="mt-2 text-sm leading-7 text-text-muted">{briefing.health.message}</p>
      </header>

      <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
        <h2 className="text-lg font-bold text-navy-900">Here&apos;s what I accomplished</h2>
        <ul className="mt-4 space-y-3">
          {briefing.accomplishments.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm leading-6 text-navy-900">
              <span className="mt-0.5 text-growth-600" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h2 className="text-lg font-bold text-navy-900">Here&apos;s what I noticed</h2>
          <ul className="mt-4 space-y-3">
            {briefing.noticed.map((item) => (
              <li key={item} className="text-sm leading-6 text-text-muted">
                {item}
              </li>
            ))}
          </ul>
        </div>

        {briefing.recommendation && (
          <div className="mt-8 border-t border-slate-100 pt-6">
            <h2 className="text-lg font-bold text-navy-900">Here&apos;s what I&apos;d recommend</h2>
            <p className="mt-3 text-base font-semibold text-navy-900">
              {briefing.recommendation.title}
            </p>
            <p className="mt-2 text-sm leading-7 text-text-muted">
              Here&apos;s why it matters: {briefing.recommendation.why}
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-slate-100 pt-6">
          <p className="text-sm text-text-muted">{briefing.health.reason}</p>
          {briefing.estimatedReviewMinutes > 0 && (
            <p className="mt-3 text-sm font-medium text-navy-900">
              Estimated review time: {briefing.estimatedReviewMinutes} minute
              {briefing.estimatedReviewMinutes === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        <div className="mt-8">
          {briefing.primaryAction.kind === "none" ? (
            <div className="rounded-xl border border-emerald-200 bg-growth-50/60 px-5 py-4">
              <p className="text-base font-semibold text-navy-900">
                {briefing.magicMoment ?? "I've got this."}
              </p>
              <p className="mt-1 text-sm leading-7 text-text-muted">
                Go enjoy your day. I&apos;ll let you know when I need you.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={briefing.primaryAction.href}
                className="inline-flex rounded-full bg-[#081426] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426]"
              >
                {briefing.primaryAction.label}
              </Link>
              {briefing.magicMoment && (
                <p className="text-sm text-text-muted">{briefing.magicMoment}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <details className="mt-8 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-sm shadow-sm ring-1 ring-slate-900/[0.03]">
        <summary className="cursor-pointer font-semibold text-navy-900">
          More tools
        </summary>
        <p className="mt-2 text-text-muted">
          Everything below still works — it just stays out of the way so you have one clear place
          for what to do next.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            { href: "/dashboard/approvals", label: "Here's what needs your opinion" },
            { href: "/dashboard/publishing", label: "Here's what I'm preparing" },
            { href: "/dashboard/marketing-plan", label: "Here's what I'd like to accomplish this month" },
            { href: "/dashboard/marketing-recommendations", label: "Here's what I'd recommend next" },
            { href: "/dashboard/tasks", label: "Here's what I'm working on" },
            { href: "/dashboard/analytics", label: "Here's what's improving" },
            { href: "/dashboard/command-center", label: "Detailed workspace (advanced)" },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
