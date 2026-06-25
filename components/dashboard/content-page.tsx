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

function ContentCalendar() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const events: Record<number, { label: string; tone: "blue" | "green" | "amber" }[]> = {
    4: [{ label: "Spring promo", tone: "blue" }],
    8: [{ label: "Review spotlight", tone: "green" }],
    12: [{ label: "Maintenance tips", tone: "amber" }],
    15: [{ label: "Emergency service", tone: "blue" }],
    19: [{ label: "Customer story", tone: "green" }],
    24: [{ label: "Local event", tone: "blue" }],
    27: [{ label: "Weekly update", tone: "amber" }],
  };

  const toneStyles = {
    blue: "bg-brand-50 text-brand-700 ring-brand-100",
    green: "bg-growth-50 text-growth-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-navy-900">March 2026</p>
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

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-text-muted">
        {days.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, index) => {
          const dayNumber = index - 2;
          const isValid = dayNumber >= 1 && dayNumber <= 31;
          const dayEvents = isValid ? events[dayNumber] ?? [] : [];

          return (
            <div
              key={index}
              className={`min-h-24 rounded-xl border p-2 text-left ${
                isValid
                  ? "border-slate-100 bg-[#F8FAFC] ring-1 ring-slate-200/60"
                  : "border-transparent bg-transparent"
              }`}
            >
              {isValid && (
                <>
                  <p className="text-xs font-semibold text-navy-900">{dayNumber}</p>
                  <div className="mt-2 space-y-1">
                    {dayEvents.map((event) => (
                      <div
                        key={event.label}
                        className={`truncate rounded-md px-1.5 py-1 text-[10px] font-semibold ring-1 ${toneStyles[event.tone]}`}
                      >
                        {event.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ContentPage() {
  const queueItems = [
    {
      title: "Spring Plumbing Maintenance Reminder",
      preview:
        "Keep your home running smoothly this season. Schedule a spring check-up with Riverside Plumbing Co. and avoid costly surprises.",
      status: "Ready for Review" as const,
    },
    {
      title: "5-Star Customer Spotlight",
      preview:
        "Thank you to our Danville customers for another great week of reviews. We appreciate your trust and referrals.",
      status: "Approved" as const,
    },
    {
      title: "Emergency Service Availability",
      preview:
        "Need help fast? Our local team is available for emergency plumbing calls across Danville and nearby communities.",
      status: "Scheduled" as const,
    },
    {
      title: "Water Heater Tip of the Week",
      preview:
        "Flushing your water heater once a year helps improve efficiency and extend its lifespan. Ask us about maintenance plans.",
      status: "Published" as const,
    },
  ];

  const libraryCategories = [
    { name: "Promotions", count: 14, updated: "2 days ago" },
    { name: "Educational", count: 18, updated: "Yesterday" },
    { name: "Seasonal", count: 9, updated: "4 days ago" },
    { name: "Community", count: 6, updated: "1 week ago" },
    { name: "Tips", count: 11, updated: "3 days ago" },
  ];

  const upcomingPosts = [
    {
      when: "Tomorrow",
      title: "Spring maintenance reminder",
      channel: "Google Business Profile",
      status: "Scheduled" as const,
    },
    {
      when: "Friday",
      title: "Customer testimonial highlight",
      channel: "Google Business Profile",
      status: "Approved" as const,
    },
    {
      when: "Next Tuesday",
      title: "Drain cleaning service promo",
      channel: "Google Business Profile",
      status: "Ready for Review" as const,
    },
    {
      when: "Next Friday",
      title: "Weekly local business update",
      channel: "Google Business Profile",
      status: "Scheduled" as const,
    },
  ];

  const assistantSuggestions = [
    "Promote summer services",
    "Highlight customer testimonials",
    "Share maintenance tips",
    "Celebrate local events",
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Content</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Review, approve, and schedule AI-generated content for your Google Business Profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:bg-[#0B1426] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Generate Content
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Schedule Posts
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Posts This Month"
          value="12"
          helper="+3 vs last month"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v16H7z" />
            </svg>
          }
        />
        <KpiCard
          label="Awaiting Approval"
          value="3"
          helper="Needs review"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Scheduled"
          value="8"
          helper="Next 30 days"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Z" />
            </svg>
          }
        />
        <KpiCard
          label="Published"
          value="42"
          helper="+6 this month"
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
          title="AI Content Queue"
          subtitle="Review AI-generated posts before they go live"
          action="View all"
          className="xl:col-span-2"
        >
          <div className="space-y-4">
            {queueItems.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
              >
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-xs font-semibold uppercase tracking-wide text-slate-400 lg:w-36">
                    Suggested image
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-semibold text-navy-900">{item.title}</h3>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.preview}</p>
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

        <SectionCard title="AI Marketing Assistant" subtitle="Quick ideas for your next post">
          <div className="space-y-3">
            {assistantSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 text-left text-sm font-medium text-navy-900 ring-1 ring-slate-200/60 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                {suggestion}
                <span className="text-brand-600">→</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="rounded-full bg-[#081426] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0B1426]"
            >
              Generate New
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-slate-50"
              >
                Regenerate
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-slate-50"
              >
                Use Template
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Content Calendar" subtitle="See what is scheduled and published this month">
        <ContentCalendar />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Content Library" subtitle="Organized by content type" action="Browse all">
          <div className="grid gap-3 sm:grid-cols-2">
            {libraryCategories.map((category) => (
              <article
                key={category.name}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <p className="font-semibold text-navy-900">{category.name}</p>
                <p className="mt-2 text-2xl font-bold text-brand-600">{category.count}</p>
                <p className="mt-1 text-xs text-text-muted">posts · updated {category.updated}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Upcoming Posts" subtitle="What goes live next">
          <ol className="relative space-y-0">
            {upcomingPosts.map((post, index) => (
              <li key={post.title} className="relative flex gap-4 pb-6 last:pb-0">
                {index < upcomingPosts.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-slate-200"
                  />
                )}
                <span className="relative mt-1.5 flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {post.when}
                  </p>
                  <p className="mt-1 font-semibold text-navy-900">{post.title}</p>
                  <p className="mt-1 text-sm text-text-muted">{post.channel}</p>
                  <div className="mt-3">
                    <StatusBadge status={post.status} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
