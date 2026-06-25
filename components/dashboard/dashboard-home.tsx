function KpiCard({
  label,
  value,
  change,
  trend,
  accent,
}: {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  accent: "blue" | "green" | "navy" | "amber";
}) {
  const accentStyles = {
    blue: "bg-brand-50 text-brand-600 ring-brand-100",
    green: "bg-growth-50 text-growth-500 ring-emerald-100",
    navy: "bg-slate-100 text-[#081426] ring-slate-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
  }[accent];

  const trendStyles = {
    up: "text-growth-500",
    down: "text-rose-500",
    neutral: "text-slate-500",
  }[trend];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md shadow-slate-200/40 ring-1 ring-slate-900/[0.03] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ring-1 ${accentStyles}`}>
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M10 19V9M16 19v-6M22 19V3" />
          </svg>
        </div>
      </div>
      <p className={`mt-4 text-sm font-medium ${trendStyles}`}>{change}</p>
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
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40 ring-1 ring-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-navy-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && (
          <button type="button" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            {action}
          </button>
        )}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function PlaceholderChart() {
  const bars = [42, 58, 48, 72, 65, 80, 74];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2 h-40 rounded-xl bg-surface px-4 pb-4 pt-6 ring-1 ring-slate-200/70">
        {bars.map((height, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-600/70"
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs font-medium text-slate-400">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
        <span>Sun</span>
      </div>
    </div>
  );
}

export function DashboardHome() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
          Overview
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          Good morning, Mike
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-text-muted">
          Here is a snapshot of your Google visibility, reviews, content, and local
          marketing activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Google Visibility"
          value="#4 → #2"
          change="+2 positions this month"
          trend="up"
          accent="blue"
        />
        <KpiCard
          label="Review Rating"
          value="4.9"
          change="+0.3 since last month"
          trend="up"
          accent="green"
        />
        <KpiCard
          label="Monthly Leads"
          value="47"
          change="+18% vs last month"
          trend="up"
          accent="navy"
        />
        <KpiCard
          label="Content Awaiting Approval"
          value="3"
          change="2 posts and 1 GBP update"
          trend="neutral"
          accent="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Performance Trend" subtitle="Visibility, calls, and profile activity" action="View analytics">
            <PlaceholderChart />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Upcoming Posts" action="View all">
              <ul className="space-y-4">
                {[
                  { title: "Spring maintenance reminder", date: "Tomorrow, 9:00 AM", type: "Google post" },
                  { title: "Customer spotlight: 5-star review", date: "Thu, 10:30 AM", type: "Social post" },
                  { title: "Emergency service availability", date: "Sat, 8:00 AM", type: "Google post" },
                ].map((item) => (
                  <li key={item.title} className="rounded-xl bg-surface p-4 ring-1 ring-slate-200/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-navy-900">{item.title}</p>
                        <p className="mt-1 text-sm text-text-muted">{item.date}</p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
                        {item.type}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="AI Activity" action="View log">
              <ul className="space-y-4">
                {[
                  "Drafted 2 Google Business Profile posts",
                  "Suggested replies for 3 new reviews",
                  "Identified 4 local keyword opportunities",
                  "Prepared weekly performance summary",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-growth-50 text-xs text-growth-500 ring-1 ring-emerald-100">
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
            <div className="space-y-4">
              <div className="rounded-xl bg-growth-50 p-4 ring-1 ring-emerald-100">
                <p className="text-sm font-semibold text-growth-500">Profile health: Strong</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Your profile is active, complete, and posting consistently.
                </p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex justify-between gap-3">
                  <span>Weekly posts</span>
                  <span className="font-semibold text-navy-900">On track</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Review responses</span>
                  <span className="font-semibold text-navy-900">3 pending</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Photos updated</span>
                  <span className="font-semibold text-navy-900">This week</span>
                </li>
              </ul>
            </div>
          </Panel>

          <Panel title="Recent Reviews" action="View all">
            <ul className="space-y-4">
              {[
                { name: "Sarah T.", rating: "5.0", text: "Fast, professional, and easy to work with." },
                { name: "Daniel M.", rating: "5.0", text: "Showed up on time and explained everything clearly." },
              ].map((review) => (
                <li key={review.name} className="rounded-xl bg-surface p-4 ring-1 ring-slate-200/70">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-navy-900">{review.name}</p>
                    <p className="text-sm font-semibold text-amber-500">★ {review.rating}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{review.text}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent Notifications">
            <ul className="space-y-3">
              {[
                "New 5-star review received",
                "Google post scheduled for tomorrow",
                "Content draft ready for approval",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-3 text-sm text-slate-600"
                >
                  <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
