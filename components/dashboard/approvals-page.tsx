import Link from "next/link";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import {
  CONTENT_WORKFLOW_STEPS,
  OrientationNote,
  PageHeader,
  WorkflowTrail,
} from "@/components/dashboard/ui/page-chrome";
import type { ContentApproval, ContentApprovalStats } from "@/lib/content-approval/types";
import type { ClientRecommendationDecisionPackage } from "@/lib/recommendation-presentation/types";

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: string;
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
        {action && (
          <button
            type="button"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {action}
          </button>
        )}
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

function ContentTypeBadge({ type }: { type: string }) {
  return (
    <span className="rounded-full bg-[#081426]/5 px-2.5 py-1 text-[11px] font-semibold text-navy-900 ring-1 ring-slate-200">
      {type}
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

function BulkActionBar() {
  return (
    <div className="sticky top-0 z-10 rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] backdrop-blur-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-navy-900">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Select All
          </label>
          <button
            type="button"
            className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Approve Selected
          </button>
          <button
            type="button"
            className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
          >
            Reject Selected
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Schedule
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filter
          </button>
          <div className="relative min-w-[200px] flex-1 lg:min-w-[240px]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
            </svg>
            <input
              type="search"
              placeholder="Search queue..."
              className="w-full rounded-full border border-slate-200 bg-[#F8FAFC] py-2 pl-9 pr-4 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </div>
    </div>
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
    pending: "Awaiting approval",
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

  const aiPriorities = pendingItems.slice(0, 5).map((item) => ({
    title: item.title,
    priority: "Medium" as const,
    impact: "Moves approved content toward publishing",
    action: "Review",
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
          <WorkflowTrail
            steps={CONTENT_WORKFLOW_STEPS.map((step) =>
              step.href === "/dashboard/approvals" ? { ...step, current: true } : step,
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Pending Approvals"
          value={String(stats.pending)}
          helper="Needs review"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Approved This Month"
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
          helper="Needs revision"
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
            title="Approval Queue"
            subtitle="Everything waiting for your review — approve in one click"
            action="View history"
          >
            <ApprovalQueue
              initialApprovals={approvals}
              recommendationPackagesByApprovalId={recommendationPackagesByApprovalId ?? {}}
              initialFilter={initialFilter === "all" ? "all" : initialFilter}
              focusApprovalId={focusApprovalId}
            />
          </SectionCard>
        </div>

        <SectionCard title="AI Priorities" subtitle="What needs attention first">
          {aiPriorities.length === 0 ? (
            <DashboardEmptyState
              title="No pending approvals"
              description="I'll prepare drafts when there's something worth your opinion."
              actionLabel="Generate content"
              actionHref="/dashboard/content/generator"
            />
          ) : (
            <div className="space-y-3">
              {aiPriorities.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-navy-900">{item.title}</h3>
                  <PriorityBadge priority={item.priority} />
                </div>
                <p className="mt-2 text-xs font-medium text-growth-600">{item.impact}</p>
                <button
                  type="button"
                  className="mt-3 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  {item.action}
                </button>
              </article>
            ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Approval Calendar" subtitle="Items in your approval queue">
        <ApprovalCalendar items={pendingItems.length > 0 ? pendingItems : approvals} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Recent Activity" subtitle="Latest actions across your account">
          {recentActivity.length === 0 ? (
            <DashboardEmptyState
              title="No approval activity yet"
              description="Activity will appear here once content is generated and reviewed."
              actionLabel="Open Content Generator"
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

        <SectionCard title="How It Works" subtitle="From AI draft to your review — then you approve before anything publishes">
          <WorkflowDiagram />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Email Approval Preview" subtitle="What customers receive each week">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">From</p>
              <p className="text-sm font-medium text-navy-900">AJN Marketing &lt;updates@ajnmarketing.com&gt;</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Subject</p>
              <p className="text-sm font-semibold text-navy-900">
                Your Weekly AJN Marketing Content is Ready
              </p>
            </div>
            <div className="space-y-4 px-4 py-5">
              <p className="text-sm leading-7 text-slate-600">
                Hi there,
              </p>
              <p className="text-sm leading-7 text-slate-600">
                Your AI marketing team has prepared {stats.pending} item
                {stats.pending === 1 ? "" : "s"} for review. Approve everything in one click — or
                approve each item individually in your dashboard.
              </p>
              <div className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-3 text-sm text-slate-600">
                <p className="font-semibold text-navy-900">This week&apos;s queue</p>
                {previewItems.length === 0 ? (
                  <p className="mt-2 text-sm text-text-muted">No items in queue yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {previewItems.map((item) => (
                      <li key={item.id}>• {item.title}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href="/dashboard/approvals?view=pending"
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  Review pending items
                </Link>
                <Link
                  href="/dashboard/approvals/delivery"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  Open delivery preview
                </Link>
                <Link
                  href="/dashboard/command-center"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  View dashboard
                </Link>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="SMS Approval Preview" subtitle="Quick approvals from your phone">
          <div className="mx-auto max-w-sm">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#F8FAFC] shadow-lg shadow-slate-300/40 ring-1 ring-slate-900/[0.04]">
              <div className="bg-[#081426] px-4 py-2 text-center">
                <p className="text-xs font-semibold text-white">Messages</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-sm text-white shadow-sm">
                  <p className="font-semibold">AJN Marketing</p>
                  <p className="mt-2 leading-6">
                    3 items ready for approval.
                  </p>
                  <p className="mt-3 leading-6">
                    Reply <span className="font-bold">YES</span> to approve all.
                  </p>
                  <p className="mt-1 leading-6">
                    Reply <span className="font-bold">VIEW</span> to review individually.
                  </p>
                  <p className="mt-3 text-[11px] text-brand-100">Just now</p>
                </div>
                <div className="max-w-[75%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  YES
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-sm text-white shadow-sm">
                  <p className="leading-6">
                    Approved! 3 items scheduled. View details in your dashboard anytime.
                  </p>
                  <p className="mt-2 text-[11px] text-brand-100">1 min ago</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
