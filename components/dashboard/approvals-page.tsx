import Link from "next/link";

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

function ApprovalCalendar() {
  const days = [
    {
      label: "Monday",
      date: "Jun 16",
      blocks: [
        { title: "GBP: Spring maintenance", tone: "blue" as const },
        { title: "Review reply batch", tone: "green" as const },
      ],
    },
    {
      label: "Tuesday",
      date: "Jun 17",
      blocks: [{ title: "Facebook: Customer story", tone: "blue" as const }],
    },
    {
      label: "Wednesday",
      date: "Jun 18",
      blocks: [
        { title: "Blog: Water heater tips", tone: "amber" as const },
        { title: "LinkedIn update", tone: "blue" as const },
      ],
    },
    {
      label: "Thursday",
      date: "Jun 19",
      blocks: [{ title: "Email: Weekly promo", tone: "green" as const }],
    },
    {
      label: "Friday",
      date: "Jun 20",
      blocks: [
        { title: "GBP: Emergency services", tone: "amber" as const },
        { title: "Review replies (3)", tone: "blue" as const },
      ],
    },
  ];

  const toneStyles = {
    blue: "border-l-brand-600 bg-brand-50 text-brand-700",
    green: "border-l-growth-500 bg-growth-50 text-growth-600",
    amber: "border-l-amber-500 bg-amber-50 text-amber-700",
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-navy-900">Week of June 16, 2026</p>
        <div className="flex flex-wrap gap-3 text-xs font-medium text-text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            Scheduled
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-growth-500" />
            Published
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Awaiting Approval
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {days.map((day) => (
          <div
            key={day.label}
            className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-3 ring-1 ring-slate-200/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{day.label}</p>
            <p className="mt-0.5 text-sm font-bold text-navy-900">{day.date}</p>
            <div className="mt-3 space-y-2">
              {day.blocks.map((block) => (
                <div
                  key={block.title}
                  className={`rounded-lg border-l-4 px-2.5 py-2 text-xs font-medium ${toneStyles[block.tone]}`}
                >
                  {block.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
      label: "Automatically Published",
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

export function ApprovalsPage() {
  const queueItems = [
    {
      type: "Google Business Profile Post",
      title: "Spring Plumbing Maintenance Reminder",
      preview:
        "Keep your home running smoothly this season. Schedule a spring check-up and avoid costly surprises.",
      priority: "High" as const,
      publishDate: "Jun 18, 2026",
      status: "Awaiting Approval" as const,
    },
    {
      type: "Review Reply",
      title: "Reply to 5-star review from Sarah M.",
      preview:
        "Thank you, Sarah! We're glad our team could resolve your water heater issue quickly. We appreciate your trust.",
      priority: "High" as const,
      publishDate: "Today",
      status: "Ready to Publish" as const,
    },
    {
      type: "Facebook Post",
      title: "Before & After: Kitchen Repipe",
      preview:
        "See the difference a professional repipe makes. Cleaner water pressure and peace of mind for this Danville family.",
      priority: "Medium" as const,
      publishDate: "Jun 19, 2026",
      status: "Awaiting Approval" as const,
    },
    {
      type: "LinkedIn Post",
      title: "Why Local Businesses Win on Google",
      preview:
        "Local visibility isn't luck — it's consistency. Here's how Riverside Plumbing stays top-of-mind in the community.",
      priority: "Low" as const,
      publishDate: "Jun 20, 2026",
      status: "Scheduled" as const,
    },
    {
      type: "Blog Article",
      title: "5 Signs Your Water Heater Needs Replacement",
      preview:
        "Rusty water, inconsistent temperature, and rising energy bills can all signal it's time for an upgrade.",
      priority: "Medium" as const,
      publishDate: "Jun 21, 2026",
      status: "AI Draft" as const,
    },
    {
      type: "Email Campaign",
      title: "Weekly Customer Update — June Edition",
      preview:
        "Your neighborhood plumbing team is ready for summer. Emergency service, maintenance plans, and new availability.",
      priority: "Medium" as const,
      publishDate: "Jun 22, 2026",
      status: "Awaiting Approval" as const,
    },
  ];

  const aiPriorities = [
    {
      title: "Respond to 3 new reviews today",
      priority: "High" as const,
      impact: "Protects reputation",
      action: "Review Now",
    },
    {
      title: "Publish seasonal plumbing tips",
      priority: "High" as const,
      impact: "Boosts local visibility",
      action: "Approve Post",
    },
    {
      title: "Update Google Business Profile photos",
      priority: "Medium" as const,
      impact: "Improves click-through rate",
      action: "View Photos",
    },
    {
      title: "Share customer testimonial",
      priority: "Medium" as const,
      impact: "Builds trust",
      action: "Preview",
    },
    {
      title: "Promote emergency service",
      priority: "Low" as const,
      impact: "Captures urgent demand",
      action: "Approve",
    },
  ];

  const recentActivity = [
    { text: "AI generated Google Post", tone: "blue" as const, time: "2 hours ago" },
    { text: "Customer approved Review Reply", tone: "green" as const, time: "4 hours ago" },
    { text: "Blog scheduled for Wednesday", tone: "blue" as const, time: "Yesterday" },
    { text: "Google Business Profile updated", tone: "green" as const, time: "Yesterday" },
    { text: "Weekly report sent", tone: "amber" as const, time: "2 days ago" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Approval Center
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Review and approve everything AJN AI has prepared for your business.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/approvals/delivery"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Preview Email/SMS Delivery
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            Approve All
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Awaiting Approval"
          value="6"
          helper="+2 since yesterday"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Ready to Publish"
          value="3"
          helper="One-click approve"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Scheduled"
          value="8"
          helper="Next 7 days"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Z" />
            </svg>
          }
        />
        <KpiCard
          label="AI Drafts"
          value="5"
          helper="In progress"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
            </svg>
          }
        />
        <KpiCard
          label="Completed This Week"
          value="18"
          helper="+4 vs last week"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M8 17v-5M12 17V8M16 17v-3" />
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
            <BulkActionBar />
            <div className="mt-4 space-y-4">
              {queueItems.map((item) => (
                <article
                  key={item.title}
                  className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <label className="mt-1 inline-flex shrink-0 cursor-pointer items-center">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ContentTypeBadge type={item.type} />
                        <PriorityBadge priority={item.priority} />
                        <StatusBadge status={item.status} />
                      </div>
                      <h3 className="mt-3 font-semibold text-navy-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.preview}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Est. publish: {item.publishDate}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="AI Priorities" subtitle="What needs attention first">
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
        </SectionCard>
      </div>

      <SectionCard title="Approval Calendar" subtitle="Scheduled content for this week">
        <ApprovalCalendar />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Recent Activity" subtitle="Latest actions across your account">
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
        </SectionCard>

        <SectionCard title="How It Works" subtitle="From AI draft to published — automatically">
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
                Hi Mike,
              </p>
              <p className="text-sm leading-7 text-slate-600">
                Your AI marketing team has prepared 6 items for Riverside Plumbing Co. Review and
                approve everything in one click — or approve each item individually.
              </p>
              <div className="rounded-lg border border-slate-100 bg-[#F8FAFC] p-3 text-sm text-slate-600">
                <p className="font-semibold text-navy-900">This week&apos;s queue</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Google Business Profile post</li>
                  <li>• 3 review replies</li>
                  <li>• Facebook before-and-after post</li>
                  <li>• Blog article draft</li>
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                >
                  Approve All
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  Approve Individually
                </button>
                <button
                  type="button"
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  View Dashboard
                </button>
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
