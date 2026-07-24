import {
  formatMarketingPlanDate,
  formatMarketingPlanMonth,
  formatMarketingPlanStatus,
} from "@/lib/marketing-planner/persistence";
import type { MarketingPlanPageData } from "@/lib/marketing-planner/types";
import { MarketingPlanRefreshButton } from "@/components/dashboard/marketing-plan-actions";
import { MarketingPlanContent } from "@/components/dashboard/marketing-plan-content";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import {
  LastUpdatedIndicator,
  OrientationNote,
  PageHeader,
  ProcessingNotice,
  RecoveryNotice,
} from "@/components/dashboard/ui/page-chrome";

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
          <PageHeader
            eyebrow="Marketing foundation"
            title="This month's plan"
            description="Your monthly themes and focus, built from your marketing profile, website understanding, brand voice, and goals."
            actions={<MarketingPlanRefreshButton />}
          />
          <OrientationNote
            whyItMatters="The plan gives Head of Marketing a concrete month to work from."
            whatHappensNext="Use recommendations and This Week to turn plan themes into drafts you approve."
          />
        </div>
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
        <ProcessingNotice
          label="Your marketing plan is generating…"
          hint="This can take a short while. Refresh if it doesn’t update — your previous plan stays available if you had one."
        />
      )}

      {plan?.status === "failed" && (
        <RecoveryNotice
          title="Plan generation didn’t finish"
          whatHappened="I couldn’t complete the latest marketing plan."
          workSafe="Any earlier plan you already had remains available."
          whatYouCanDo="Click Refresh Plan to try again when you’re ready."
          whatYouCanIgnore="Approvals, publishing, and Head of Marketing still work."
        />
      )}

      {!plan && (
        <DashboardEmptyState
          kind="no_data_yet"
          title="No marketing plan yet"
          description={`Create your first Marketing Plan to see recommendations for ${monthName} ${currentYear}.`}
        />
      )}

      {planJson && activePlan && plan?.status !== "generating" && plan?.status !== "failed" && (
        <>
          <div
            role="status"
            className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 ring-1 ring-emerald-100 sm:p-5"
          >
            <p className="text-sm font-semibold text-navy-900">Marketing plan ready</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              What changed: monthly themes and focus are set. Where to find it: this page and Head of
              Marketing. What next: turn themes into drafts via recommendations — you still approve
              before publishing.
            </p>
            <LastUpdatedIndicator isoDate={plan?.updated_at} prefix="Last updated" />
          </div>
          <MarketingPlanContent
            planJson={planJson}
            currentMonth={currentMonth}
            currentYear={currentYear}
          />
        </>
      )}
    </div>
  );
}
