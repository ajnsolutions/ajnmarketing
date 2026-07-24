import Link from "next/link";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import {
  AttentionBanner,
  CONTENT_WORKFLOW_STEPS,
  FULL_CUSTOMER_JOURNEY_STEPS,
  NextStepHint,
  OrientationNote,
  PageHeader,
  WorkflowTrail,
} from "@/components/dashboard/ui/page-chrome";
import { approvalAttentionSummary } from "@/lib/customer-ux/workflowPresentation";
import type { ContentApproval, ContentApprovalStats } from "@/lib/content-approval/types";
import type { ClientRecommendationDecisionPackage } from "@/lib/recommendation-presentation/types";

function SectionCard({
  title,
  subtitle,
  actionHref,
  actionLabel,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="hom-focusable text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function StatusBadge({
  status,
}: {
  status:
    | "Awaiting Approval"
    | "Ready to Publish"
    | "Scheduled"
    | "AI Draft"
    | "Published"
    | "Approved";
}) {
  const styles = {
    "Awaiting Approval": "bg-amber-50 text-amber-700 ring-amber-100",
    "Ready to Publish": "bg-brand-50 text-brand-600 ring-brand-100",
    Scheduled: "bg-brand-50 text-brand-600 ring-brand-100",
    "AI Draft": "bg-slate-100 text-slate-600 ring-slate-200",
    Published: "bg-growth-50 text-growth-500 ring-emerald-100",
    Approved: "bg-growth-50 text-growth-500 ring-emerald-100",
  }[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "bg-rose-50 text-rose-600 ring-rose-100",
    Medium: "bg-amber-50 text-amber-700 ring-amber-100",
    Low: "bg-slate-100 text-slate-600 ring-slate-200",
  }[priority];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {priority} Priority
    </span>
  );
}

function KpiCard({
  label,
  value,
  helper,
  trend,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  trend: "up" | "down" | "neutral";
  icon: React.ReactNode;
}) {
  const trendColor = {
    up: "text-growth-500",
    down: "text-rose-500",
    neutral: "text-slate-500",
  }[trend];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 ring-1 ring-brand-100">
          {icon}
        </div>
        <p className={`text-sm font-semibold ${trendColor}`}>
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {helper}
        </p>
      </div>
      <p className="mt-4 text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
    </article>
  );
}

function formatActivityTime(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function activityTone(status: ContentApproval["status"]): "blue" | "green" | "amber" {
  if (status === "approved" || status === "published") return "green";
  if (status === "pending") return "amber";
  return "blue";
}

function activityLabel(item: ContentApproval): string {
  const statusLabels: Record<ContentApproval["status"], string> = {
    pending: "Needs your opinion",
    approved: "Approved",
    rejected: "Rejected",
    published: "Published",
  };
  return `${item.title} — ${statusLabels[item.status]}`;
}

function ApprovalCalendar({ items }: { items: ContentApproval[] }) {
  if (items.length === 0) {
    return (
      <DashboardEmptyState
        title="No items scheduled this week"
        description="I'll bring drafts here when something needs your opinion."
        actionLabel="Generate content"
        actionHref="/dashboard/content/generator"
      />
    );
  }

  return (
    <ul className="space-y-3">
      {items.slice(0, 8).map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60"
        >
          <div>
            <p className="text-sm font-semibold text-navy-900">{item.title}</p>
            <p className="mt-1 text-xs text-text-muted">{item.content_type}</p>
          </div>
          <StatusBadge
            status={
              item.status === "pending"
                ? "Awaiting Approval"
                : item.status === "approved"
                  ? "Approved"
                  : item.status === "published"
                    ? "Published"
                    : "AI Draft"
            }
          />
        </li>
      ))}
    </ul>
  );
}

function WorkflowDiagram() {
  const steps = [
    {
      label: "AI Creates",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
        </svg>
      ),
    },
    {
      label: "Customer Reviews",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v16H7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8h5M9.5 12h5M9.5 16h3.5" />
        </svg>
      ),
    },
    {
      label: "Approve",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: "Ready to Publish",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0-4 4m4-4 4 4M5 19h14" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      {steps.map((step, index) => (
        <div key={step.label} className="flex flex-1 items-center gap-3">
          <div className="flex flex-1 flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              {step.icon}
            </div>
            <p className="mt-2 text-xs font-semibold text-navy-900 sm:text-sm">{step.label}</p>
          </div>
          {index < steps.length - 1 && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="hidden h-5 w-5 shrink-0 text-slate-300 sm:block"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

export function ApprovalsPage({
  approvals,
  stats,
  recommendationPackagesByApprovalId,
  initialFilter = "all",
  focusApprovalId = null,
}: {
  approvals: ContentApproval[];
  stats: ContentApprovalStats;
  recommendationPackagesByApprovalId?: Record<string, ClientRecommendationDecisionPackage>;
  initialFilter?: "all" | ContentApproval["status"];
  focusApprovalId?: string | null;
}) {
  const pendingItems = approvals.filter((item) => item.status === "pending");

  const attention = approvalAttentionSummary(stats.pending);
  const aiPriorities = pendingItems.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    priority: (item.ai_score != null && item.ai_score >= 80
      ? "High"
      : item.ai_score != null && item.ai_score < 50
        ? "Low"
        : "Medium") as "High" | "Medium" | "Low",
    impact:
      item.ai_score != null
        ? `Confidence signal: ${item.ai_score}/100 — review when it feels right`
        : "Worth a calm look before anything goes live",
  }));

  const recentActivity = [...approvals]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)
    .map((item) => ({
      text: activityLabel(item),
      tone: activityTone(item.status),
      time: formatActivityTime(item.updated_at),
    }));

  const previewItems =
    pendingItems.length > 0
      ? pendingItems.slice(0, 4)
      : approvals.slice(0, 4);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <PageHeader
            eyebrow="Approvals"
            title="This Week"
            description="Here's what I'd like your opinion on. Approving means the draft is ready — publishing still happens as a separate step."
            actions={
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Link
                  href="/dashboard/approvals?view=pending"
                  className="hom-focusable inline-flex min-h-11 items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-colors hover:bg-[#0B1426]"
                >
                  Review This Week
                </Link>
                <Link
                  href="/dashboard/approvals/delivery"
                  className="hom-focusable text-sm font-medium text-text-muted transition-colors hover:text-brand-700"
                >
                  Preview email delivery
                </Link>
              </div>
            }
          />
          <OrientationNote
            whyItMatters="This is your control point. Nothing goes live until you approve it."
            whatHappensNext="Approved items move toward publishing. Rejected items stay out of the queue."
          />
          <AttentionBanner
            headline={attention.headline}
            detail={attention.detail}
            href={attention.href}
            ctaLabel={attention.ctaLabel}
            tone={stats.pending > 0 ? "warning" : "success"}
          />
          <WorkflowTrail
            steps={CONTENT_WORKFLOW_STEPS.map((step) =>
              step.href === "/dashboard/approvals" ? { ...step, current: true } : step,
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Needs you today"
          value={String(stats.pending)}
          helper="Waiting for your opinion"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Approved this month"
          value={String(stats.approvedThisMonth)}
          helper="Ready for publishing"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Rejected"
          value={String(stats.rejected)}
          helper="Kept out of publishing"
          trend="down"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard
            title="What needs your attention"
            subtitle="Scan, approve, edit, or reject — bulk approve is available when several items are waiting"
            actionHref="/dashboard/approvals?view=approved"
            actionLabel="View approved history"
          >
            <ApprovalQueue
              initialApprovals={approvals}
              recommendationPackagesByApprovalId={recommendationPackagesByApprovalId ?? {}}
              initialFilter={initialFilter === "all" ? "all" : initialFilter}
              focusApprovalId={focusApprovalId}
            />
          </SectionCard>
        </div>

        <SectionCard title="Start here" subtitle="Highest-visibility items first">
          {aiPriorities.length === 0 ? (
            <DashboardEmptyState
              title="You’re caught up"
              description="I'll prepare drafts when there's something worth your opinion."
              actionLabel="Create something new"
              actionHref="/dashboard/content/generator"
            />
          ) : (
            <div className="space-y-3">
              {aiPriorities.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-navy-900">{item.title}</h3>
                  <PriorityBadge priority={item.priority} />
                </div>
                <p className="mt-2 text-xs font-medium text-growth-600">{item.impact}</p>
                <Link
                  href={`/dashboard/approvals?view=pending#approval-${item.id}`}
                  className="hom-focusable mt-3 inline-flex min-h-11 items-center rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  Review
                </Link>
              </article>
            ))}
            </div>
          )}
        </SectionCard>
      </div>

      <NextStepHint
        finished={
          stats.pending > 0
            ? "You’re reviewing drafts that need your opinion."
            : "You’re caught up on approvals for now."
        }
        next="After you approve, open Publishing to send work live. Results will show what’s improving."
        href="/dashboard/publishing"
        ctaLabel="Go to publishing"
      />

      <WorkflowTrail
        ariaLabel="Full customer journey"
        steps={FULL_CUSTOMER_JOURNEY_STEPS.map((step) =>
          step.href === "/dashboard/approvals" ? { ...step, current: true } : step,
        )}
      />

      <details className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
        <summary className="hom-focusable cursor-pointer list-none px-5 py-4 text-base font-bold tracking-tight text-navy-900 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-h-11 items-center gap-2">
            Approval history &amp; helpers
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              Optional
            </span>
          </span>
        </summary>
        <div className="hom-disclose-content space-y-6 border-t border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <SectionCard title="Approval calendar" subtitle="Items currently in your review queue">
            <ApprovalCalendar items={pendingItems.length > 0 ? pendingItems : approvals} />
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Recent decisions" subtitle="Your latest approve / reject history">
              {recentActivity.length === 0 ? (
                <DashboardEmptyState
                  title="No approval history yet"
                  description="Decisions will appear here once you’ve reviewed a few drafts."
                  actionLabel="Create something new"
                  actionHref="/dashboard/content/generator"
                />
              ) : (
                <ol className="relative space-y-0">
                  {recentActivity.map((item, index) => (
                    <li key={item.text} className="relative flex gap-4 pb-6 last:pb-0">
                      {index < recentActivity.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-slate-200"
                        />
                      )}
                      <span
                        className={`relative mt-1.5 flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white ring-2 ${
                          item.tone === "green"
                            ? "bg-growth-500 ring-emerald-100"
                            : item.tone === "amber"
                              ? "bg-amber-500 ring-amber-100"
                              : "bg-brand-600 ring-brand-100"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-navy-900">{item.text}</p>
                        <p className="mt-1 text-xs text-text-muted">{item.time}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>

            <SectionCard
              title="How it works"
              subtitle="From draft to your review — then you approve before anything publishes"
            >
              <WorkflowDiagram />
            </SectionCard>
          </div>

          <SectionCard
            title="Email approval preview"
            subtitle="Optional — what the weekly review email can look like"
            actionHref="/dashboard/approvals/delivery"
            actionLabel="Open delivery preview"
          >
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Subject</p>
                <p className="text-sm font-semibold text-navy-900">
                  Your weekly AJN Marketing content is ready
                </p>
              </div>
              <div className="space-y-3 px-4 py-5 text-sm leading-7 text-slate-600">
                <p>
                  Your marketing team has prepared {stats.pending} item
                  {stats.pending === 1 ? "" : "s"} for review. Approve everything in one click — or
                  review each item here in the dashboard.
                </p>
                {previewItems.length > 0 ? (
                  <ul className="space-y-1">
                    {previewItems.map((item) => (
                      <li key={item.id}>• {item.title}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted">No items in queue yet.</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </details>
    </div>
  );
}
