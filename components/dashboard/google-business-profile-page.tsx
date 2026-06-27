import Link from "next/link";

function MiniSparkline({ trend }: { trend: "up" | "down" | "neutral" }) {
  const paths = {
    up: "M2 14 L8 11 L14 12 L20 8 L26 6",
    down: "M2 6 L8 9 L14 8 L20 12 L26 14",
    neutral: "M2 10 L8 10 L14 9 L20 10 L26 10",
  };

  const colors = {
    up: "#22C55E",
    down: "#EF4444",
    neutral: "#94A3B8",
  };

  return (
    <svg viewBox="0 0 28 16" className="h-4 w-14" aria-hidden="true">
      <path
        d={paths[trend]}
        fill="none"
        stroke={colors[trend]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  delta,
  trend,
}: {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
}) {
  const trendColor = {
    up: "text-growth-500",
    down: "text-rose-500",
    neutral: "text-slate-500",
  }[trend];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        <MiniSparkline trend={trend} />
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
      <p className={`mt-2 text-sm font-semibold ${trendColor}`}>
        {trend === "up" && "↑ "}
        {trend === "down" && "↓ "}
        {delta}
      </p>
      <p className="mt-1 text-xs text-slate-400">vs last month</p>
    </article>
  );
}

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

function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "bg-rose-50 text-rose-600 ring-rose-100",
    Medium: "bg-amber-50 text-amber-700 ring-amber-100",
    Low: "bg-slate-100 text-slate-600 ring-slate-200",
  }[priority];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {priority}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: "Ready" | "Scheduled" | "Needs Approval" | "Draft Ready" | "Approved" | "Needs Review";
}) {
  const styles = {
    Ready: "bg-growth-50 text-growth-500 ring-emerald-100",
    Scheduled: "bg-brand-50 text-brand-600 ring-brand-100",
    "Needs Approval": "bg-amber-50 text-amber-700 ring-amber-100",
    "Draft Ready": "bg-brand-50 text-brand-600 ring-brand-100",
    Approved: "bg-growth-50 text-growth-500 ring-emerald-100",
    "Needs Review": "bg-amber-50 text-amber-700 ring-amber-100",
  }[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {status}
    </span>
  );
}

export function GoogleBusinessProfilePage() {
  const rankings: {
    keyword: string;
    position: string;
    change: string;
    trend: "up" | "down" | "neutral";
  }[] = [
    { keyword: "plumber near me", position: "#2", change: "Up 2", trend: "up" },
    { keyword: "emergency plumbing danville", position: "#1", change: "Up 1", trend: "up" },
    { keyword: "water heater repair", position: "#4", change: "No change", trend: "neutral" },
    { keyword: "drain cleaning near me", position: "#3", change: "Up 3", trend: "up" },
  ];

  const reviews = [
    {
      name: "Sarah T.",
      rating: "5.0",
      text: "Fast response, clear pricing, and excellent work. Highly recommend for any plumbing issue.",
      badge: "Draft Ready" as const,
    },
    {
      name: "Daniel M.",
      rating: "5.0",
      text: "Professional team and great communication from start to finish.",
      badge: "Approved" as const,
    },
    {
      name: "Jennifer K.",
      rating: "4.0",
      text: "Good service overall. Would appreciate a quicker callback next time.",
      badge: "Needs Review" as const,
    },
  ];

  const recommendations = [
    {
      title: "Add 5 new job photos this week",
      priority: "High" as const,
      status: "Ready" as const,
    },
    {
      title: "Publish your weekly Google post",
      priority: "High" as const,
      status: "Scheduled" as const,
    },
    {
      title: "Respond to 3 reviews",
      priority: "Medium" as const,
      status: "Needs Approval" as const,
    },
    {
      title: "Add drain cleaning as a highlighted service",
      priority: "Medium" as const,
      status: "Ready" as const,
    },
    {
      title: "Update holiday hours before next month",
      priority: "Low" as const,
      status: "Scheduled" as const,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
              Google Business Profile
            </h1>
            <span className="inline-flex items-center gap-2 rounded-full bg-growth-50 px-3 py-1 text-xs font-semibold text-growth-500 ring-1 ring-emerald-100">
              <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
              Connected
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Track your visibility, reviews, calls, and optimization progress in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/google-business-profile/connect"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Connect / Manage Connection
          </Link>
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:bg-[#0B1426] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Optimize Profile
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-text-muted">Profile Health Score</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <p className="text-5xl font-bold tracking-tight text-navy-900 sm:text-6xl">92%</p>
              <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-growth-50 px-3 py-1.5 text-sm font-semibold text-growth-500 ring-1 ring-emerald-100">
                <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
                Strong
              </span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Verification", value: "Verified" },
                { label: "Completion", value: "96%" },
                { label: "Last Optimized", value: "2 days ago" },
                { label: "Status", value: "Active" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-navy-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-navy-900">Optimization checklist</p>
            <ul className="mt-4 space-y-3">
              {[
                "Business info complete",
                "Photos updated",
                "Reviews monitored",
                "Weekly post scheduled",
                "Service areas verified",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium text-navy-900">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-growth-50 text-xs text-growth-500 ring-1 ring-emerald-100">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Search Views" value="1,284" delta="+18%" trend="up" />
        <MetricCard label="Maps Views" value="842" delta="+12%" trend="up" />
        <MetricCard label="Phone Calls" value="47" delta="+24%" trend="up" />
        <MetricCard label="Website Clicks" value="63" delta="+9%" trend="up" />
        <MetricCard label="Direction Requests" value="18" delta="-4%" trend="down" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Local Rankings"
          subtitle="How customers find you in local search"
          action="View all keywords"
          className="xl:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                  <th className="pb-3 pr-4 font-semibold">Keyword</th>
                  <th className="pb-3 pr-4 font-semibold">Position</th>
                  <th className="pb-3 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankings.map((row) => (
                  <tr key={row.keyword}>
                    <td className="py-4 pr-4 font-medium text-navy-900">{row.keyword}</td>
                    <td className="py-4 pr-4 font-semibold text-brand-600">{row.position}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          row.trend === "up"
                            ? "text-growth-500"
                            : row.trend === "down"
                              ? "text-rose-500"
                              : "text-slate-500"
                        }`}
                      >
                        {row.trend === "up" && "↑"}
                        {row.trend === "down" && "↓"}
                        {row.change}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Ranking trend
            </p>
            <svg viewBox="0 0 560 120" className="h-auto w-full" aria-hidden="true">
              {[24, 48, 72, 96].map((y) => (
                <line key={y} x1="0" y1={y} x2="560" y2={y} stroke="#E2E8F0" strokeWidth="1" />
              ))}
              <path
                d="M0 78 C70 72, 140 68, 210 62 S350 48, 420 42 S500 36, 560 30"
                fill="none"
                stroke="#2563EB"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </SectionCard>

        <SectionCard title="Business Information">
          <dl className="space-y-4">
            {[
              { label: "Business", value: "Riverside Plumbing Co." },
              { label: "Category", value: "Plumber" },
              { label: "Service Area", value: "Danville, CA + nearby cities" },
              { label: "Phone", value: "(555) 555-0147" },
              { label: "Website", value: "riversideplumbing.example" },
              { label: "Hours", value: "Open today · 8:00 AM – 6:00 PM" },
              { label: "Status", value: "Verified" },
            ].map((item) => (
              <div key={item.label} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-navy-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>

      <SectionCard title="Reviews" subtitle="Monitor reputation and AI-assisted responses" action="Manage reviews">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Average Rating", value: "4.9" },
            { label: "Total Reviews", value: "128" },
            { label: "New Reviews This Month", value: "12" },
            { label: "Reviews Needing Response", value: "3" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <p className="text-xs font-medium text-text-muted">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-navy-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {reviews.map((review) => (
            <article
              key={review.name}
              className="rounded-xl border border-slate-100 bg-white p-4 ring-1 ring-slate-200/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy-900">{review.name}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-500">★ {review.rating}</p>
                </div>
                <StatusBadge status={review.badge} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{review.text}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="AI Optimization Recommendations"
        subtitle="Suggested actions to improve visibility and engagement"
        action="View all"
      >
        <div className="space-y-3">
          {recommendations.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-900">{item.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Review
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
