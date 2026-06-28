import {
  formatMarketingPlanDate,
  formatMarketingPlanMonth,
  formatMarketingPlanStatus,
} from "@/lib/marketing-planner/persistence";
import type { MarketingPlanJson, MarketingPlanPageData } from "@/lib/marketing-planner/types";
import { MarketingPlanRefreshButton } from "@/components/dashboard/marketing-plan-actions";

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

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Active"
      ? "bg-growth-50 text-growth-500 ring-emerald-100"
      : status === "Generating"
        ? "bg-brand-50 text-brand-600 ring-brand-100"
        : status === "Failed"
          ? "bg-rose-50 text-rose-600 ring-rose-100"
          : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {status}
    </span>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Not available yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-100"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function PlanContent({ planJson }: { planJson: MarketingPlanJson }) {
  return (
    <div className="space-y-8">
      <SectionCard title="Executive Summary" subtitle="Your monthly marketing direction">
        <p className="text-sm leading-7 text-slate-600">{planJson.executiveSummary}</p>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Business Goals" subtitle="What this month should accomplish">
          <ChipList items={planJson.businessGoals} />
        </SectionCard>

        <SectionCard title="Marketing Themes" subtitle="Core messages for the month">
          <ChipList items={planJson.marketingThemes} />
        </SectionCard>
      </div>

      <SectionCard title="Weekly Breakdown" subtitle="Focus and actions by week">
        <div className="grid gap-4 lg:grid-cols-2">
          {planJson.weeklyFocus.map((week) => (
            <article
              key={`week-${week.week}-${week.title}`}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                Week {week.week}
              </p>
              <h3 className="mt-2 font-semibold text-navy-900">{week.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{week.focus}</p>
              {week.actions.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {week.actions.map((action) => (
                    <li key={action} className="flex gap-2 text-sm text-navy-900">
                      <span className="text-growth-500">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="30-Day Calendar" subtitle="Suggested daily marketing activity">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {planJson.thirtyDayCalendar.map((day) => (
            <article
              key={`day-${day.day}-${day.title}`}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Day {day.day}
                </p>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                  {day.channel}
                </span>
              </div>
              <h3 className="mt-2 font-semibold text-navy-900">{day.title}</h3>
              <p className="mt-1 text-xs font-medium text-brand-600">{day.contentType}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{day.note}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Suggested Campaigns" subtitle="Seasonal campaigns and promotions">
        <div className="grid gap-4 lg:grid-cols-2">
          {planJson.seasonalCampaigns.map((campaign) => (
            <article
              key={campaign.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                {campaign.timing}
              </p>
              <h3 className="mt-2 font-semibold text-navy-900">{campaign.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{campaign.description}</p>
            </article>
          ))}
          {planJson.suggestedPromotions.map((promotion) => (
            <article
              key={promotion.title}
              className="rounded-xl border border-amber-100 bg-amber-50/40 p-5 ring-1 ring-amber-100"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Promotion · {promotion.channel}
              </p>
              <h3 className="mt-2 font-semibold text-navy-900">{promotion.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{promotion.offer}</p>
              <p className="mt-2 text-xs font-semibold text-text-muted">Goal: {promotion.goal}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Blog Ideas" subtitle="Educational and authority-building topics">
          <div className="space-y-4">
            {planJson.blogRecommendations.map((blog) => (
              <article
                key={blog.title}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <h3 className="font-semibold text-navy-900">{blog.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{blog.angle}</p>
                {blog.keywords.length > 0 && (
                  <p className="mt-3 text-xs text-text-muted">Keywords: {blog.keywords.join(", ")}</p>
                )}
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Email Ideas" subtitle="Campaign concepts for your audience">
          <div className="space-y-4">
            {planJson.emailCampaignIdeas.map((email) => (
              <article
                key={email.title}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <h3 className="font-semibold text-navy-900">{email.title}</h3>
                <p className="mt-2 text-sm text-text-muted">Audience: {email.audience}</p>
                <p className="mt-1 text-sm text-text-muted">Goal: {email.goal}</p>
                <p className="mt-3 text-sm font-semibold text-brand-700">
                  Subject: {email.subjectLine}
                </p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Video Ideas" subtitle="Short-form and educational video concepts">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {planJson.videoIdeas.map((video) => (
            <article
              key={video.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                {video.format}
              </p>
              <h3 className="mt-2 font-semibold text-navy-900">{video.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{video.hook}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Social Platform Recommendations" subtitle="Where to focus this month">
          <div className="space-y-4">
            {planJson.socialPlatformRecommendations.map((platform) => (
              <article
                key={platform.platform}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{platform.platform}</h3>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                    {platform.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{platform.rationale}</p>
                {platform.contentFocus.length > 0 && (
                  <p className="mt-3 text-xs text-text-muted">
                    Focus: {platform.contentFocus.join(", ")}
                  </p>
                )}
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="KPIs to Monitor" subtitle="Metrics that matter this month">
          <div className="space-y-4">
            {planJson.kpisToMonitor.map((kpi) => (
              <article
                key={kpi.metric}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <h3 className="font-semibold text-navy-900">{kpi.metric}</h3>
                <p className="mt-1 text-sm font-semibold text-brand-700">Target: {kpi.target}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{kpi.why}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Recommended Posting Schedule" subtitle="Platform cadence and timing">
          <div className="space-y-4">
            {planJson.recommendedPostingSchedule.map((item) => (
              <article
                key={item.platform}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <h3 className="font-semibold text-navy-900">{item.platform}</h3>
                <p className="mt-1 text-sm font-semibold text-brand-700">{item.cadence}</p>
                {item.bestTimes.length > 0 && (
                  <p className="mt-2 text-sm text-text-muted">Best times: {item.bestTimes.join(", ")}</p>
                )}
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.notes}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Google Business Profile Posting Cadence"
          subtitle="Local visibility posting rhythm"
        >
          <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
            <p className="text-sm font-semibold text-brand-700">
              {planJson.googleBusinessProfilePostingCadence.cadence}
            </p>
            {planJson.googleBusinessProfilePostingCadence.postTypes.length > 0 && (
              <div className="mt-4">
                <ChipList items={planJson.googleBusinessProfilePostingCadence.postTypes} />
              </div>
            )}
            <p className="mt-4 text-sm leading-7 text-slate-600">
              {planJson.googleBusinessProfilePostingCadence.notes}
            </p>
          </article>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-navy-900">Content Mix</h3>
            <div className="mt-3 space-y-3">
              {planJson.contentMix.map((item) => (
                <div
                  key={item.type}
                  className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-navy-900">{item.type}</p>
                    <span className="text-sm font-semibold text-brand-600">{item.percentage}%</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function MarketingPlanPage({
  plan,
  currentMonth,
  currentYear,
  monthName,
}: MarketingPlanPageData) {
  const activePlan = plan?.status === "active" ? plan : null;
  const planJson = activePlan?.plan_json ?? null;
  const statusLabel = plan ? formatMarketingPlanStatus(plan.status) : "Not Generated";
  const periodLabel = formatMarketingPlanMonth(currentMonth, currentYear);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Marketing Plan
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            AI-generated monthly strategy built from your AI Marketing Profile, website analysis,
            brand voice, and business goals.
          </p>
        </div>
        <MarketingPlanRefreshButton />
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Plan Status
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">{periodLabel}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {plan
                ? `Last updated ${formatMarketingPlanDate(plan.updated_at)}`
                : "Generate your first monthly plan to see what AJN recommends this month."}
            </p>
          </div>
          <StatusBadge status={statusLabel} />
        </div>
      </section>

      {plan?.status === "generating" && (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          Your marketing plan is generating. Refresh this page in a moment if it does not update
          automatically.
        </p>
      )}

      {plan?.status === "failed" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          The last plan generation failed. Click Refresh Plan to try again.
        </p>
      )}

      {!plan && (
        <SectionCard
          title="No Plan Yet"
          subtitle={`Create your ${monthName} ${currentYear} marketing strategy`}
        >
          <p className="text-sm leading-7 text-slate-600">
            AJN will analyze your business profile, website analysis, AI Marketing Profile, brand
            voice, services, keywords, and content opportunities to build a structured monthly plan.
          </p>
        </SectionCard>
      )}

      {planJson && activePlan && <PlanContent planJson={planJson} />}
    </div>
  );
}
