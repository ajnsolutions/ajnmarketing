import {
  formatMarketingPlanDate,
  formatMarketingPlanMonth,
  formatMarketingPlanStatus,
} from "@/lib/marketing-planner/persistence";
import type { MarketingPlanPageData } from "@/lib/marketing-planner/types";
import { MarketingPlanRefreshButton } from "@/components/dashboard/marketing-plan-actions";
import { MarketingPlanContent } from "@/components/dashboard/marketing-plan-content";

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
            brand voice, and business goals. Turn recommendations into approval-ready content.
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

      {planJson && activePlan && (
        <MarketingPlanContent
          planJson={planJson}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      )}
    </div>
  );
}
