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

function SummaryCard({
  label,
  value,
  helper,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone?: "blue" | "amber" | "green" | "slate";
}) {
  const iconBg = {
    blue: "bg-brand-50 text-brand-600 ring-brand-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    green: "bg-growth-50 text-growth-500 ring-emerald-100",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
  }[tone];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className={`inline-flex rounded-xl p-2.5 ring-1 ${iconBg}`}>{icon}</div>
      <p className="mt-4 text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </article>
  );
}

function NotificationBadge({ status }: { status: "Unread" | "Read" | "Action Needed" }) {
  const styles = {
    Unread: "bg-brand-50 text-brand-600 ring-brand-100",
    Read: "bg-slate-100 text-slate-600 ring-slate-200",
    "Action Needed": "bg-amber-50 text-amber-700 ring-amber-100",
  }[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {status}
    </span>
  );
}

type NotificationItem = {
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
  status: "Unread" | "Read" | "Action Needed";
  action: string;
  tone: "blue" | "green" | "amber" | "slate";
};

function NotificationRow({ item }: { item: NotificationItem }) {
  const iconBg = {
    blue: "bg-brand-50 text-brand-600 ring-brand-100",
    green: "bg-growth-50 text-growth-500 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
  }[item.tone];

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60 sm:flex-row sm:items-start">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${iconBg}`}>
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold text-navy-900">{item.title}</h3>
          <NotificationBadge status={item.status} />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium text-text-muted">{item.time}</p>
          <button
            type="button"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {item.action}
          </button>
        </div>
      </div>
    </article>
  );
}

function NotificationGroup({ label, items }: { label: string; items: NotificationItem[] }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <NotificationRow key={item.title} item={item} />
        ))}
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const starIcon = (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.6 6.5L21 9.5l-5 4.3 1.5 6.5L12 17.8 6.5 20.3 8 13.8 3 9.5l6.4-.9L12 2Z" />
    </svg>
  );
  const checkIcon = (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
  const chartIcon = (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M8 17v-5M12 17V8M16 17v-3" />
    </svg>
  );
  const docIcon = (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v16H7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 8h5M9.5 12h5M9.5 16h3.5" />
    </svg>
  );
  const cardIcon = (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16v8H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 11h16M8 15h3" />
    </svg>
  );
  const pinIcon = (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.5-7.5 11.25-7.5 11.25S4.5 18 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );

  const today: NotificationItem[] = [
    {
      icon: starIcon,
      title: "New review received",
      description: "Sarah M. left a 5-star review on Google. AJN drafted a reply for your approval.",
      time: "45 minutes ago",
      status: "Action Needed",
      action: "Review reply →",
      tone: "amber",
    },
    {
      icon: docIcon,
      title: "Content ready for approval",
      description: "6 items are in your Approval Center — including a GBP post and 3 review replies.",
      time: "2 hours ago",
      status: "Unread",
      action: "Open Approval Center →",
      tone: "blue",
    },
    {
      icon: chartIcon,
      title: "Google ranking improved",
      description: '"Emergency plumber Danville" moved from position 6 to position 4 this week.',
      time: "5 hours ago",
      status: "Unread",
      action: "View Analytics →",
      tone: "green",
    },
  ];

  const thisWeek: NotificationItem[] = [
    {
      icon: docIcon,
      title: "Weekly report delivered",
      description: "Your AJN performance summary for June 9–15 is ready to review.",
      time: "Monday, 8:00 AM",
      status: "Read",
      action: "View report →",
      tone: "blue",
    },
    {
      icon: pinIcon,
      title: "Google Business Profile sync complete",
      description: "Hours, services, and photos were synced successfully from your connected profile.",
      time: "Sunday, 2:15 AM",
      status: "Read",
      action: "View GBP →",
      tone: "green",
    },
  ];

  const earlier: NotificationItem[] = [
    {
      icon: cardIcon,
      title: "Billing reminder",
      description: "Your Growth Plan renews on June 20, 2026. No action needed — card on file will be charged.",
      time: "Jun 13, 2026",
      status: "Read",
      action: "View Billing →",
      tone: "slate",
    },
    {
      icon: checkIcon,
      title: "Content ready for approval",
      description: "4 social posts and 2 review replies were prepared for Riverside Plumbing Co.",
      time: "Jun 10, 2026",
      status: "Read",
      action: "View history →",
      tone: "blue",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Stay on top of approvals, reviews, performance updates, and account activity.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          Mark All As Read
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Unread"
          value="4"
          helper="Needs your attention"
          tone="blue"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
            </svg>
          }
        />
        <SummaryCard
          label="Approvals Needed"
          value="6"
          helper="In Approval Center"
          tone="amber"
          icon={checkIcon}
        />
        <SummaryCard
          label="Reviews"
          value="3"
          helper="New this week"
          tone="green"
          icon={starIcon}
        />
        <SummaryCard
          label="System Updates"
          value="2"
          helper="Syncs and reports"
          tone="slate"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 19A9 9 0 0 0 19 5" />
            </svg>
          }
        />
      </div>

      <SectionCard title="Notification Feed" subtitle="Grouped by recency">
        <div className="space-y-8">
          <NotificationGroup label="Today" items={today} />
          <NotificationGroup label="This Week" items={thisWeek} />
          <NotificationGroup label="Earlier" items={earlier} />
        </div>
      </SectionCard>
    </div>
  );
}
