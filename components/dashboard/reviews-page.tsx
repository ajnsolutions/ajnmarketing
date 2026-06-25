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
  status: "Draft Ready" | "Approved" | "Needs Review" | "Pending" | "High" | "Medium";
}) {
  const styles = {
    "Draft Ready": "bg-brand-50 text-brand-600 ring-brand-100",
    Approved: "bg-growth-50 text-growth-500 ring-emerald-100",
    "Needs Review": "bg-amber-50 text-amber-700 ring-amber-100",
    Pending: "bg-slate-100 text-slate-600 ring-slate-200",
    High: "bg-rose-50 text-rose-600 ring-rose-100",
    Medium: "bg-amber-50 text-amber-700 ring-amber-100",
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

function StarRating({ stars }: { stars: number }) {
  return (
    <p className="text-sm font-semibold text-amber-500" aria-label={`${stars} out of 5 stars`}>
      {"★".repeat(stars)}
      {"☆".repeat(5 - stars)}
    </p>
  );
}

function RatingTrendChart() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Average rating over the past 12 months
        </p>
        <div className="flex items-center gap-4 text-xs font-medium text-text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            Average rating
          </span>
          <span className="inline-flex items-center gap-2 text-growth-500">
            <span className="h-2 w-2 rounded-full bg-growth-500" />
            Trending up
          </span>
        </div>
      </div>
      <svg viewBox="0 0 720 220" className="h-auto w-full" aria-hidden="true">
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="40" y1={y} x2="700" y2={y} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        <path
          d="M40 148 L98 142 L156 136 L214 128 L272 124 L330 118 L388 112 L446 106 L504 98 L562 92 L620 86 L678 78"
          fill="none"
          stroke="#2563EB"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M40 148 L98 142 L156 136 L214 128 L272 124 L330 118 L388 112 L446 106 L504 98 L562 92 L620 86 L678 78 L678 180 L40 180 Z"
          fill="url(#ratingFill)"
          opacity="0.35"
        />
        <defs>
          <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-3 grid grid-cols-6 gap-2 text-[11px] font-medium text-slate-400 sm:grid-cols-12">
        {months.map((month) => (
          <span key={month} className="text-center">
            {month}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReviewsPage() {
  const recentReviews = [
    {
      name: "Sarah T.",
      date: "Mar 12, 2026",
      stars: 5,
      text: "Excellent communication and very professional.",
      status: "Draft Ready" as const,
    },
    {
      name: "Daniel M.",
      date: "Mar 10, 2026",
      stars: 4,
      text: "They arrived quickly and solved the problem.",
      status: "Needs Review" as const,
    },
    {
      name: "Jennifer K.",
      date: "Mar 8, 2026",
      stars: 5,
      text: "The easiest company I've worked with.",
      status: "Approved" as const,
    },
  ];

  const queueRows = [
    {
      customer: "Chris P.",
      stars: 5,
      received: "Today",
      priority: "High" as const,
      status: "Draft Ready" as const,
    },
    {
      customer: "Amanda L.",
      stars: 4,
      received: "Yesterday",
      priority: "Medium" as const,
      status: "Needs Review" as const,
    },
    {
      customer: "Robert H.",
      stars: 5,
      received: "2 days ago",
      priority: "High" as const,
      status: "Pending" as const,
    },
  ];

  const aiReply =
    "Thank you for sharing your experience with Riverside Plumbing Co. We appreciate your kind words and are glad our team could help quickly and professionally. We look forward to serving you again anytime you need reliable local service.";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Reviews</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Monitor customer feedback, respond faster, and improve your online reputation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600 ring-1 ring-amber-100">
            ★★★★★ 4.9
          </span>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:bg-[#0B1426] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Generate AI Replies
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Average Rating"
          value="4.9"
          helper="+0.3 vs last month"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.6 6.5L21 9.5l-5 4.3 1.5 6.5L12 17.8 6.5 20.3 8 13.8 3 9.5l6.4-.9L12 2Z" />
            </svg>
          }
        />
        <KpiCard
          label="Total Reviews"
          value="128"
          helper="+14 this month"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6M7 16h8M5 4h14v16H5z" />
            </svg>
          }
        />
        <KpiCard
          label="New Reviews This Month"
          value="12"
          helper="+3 vs last month"
          trend="up"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m4-4H8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Needs Response"
          value="3"
          helper="2 high priority"
          trend="neutral"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      <SectionCard title="Review Trend" subtitle="Track reputation growth over time">
        <RatingTrendChart />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Recent Reviews"
          subtitle="Latest customer feedback across your profile"
          action="View all"
          className="xl:col-span-2"
        >
          <div className="space-y-4">
            {recentReviews.map((review) => (
              <article
                key={review.name}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy-900">{review.name}</p>
                    <p className="mt-1 text-sm text-text-muted">{review.date}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating stars={review.stars} />
                    <StatusBadge status={review.status} />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">&ldquo;{review.text}&rdquo;</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    Edit Reply
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
                  >
                    Approve
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="AI Suggested Reply" subtitle="Professional response ready for review">
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 ring-1 ring-brand-100">
            <p className="text-sm leading-7 text-slate-700">{aiReply}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-slate-50"
            >
              Copy
            </button>
            <button
              type="button"
              className="rounded-full bg-growth-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              Approve
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              Regenerate
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Reputation Health" subtitle="How customers feel about your business">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Review Velocity", value: "12 / month", tone: "text-brand-600", dot: "bg-brand-600" },
              { label: "Sentiment Score", value: "92%", tone: "text-growth-500", dot: "bg-growth-500" },
              { label: "Average Response Time", value: "4.2 hrs", tone: "text-amber-600", dot: "bg-amber-500" },
              { label: "Positive Review %", value: "96%", tone: "text-growth-500", dot: "bg-growth-500" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} aria-hidden="true" />
                  <p className="text-sm font-medium text-text-muted">{item.label}</p>
                </div>
                <p className={`mt-2 text-2xl font-bold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Review Sources" subtitle="Where your reviews come from">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60">
              <span className="font-semibold text-navy-900">Google</span>
              <span className="text-sm font-bold text-brand-600">128</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 px-4 py-3">
              <span className="font-medium text-slate-500">Facebook</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Coming Soon
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 px-4 py-3">
              <span className="font-medium text-slate-500">Yelp</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Coming Soon
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Quick Actions">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-brand-600" />
              Respond to 3 reviews waiting for approval
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-growth-500" />
              Your average rating improved this month
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
              2 reviews flagged for manual review
            </li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Review Response Queue" subtitle="Prioritized reviews waiting for action">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                <th className="pb-3 pr-4 font-semibold">Customer</th>
                <th className="pb-3 pr-4 font-semibold">Stars</th>
                <th className="pb-3 pr-4 font-semibold">Received</th>
                <th className="pb-3 pr-4 font-semibold">Priority</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queueRows.map((row) => (
                <tr key={row.customer}>
                  <td className="py-4 pr-4 font-medium text-navy-900">{row.customer}</td>
                  <td className="py-4 pr-4 text-amber-500">{"★".repeat(row.stars)}</td>
                  <td className="py-4 pr-4 text-slate-600">{row.received}</td>
                  <td className="py-4 pr-4">
                    <StatusBadge status={row.priority} />
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-brand-600 transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
