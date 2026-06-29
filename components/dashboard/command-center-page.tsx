import Link from "next/link";
import {
  CommandCenterQuickActions,
  CommandCenterTakeActionButton,
} from "@/components/dashboard/command-center-actions";
import type { CommandCenterPageData, CommandCenterPriority } from "@/lib/command-center/types";

function SectionCard({
  title,
  subtitle,
  children,
  action,
  actionHref: href,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: string;
  actionHref?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && href && (
          <Link
            href={href}
            className="shrink-0 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {action}
          </Link>
        )}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function PriorityBadge({ priority }: { priority: CommandCenterPriority }) {
  const styles = {
    high: "bg-rose-50 text-rose-600 ring-rose-100",
    medium: "bg-amber-50 text-amber-700 ring-amber-100",
    low: "bg-slate-100 text-slate-600 ring-slate-200",
  }[priority];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {priority} priority
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-navy-900">{label}</span>
        <span className="font-semibold text-slate-600">{value}/100</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function MomentumBadge({ trend }: { trend: "up" | "stable" | "down" }) {
  const styles = {
    up: "bg-growth-50 text-growth-500 ring-emerald-100",
    stable: "bg-slate-100 text-slate-600 ring-slate-200",
    down: "bg-rose-50 text-rose-600 ring-rose-100",
  }[trend];

  const label = trend === "up" ? "Up" : trend === "down" ? "Down" : "Stable";

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${styles}`}>
      {label}
    </span>
  );
}

function PriorityList({
  items,
  emptyMessage,
}: {
  items: CommandCenterPageData["priorities"]["high"];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((task) => (
        <li
          key={task.id}
          className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
        >
          <p className="font-semibold text-navy-900">{task.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
          {task.estimatedMinutes != null && (
            <p className="mt-2 text-xs font-medium text-text-muted">
              ~{task.estimatedMinutes} min
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CommandCenterPage({ data }: { data: CommandCenterPageData }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          AI Marketing Command Center
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          {data.businessName}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
          Your AI Chief Marketing Officer briefing — priorities, health, momentum, and recommended
          actions in one place.
        </p>
      </div>

      <SectionCard
        title="Executive Summary"
        subtitle={
          data.aiInsights.generatedByAi
            ? "Generated from your live marketing systems"
            : "Rule-based briefing (OpenAI unavailable)"
        }
      >
        <p className="text-sm leading-7 text-slate-700">{data.aiInsights.executiveSummary}</p>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
        <SectionCard
          title="Today's Priorities"
          subtitle="From your AI Marketing Agent"
          action="View all tasks"
          actionHref="/dashboard/tasks"
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-navy-900">High</h3>
              <div className="mt-3">
                <PriorityList
                  items={data.priorities.high}
                  emptyMessage="No high-priority tasks today."
                />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Medium</h3>
              <div className="mt-3">
                <PriorityList
                  items={data.priorities.medium}
                  emptyMessage="No medium-priority tasks today."
                />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Low</h3>
              <div className="mt-3">
                <PriorityList
                  items={data.priorities.low}
                  emptyMessage="No low-priority tasks today."
                />
              </div>
            </div>
          </div>
        </SectionCard>
        </div>

        <SectionCard title="Marketing Momentum" subtitle="Trend and drivers">
          <div className="flex items-center gap-3">
            <MomentumBadge trend={data.aiInsights.momentum.trend} />
            <span className="text-sm text-text-muted">Current trajectory</span>
          </div>
          <ul className="mt-4 space-y-2">
            {data.aiInsights.momentum.reasons.length === 0 ? (
              <li className="text-sm text-text-muted">Momentum signals will appear as activity syncs.</li>
            ) : (
              data.aiInsights.momentum.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                  {reason}
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Business Health Score" subtitle="Overall marketing system health">
          <div className="mb-6 flex items-end gap-4">
            <p className="text-5xl font-bold tracking-tight text-navy-900">
              {data.businessHealth.overall}
            </p>
            <p className="pb-2 text-sm font-medium text-text-muted">Overall / 100</p>
          </div>
          <div className="space-y-4">
            <ScoreBar label="SEO" value={data.businessHealth.seo} />
            <ScoreBar label="Google" value={data.businessHealth.google} />
            <ScoreBar label="Reviews" value={data.businessHealth.reviews} />
            <ScoreBar label="Content" value={data.businessHealth.content} />
            <ScoreBar label="Consistency" value={data.businessHealth.consistency} />
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">
            {data.aiInsights.businessHealthExplanation}
          </p>
        </SectionCard>

        <SectionCard title="Weekly Wins" subtitle="Recent measurable progress">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Reviews", value: data.weeklyWins.reviews },
              { label: "Views", value: data.weeklyWins.views },
              { label: "Calls", value: data.weeklyWins.calls },
              { label: "Clicks", value: data.weeklyWins.clicks },
              { label: "Posts", value: data.weeklyWins.posts },
              { label: "Tasks Completed", value: data.weeklyWins.tasksCompleted },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <p className="text-xs font-medium text-text-muted">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-navy-900">{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="AI Recommendations" subtitle="Suggested next actions">
        {data.aiInsights.recommendations.length === 0 ? (
          <p className="text-sm text-text-muted">
            Recommendations will appear once your marketing systems have more activity to analyze.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.aiInsights.recommendations.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={item.priority} />
                </div>
                <h3 className="mt-3 font-semibold text-navy-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                <p className="mt-2 text-sm text-text-muted">
                  <span className="font-semibold text-navy-900">Estimated impact:</span>{" "}
                  {item.estimatedImpact}
                </p>
                <div className="mt-4">
                  <CommandCenterTakeActionButton action={item.recommendedAction} />
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Upcoming Marketing Calendar"
          subtitle="Next 30 days from your marketing plan"
          action="Open plan"
          actionHref="/dashboard/marketing-plan"
        >
          {data.calendar.length === 0 ? (
            <p className="text-sm text-text-muted">
              No upcoming calendar items. Generate or refresh your marketing plan to populate this
              view.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.calendar.map((item) => (
                <li
                  key={`${item.day}-${item.title}`}
                  className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                      {item.dateLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {item.channel}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-navy-900">{item.title}</p>
                  <p className="mt-1 text-sm text-text-muted">{item.contentType}</p>
                  {item.note && (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Competitor Watch" subtitle="Monitoring status">
          <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] px-5 py-8 text-center ring-1 ring-slate-200/60">
            <p className="text-sm leading-7 text-text-muted">{data.competitorWatchMessage}</p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Quick Actions" subtitle="Common workflows">
        <CommandCenterQuickActions />
      </SectionCard>
    </div>
  );
}
