import Link from "next/link";
import { AnalyticsRefreshButton } from "@/components/dashboard/analytics-actions";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import {
  FULL_CUSTOMER_JOURNEY_STEPS,
  NextStepHint,
  OrientationNote,
  PageHeader,
  WorkflowTrail,
} from "@/components/dashboard/ui/page-chrome";
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
        <span className="text-[11px] font-medium text-text-muted">Worth a look</span>
      </div>
      <h3 className="mt-3 font-semibold text-navy-900">{recommendation.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.description}</p>
      {recommendation.reason && (
        <p className="mt-2 text-xs leading-5 text-text-muted">{recommendation.reason}</p>
      )}
    </article>
  );
}

export function AnalyticsPage({
  pageData,
  experience = "results",
}: {
  pageData: AnalyticsPageData | null;
  experience?: "results" | "analytics";
}) {
  if (!pageData) {
    return (
      <DashboardEmptyState
        title="Sign in to view your results"
        description="I'll show visibility, reviews, engagement, and progress once you're signed in."
      />
    );
  }

  const { feedback, snapshots, recommendations, contentPerformance } = pageData;
  const latestSnapshot = feedback.latestSnapshot ?? snapshots[0] ?? null;
  const hasData = feedback.available || snapshots.length > 0;
  const isResults = experience === "results";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <PageHeader
            eyebrow={isResults ? "Results" : "Progress"}
            title={isResults ? "Your marketing wins" : "What's improving"}
            description={
              isResults
                ? "Completed marketing, successful publications, and engagement progress — without the operational noise."
                : "Visibility, reviews, engagement, and progress over time — so you can see what’s working without digging through raw reports."
            }
            actions={<AnalyticsRefreshButton />}
          />
          <OrientationNote
            whyItMatters="This is where finished work becomes proof — wins, not pipeline events."
            whatHappensNext="Use insights here to guide the next recommendation or draft."
          />
          <WorkflowTrail
            ariaLabel="Full customer journey"
            steps={FULL_CUSTOMER_JOURNEY_STEPS.map((step) =>
              step.href === "/dashboard/results" ? { ...step, current: true } : step,
            )}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Customer progress
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
              {feedback.learningSummary}
            </p>
            {latestSnapshot && (
              <p className="mt-3 text-xs text-slate-400">
                Updated {formatAnalyticsDate(latestSnapshot.snapshot_date)}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Opportunity ahead
            </p>
            <p className="mt-2 text-4xl font-bold text-white">{feedback.opportunityScore}</p>
          </div>
        </div>
      </section>

      {!hasData && (
        <DashboardEmptyState
          title="Results are warming up"
          description="Once Google is connected and we've published together, I'll highlight wins and progress here."
          actionLabel="Open Google Profile"
          actionHref="/dashboard/google-business-profile"
        />
      )}

      {hasData && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Visibility (views)"
              value={latestSnapshot ? latestSnapshot.google_views.toLocaleString() : "—"}
            />
            <MetricCard
              label="Engagement progress"
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
              label="Successful publications"
              value={latestSnapshot ? latestSnapshot.posts_published.toLocaleString() : "—"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="What stands out"
              subtitle="The clearest signals from how your marketing is performing."
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
                <p className="text-sm text-text-muted">
                  Refresh results after we&apos;ve published together and I&apos;ll share what stands
                  out.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="How things are trending"
              subtitle="Patterns across visibility, posts, reviews, and the season."
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
                      </div>
                      <h3 className="mt-3 font-semibold text-navy-900">{trend.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{trend.summary}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Trends become clearer after a few weeks of activity together.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="What I'd look at next"
            subtitle="Calm next steps based on what I'm seeing for your business."
          >
            {recommendations.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {recommendations.map((recommendation) => (
                  <RecommendationCard key={recommendation.id} recommendation={recommendation} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                Nothing urgent to recommend yet. I&apos;ll share ideas after your next Google sync or
                publish.
              </p>
            )}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Wins worth celebrating"
            subtitle="Completed marketing that is performing strongest."
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
                        <span className="rounded-full bg-growth-50 px-2.5 py-1 text-[11px] font-semibold text-growth-600 ring-1 ring-emerald-100">
                          Strong result
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
                  Once we&apos;ve published together, I&apos;ll highlight what&apos;s landing best.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="What we can improve"
              subtitle="Published updates that may need a stronger hook, offer, or timing."
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
                  I&apos;ll call out quieter posts once we have enough activity to be fair.
                </p>
              )}
            </SectionCard>
          </div>

          {contentPerformance.length > 0 && (
            <details className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
              <summary className="hom-focusable cursor-pointer list-none px-5 py-4 text-base font-bold tracking-tight text-navy-900 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  Recent post details
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Optional
                  </span>
                </span>
              </summary>
              <div className="hom-disclose-content border-t border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
                <p className="mb-4 text-sm text-text-muted">
                  A closer look at recent posts — useful when you want the numbers behind the story.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                        <th className="px-3 py-2 font-semibold">Content</th>
                        <th className="px-3 py-2 font-semibold">Channel</th>
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
                          <td className="px-3 py-3 text-slate-600">
                            {item.provider.replace(/_/g, " ")}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {Math.round(item.performance_score)}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{item.views.toLocaleString()}</td>
                          <td className="px-3 py-3 text-slate-600">{item.clicks.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}

          <NextStepHint
            finished="You’ve reviewed wins, completed publications, and engagement progress."
            next="Choose a recommendation or create the next draft to keep momentum going."
            href="/dashboard/marketing-recommendations"
            ctaLabel="See recommendations"
          />

          <p className="text-sm text-text-muted">
            Want Google reviews or profile details? Visit{" "}
            <Link
              href="/dashboard/google-business-profile"
              className="hom-focusable font-semibold text-brand-600"
            >
              Google Profile
            </Link>{" "}
            or{" "}
            <Link href="/dashboard/publishing" className="hom-focusable font-semibold text-brand-600">
              Preparing for publication
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
