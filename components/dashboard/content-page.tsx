import Link from "next/link";
import { PublishingQueuePanel } from "@/components/dashboard/publishing-queue-panel";
import { DashboardEmptyState } from "@/components/dashboard/ui/dashboard-states";
import type { ContentApproval, ContentApprovalStats } from "@/lib/content-approval/types";
import type { PublishingQueueItem, PublishingQueueStats } from "@/lib/publishing-queue/types";

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
  status: "Ready for Review" | "Approved" | "Scheduled" | "Published" | "Awaiting Approval";
}) {
  const styles = {
    "Ready for Review": "bg-amber-50 text-amber-700 ring-amber-100",
    "Awaiting Approval": "bg-amber-50 text-amber-700 ring-amber-100",
    Approved: "bg-growth-50 text-growth-500 ring-emerald-100",
    Scheduled: "bg-brand-50 text-brand-600 ring-brand-100",
    Published: "bg-slate-100 text-slate-700 ring-slate-200",
  }[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {status}
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

export function ContentPage({
  publishingItems,
  publishingStats,
  approvalStats,
  pendingApprovals,
  experience = "library",
}: {
  publishingItems: PublishingQueueItem[];
  publishingStats: PublishingQueueStats;
  approvalStats: ContentApprovalStats;
  pendingApprovals: ContentApproval[];
  experience?: "library" | "content";
}) {
  const scheduledItems = publishingItems.filter((item) => item.status === "scheduled");
  const isLibrary = experience === "library";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
            {isLibrary ? "Everything we've created together" : "Library"}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Library
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Content, posts, and assets we&apos;ve prepared for your business — ready for review or
            already on their way out.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Link
            href="/dashboard/content/generator"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            Create something new
          </Link>
          <Link
            href="/dashboard/approvals"
            className="text-sm font-medium text-text-muted transition-colors hover:text-brand-700"
          >
            Review This Week
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Awaiting Approval"
          value={String(approvalStats.pending)}
          helper="Needs review"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Ready to Publish"
          value={String(publishingStats.ready)}
          helper="Approved content"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v16H7z" />
            </svg>
          }
        />
        <KpiCard
          label="Scheduled"
          value={String(publishingStats.scheduled)}
          helper="Publishing queue"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Z" />
            </svg>
          }
        />
        <KpiCard
          label="Published"
          value={String(publishingStats.published)}
          helper="Completed posts"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Pending Approvals"
          subtitle="Content waiting for review before publishing"
          action="View all"
          className="xl:col-span-2"
        >
          {pendingApprovals.length === 0 ? (
            <DashboardEmptyState
              title="No content awaiting approval"
              description="Create something new and I'll bring it here for your opinion before anything goes live."
              actionLabel="Create something new"
              actionHref="/dashboard/content/generator"
            />
          ) : (
            <div className="space-y-4">
              {pendingApprovals.slice(0, 6).map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-semibold text-navy-900">{item.title}</h3>
                    <StatusBadge status="Awaiting Approval" />
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{item.content}</p>
                  <Link
                    href="/dashboard/approvals"
                    className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Review This Week →
                  </Link>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="How we work together" subtitle="A simple rhythm">
          <div className="space-y-3 text-sm leading-7 text-slate-600">
            <p>1. I prepare drafts for your business.</p>
            <p>2. You review what needs your opinion this week.</p>
            <p>3. I prepare approved work for publication.</p>
            <p>4. You enjoy the results.</p>
          </div>
          <Link
            href="/dashboard/content/generator"
            className="mt-4 inline-flex rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Create something new
          </Link>
        </SectionCard>
      </div>

      <SectionCard
        title="Preparing for publication"
        subtitle="Ready, scheduled, published, and anything that needs a second look"
      >
        <div className="mb-4 flex justify-end">
          <Link
            href="/dashboard/publishing"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            Open preparation list →
          </Link>
        </div>
        <PublishingQueuePanel
          initialItems={publishingItems}
          initialStats={publishingStats}
          compact
          showFilters={false}
        />
      </SectionCard>

      <SectionCard title="Scheduled Content" subtitle="Upcoming publishing queue items">
        {scheduledItems.length === 0 ? (
          <DashboardEmptyState
            title="No scheduled content yet"
            description="Approve this week's items and I'll prepare them for publication."
            actionLabel="Preparing for publication"
            actionHref="/dashboard/publishing"
          />
        ) : (
          <ol className="relative space-y-0">
            {scheduledItems.slice(0, 8).map((post, index) => (
              <li key={post.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < Math.min(scheduledItems.length, 8) - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-slate-200"
                  />
                )}
                <span className="relative mt-1.5 flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {post.scheduled_for
                      ? new Date(post.scheduled_for).toLocaleString()
                      : "Scheduled"}
                  </p>
                  <p className="mt-1 font-semibold text-navy-900">{post.title}</p>
                  <p className="mt-1 text-sm text-text-muted">{post.platform.replace(/_/g, " ")}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}
