import Link from "next/link";
import { AnalyticsRefreshButton } from "@/components/dashboard/analytics-actions";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import {
  formatAnalyticsCategory,
  formatAnalyticsDate,
  formatAnalyticsPriority,
} from "@/lib/analytics/analyticsPersistence";
import type { AnalyticsPageData, AiRecommendation, TrendSignal } from "@/lib/analytics/analyticsTypes";

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
    </article>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles =
    priority === "high"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : priority === "low"
        ? "bg-slate-100 text-slate-600 ring-slate-200"
        : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {formatAnalyticsPriority(priority)}
    </span>
  );
}

function TrendBadge({ direction }: { direction: TrendSignal["direction"] }) {
  const styles =
    direction === "up"
      ? "bg-growth-50 text-growth-500 ring-emerald-100"
      : direction === "down"
        ? "bg-rose-50 text-rose-600 ring-rose-100"
        : "bg-slate-100 text-slate-600 ring-slate-200";

  const label = direction === "up" ? "Trending up" : direction === "down" ? "Trending down" : "Stable";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {label}
    </span>
  );
}

function RecommendationCard({ recommendation }: { recommendation: AiRecommendation }) {
  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={recommendation.priority} />
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
          {formatAnalyticsCategory(recommendation.category)}
        </span>
        <span className="text-[11px] font-medium text-text-muted">
          {Math.round(recommendation.confidence)}% confidence
        </span>
      </div>
      <h3 className="mt-3 font-semibold text-navy-900">{recommendation.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.description}</p>
      {recommendation.reason && (
        <p className="mt-2 text-xs leading-5 text-text-muted">{recommendation.reason}</p>
      )}
    </article>
  );
}

export function AnalyticsPage({ pageData }: { pageData: AnalyticsPageData | null }) {
  if (!pageData) {
    return (
      <DashboardEmptyState
        title="Sign in to view analytics intelligence"
        description="Analytics intelligence combines Google Business Profile insights, publishing history, and review performance into AI learning signals."
      />
    );
  }

  const { feedback, snapshots, recommendations, contentPerformance } = pageData;
  const latestSnapshot = feedback.latestSnapshot ?? snapshots[0] ?? null;
  const hasData = feedback.available || snapshots.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Analytics Intelligence
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Google Business Profile performance, publishing outcomes, and review signals transformed
            into AI learning feedback for your marketing planner, content generator, and command
            center. Existing Google Business Profile dashboards remain unchanged.
          </p>
        </div>
        <AnalyticsRefreshButton />
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Learning Summary
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
              {feedback.learningSummary}
            </p>
            {latestSnapshot && (
              <p className="mt-3 text-xs text-slate-400">
                Latest snapshot: {formatAnalyticsDate(latestSnapshot.snapshot_date)}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Opportunity Score
            </p>
            <p className="mt-2 text-4xl font-bold text-white">{feedback.opportunityScore}</p>
          </div>
        </div>
      </section>

      {!hasData && (
        <DashboardEmptyState
          title="Analytics intelligence is warming up"
          description="Connect Google Business Profile, sync live data, publish content, then refresh analytics intelligence."
          actionLabel="Open Google Business Profile"
          actionHref="/dashboard/google-business-profile"
        />
      )}

      {hasData && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Google Views"
              value={latestSnapshot ? latestSnapshot.google_views.toLocaleString() : "—"}
            />
            <MetricCard
              label="Engagement Score"
              value={latestSnapshot ? `${Math.round(latestSnapshot.engagement_score)}` : "—"}
            />
            <MetricCard
              label="Reviews"
              value={
                latestSnapshot
                  ? `${latestSnapshot.review_count}${latestSnapshot.average_rating ? ` · ${latestSnapshot.average_rating.toFixed(1)}★` : ""}`
                  : "—"
              }
            />
            <MetricCard
              label="Posts Published"
              value={latestSnapshot ? latestSnapshot.posts_published.toLocaleString() : "—"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Top Insights"
              subtitle="Highest-confidence signals from your latest analytics loop."
            >
              {feedback.topInsights.length > 0 ? (
                <ul className="space-y-3">
                  {feedback.topInsights.map((insight) => (
                    <li
                      key={insight}
                      className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200/60"
                    >
                      {insight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">Refresh analytics to generate insights.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Performance Trends"
              subtitle="Detected patterns across visibility, posting, reviews, and seasonality."
            >
              {feedback.performanceTrends.length > 0 ? (
                <div className="space-y-3">
                  {feedback.performanceTrends.map((trend) => (
                    <article
                      key={`${trend.type}-${trend.title}`}
                      className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <TrendBadge direction={trend.direction} />
                        <span className="text-[11px] font-medium text-text-muted">
                          {Math.round(trend.confidence)}% confidence
                        </span>
                      </div>
                      <h3 className="mt-3 font-semibold text-navy-900">{trend.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{trend.summary}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Trends appear after multiple snapshots are captured.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="AI Recommendations"
            subtitle="Structured guidance stored for planner, content, and command center prompts."
          >
            {recommendations.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {recommendations.map((recommendation) => (
                  <RecommendationCard key={recommendation.id} recommendation={recommendation} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                No active recommendations yet. Refresh analytics after your next Google sync or
                publish cycle.
              </p>
            )}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="Content Winners"
              subtitle="Published content with the strongest estimated performance."
            >
              {feedback.contentWinners.length > 0 ? (
                <div className="space-y-3">
                  {feedback.contentWinners.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 ring-1 ring-emerald-100"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-navy-900">
                          {String(item.metadata.title ?? "Published content")}
                        </h3>
                        <span className="text-sm font-bold text-growth-500">
                          {Math.round(item.performance_score)} score
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {item.views.toLocaleString()} views · {item.clicks.toLocaleString()} clicks
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Publish verified Google content to populate winner analysis.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Content Underperformers"
              subtitle="Published content that may need stronger hooks, offers, or timing."
            >
              {feedback.contentUnderperformers.length > 0 ? (
                <div className="space-y-3">
                  {feedback.contentUnderperformers.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 ring-1 ring-amber-100"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-navy-900">
                          {String(item.metadata.title ?? "Published content")}
                        </h3>
                        <span className="text-sm font-bold text-amber-700">
                          {Math.round(item.performance_score)} score
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Consider revising topic, CTA, or posting time for this theme.
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Underperformer detection activates once enough content performance records exist.
                </p>
              )}
            </SectionCard>
          </div>

          {contentPerformance.length > 0 && (
            <SectionCard
              title="Recent Content Performance"
              subtitle="Estimated per-post performance allocated from aggregate Google Business Profile signals."
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2 font-semibold">Content</th>
                      <th className="px-3 py-2 font-semibold">Provider</th>
                      <th className="px-3 py-2 font-semibold">Score</th>
                      <th className="px-3 py-2 font-semibold">Views</th>
                      <th className="px-3 py-2 font-semibold">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentPerformance.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50">
                        <td className="px-3 py-3 font-medium text-navy-900">
                          {String(item.metadata.title ?? "Published content")}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{item.provider.replace(/_/g, " ")}</td>
                        <td className="px-3 py-3 text-slate-600">{Math.round(item.performance_score)}</td>
                        <td className="px-3 py-3 text-slate-600">{item.views.toLocaleString()}</td>
                        <td className="px-3 py-3 text-slate-600">{item.clicks.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          <p className="text-sm text-text-muted">
            Need raw Google metrics and review management? Continue using{" "}
            <Link href="/dashboard/google-business-profile" className="font-semibold text-brand-600">
              Google Business Profile
            </Link>{" "}
            and{" "}
            <Link href="/dashboard/publishing" className="font-semibold text-brand-600">
              Publishing
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
