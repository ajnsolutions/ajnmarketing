function KpiCard({
  label,
  value,
  delta,
  trend,
  period = "vs last month",
}: {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  period?: string;
}) {
  const trendColor = {
    up: "text-growth-500",
    down: "text-rose-500",
    neutral: "text-slate-500",
  }[trend];

  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : null;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-3 text-4xl font-bold tracking-[-0.03em] text-navy-900 sm:text-[2.5rem] sm:leading-none">
        {value}
      </p>
      <div className="mt-4 space-y-1">
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${trendColor}`}>
          {arrow && <span aria-hidden="true">{arrow}</span>}
          {delta}
        </p>
        <p className="text-xs text-slate-400">{period}</p>
      </div>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && (
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {action}
          </button>
        )}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function PerformanceLineChart() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60 sm:p-5">
      <svg viewBox="0 0 640 220" className="h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[40, 80, 120, 160].map((y) => (
          <line
            key={y}
            x1="48"
            y1={y}
            x2="612"
            y2={y}
            stroke="#E2E8F0"
            strokeWidth="1"
          />
        ))}

        <path
          d="M48 148 L128 132 L208 138 L288 108 L368 118 L448 86 L528 92 L612 68 L612 180 L48 180 Z"
          fill="url(#lineFill)"
        />
        <path
          d="M48 148 L128 132 L208 138 L288 108 L368 118 L448 86 L528 92 L612 68"
          fill="none"
          stroke="#2563EB"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {[
          [48, 148],
          [128, 132],
          [208, 138],
          [288, 108],
          [368, 118],
          [448, 86],
          [528, 92],
          [612, 68],
        ].map(([cx, cy], index) => (
          <circle key={index} cx={cx} cy={cy} r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
        ))}
      </svg>

      <div className="mt-3 flex justify-between px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Today"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
    </div>
  );
}

function ActivityTimeline() {
  const items = [
    { text: "AI generated a Google Post", time: "2 hours ago" },
    { text: "New 5-star review received", time: "5 hours ago" },
    { text: "Ranking improved", time: "Yesterday" },
    { text: "Customer approved content", time: "Yesterday" },
    { text: "Weekly report delivered", time: "2 days ago" },
  ];

  return (
    <ol className="relative space-y-0">
      {items.map((item, index) => (
        <li key={item.text} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-slate-200"
            />
          )}
          <span className="relative mt-1.5 flex h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-navy-900">{item.text}</p>
            <p className="mt-1 text-xs text-text-muted">{item.time}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DashboardHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
          Welcome back, Mike. Here&apos;s what&apos;s happening with Riverside Plumbing
          today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Google Visibility"
          value="#2"
          delta="+2 positions"
          trend="up"
        />
        <KpiCard
          label="Review Rating"
          value="4.9"
          delta="+0.3 rating"
          trend="up"
        />
        <KpiCard
          label="Monthly Leads"
          value="47"
          delta="+18%"
          trend="up"
        />
        <KpiCard
          label="Content Awaiting Approval"
          value="3"
          delta="2 posts and 1 GBP update"
          trend="neutral"
          period="needs your review"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel
            title="Performance Trend"
            subtitle="Visibility, calls, and profile activity"
            action="View analytics"
          >
            <PerformanceLineChart />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Upcoming Posts" action="View all">
              <ul className="space-y-3">
                {[
                  { title: "Spring maintenance reminder", date: "Tomorrow, 9:00 AM", type: "Google post" },
                  { title: "Customer spotlight: 5-star review", date: "Thu, 10:30 AM", type: "Social post" },
                  { title: "Emergency service availability", date: "Sat, 8:00 AM", type: "Google post" },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-navy-900">{item.title}</p>
                        <p className="mt-1 text-sm text-text-muted">{item.date}</p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                        {item.type}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="AI Activity" action="View log">
              <ul className="space-y-3">
                {[
                  "Drafted 2 Google Business Profile posts",
                  "Suggested replies for 3 new reviews",
                  "Identified 4 local keyword opportunities",
                  "Prepared weekly performance summary",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-growth-50 text-xs text-growth-500 ring-1 ring-emerald-100">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <div className="space-y-6">
          <Panel title="Google Business Profile Status">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-growth-50 px-4 py-3.5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Profile Health
                  </p>
                  <p className="mt-1 text-lg font-bold text-navy-900">Strong</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-growth-500 ring-1 ring-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-growth-500" aria-hidden="true" />
                  Healthy
                </span>
              </div>

              <ul className="space-y-3">
                {[
                  "Profile Complete",
                  "Verified",
                  "Posting Weekly",
                  "Reviews Responded",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm font-medium text-navy-900"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-growth-50 text-xs text-growth-500 ring-1 ring-emerald-100">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel title="Recent Reviews" action="View all">
            <ul className="space-y-3">
              {[
                { name: "Sarah T.", rating: "5.0", text: "Fast, professional, and easy to work with." },
                { name: "Daniel M.", rating: "5.0", text: "Showed up on time and explained everything clearly." },
              ].map((review) => (
                <li
                  key={review.name}
                  className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-navy-900">{review.name}</p>
                    <p className="text-sm font-semibold text-amber-500">★ {review.rating}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{review.text}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent Activity" action="View all">
            <ActivityTimeline />
          </Panel>
        </div>
      </div>
    </div>
  );
}
