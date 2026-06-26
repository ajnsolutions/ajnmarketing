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

function KpiCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600 ring-1 ring-brand-100">
          {icon}
        </div>
        <p className="text-sm font-semibold text-growth-500">↑ {delta}</p>
      </div>
      <p className="mt-4 text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">vs previous period</p>
    </article>
  );
}

function RadialIndicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber";
}) {
  const stroke = {
    blue: "#2563EB",
    green: "#22C55E",
    amber: "#F59E0B",
  }[tone];

  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="78 100"
          />
        </svg>
        <span className="absolute text-lg font-bold text-navy-900">{value}</span>
      </div>
      <p className="mt-3 text-center text-sm font-medium text-text-muted">{label}</p>
    </div>
  );
}

function BusinessGrowthChart() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-xs font-medium text-text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            Current period
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-growth-500" />
            Previous period
          </span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          12-month timeline
        </p>
      </div>
      <svg viewBox="0 0 760 240" className="h-auto w-full" aria-hidden="true">
        {[40, 80, 120, 160, 200].map((y) => (
          <line key={y} x1="40" y1={y} x2="720" y2={y} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        <path
          d="M40 170 L98 162 L156 150 L214 142 L272 128 L330 118 L388 108 L446 98 L504 88 L562 78 L620 68 L678 58"
          fill="none"
          stroke="#22C55E"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <path
          d="M40 180 L98 176 L156 168 L214 160 L272 152 L330 142 L388 132 L446 122 L504 112 L562 102 L620 92 L678 82"
          fill="none"
          stroke="#2563EB"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="678" cy="58" r="5" fill="#22C55E" stroke="#fff" strokeWidth="2" />
        <circle cx="678" cy="82" r="5" fill="#2563EB" stroke="#fff" strokeWidth="2" />
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

function CustomerActionsChart() {
  const items = [
    { label: "Phone Calls", value: 312, width: "88%" },
    { label: "Website Visits", value: 846, width: "100%" },
    { label: "Direction Requests", value: 198, width: "62%" },
    { label: "Messages", value: 74, width: "38%" },
    { label: "Bookings", value: 41, width: "28%" },
  ];

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-navy-900">{item.label}</span>
            <span className="font-semibold text-brand-600">{item.value}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-brand-600 to-brand-600/80"
              style={{ width: item.width }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrafficSourcesChart() {
  const segments = [
    { label: "Google Search", value: 42, color: "#2563EB" },
    { label: "Google Maps", value: 28, color: "#22C55E" },
    { label: "Direct", value: 16, color: "#64748B" },
    { label: "Referral", value: 9, color: "#F59E0B" },
    { label: "Social", value: 5, color: "#818CF8" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[conic-gradient(#2563EB_0_42%,#22C55E_42_70%,#64748B_70_86%,#F59E0B_86_95%,#818CF8_95_100%)] p-4">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-center">
          <div>
            <p className="text-2xl font-bold text-navy-900">100%</p>
            <p className="text-xs text-text-muted">Traffic</p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span className="font-medium text-navy-900">{segment.label}</span>
            </div>
            <span className="font-semibold text-slate-600">{segment.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const searchTerms = [
    { keyword: "Emergency plumber", position: "#2", volume: "1,240", change: "+2" },
    { keyword: "Water heater repair", position: "#4", volume: "860", change: "+1" },
    { keyword: "Drain cleaning", position: "#3", volume: "720", change: "+3" },
    { keyword: "Leak detection", position: "#5", volume: "540", change: "0" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Track your business growth and marketing performance over time.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            Last 30 days
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-400" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
            </svg>
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:bg-[#0B1426] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Export Report
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Google Search Views"
          value="12,483"
          delta="18%"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
            </svg>
          }
        />
        <KpiCard
          label="Maps Views"
          value="4,812"
          delta="22%"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.5-7.5 11.25-7.5 11.25S4.5 18 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          }
        />
        <KpiCard
          label="Website Clicks"
          value="846"
          delta="15%"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          }
        />
        <KpiCard
          label="Phone Calls"
          value="312"
          delta="27%"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
            </svg>
          }
        />
        <KpiCard
          label="Direction Requests"
          value="198"
          delta="11%"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            </svg>
          }
        />
        <KpiCard
          label="Leads Generated"
          value="74"
          delta="31%"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" />
            </svg>
          }
        />
      </div>

      <SectionCard title="Business Growth" subtitle="Overall marketing performance over the last 12 months">
        <BusinessGrowthChart />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Customer Actions" subtitle="How customers interact with your business">
          <CustomerActionsChart />
        </SectionCard>

        <SectionCard title="Google Performance" subtitle="Search visibility and profile quality">
          <div className="grid grid-cols-2 gap-4">
            <RadialIndicator label="Average Position" value="#2.4" tone="blue" />
            <RadialIndicator label="Visibility Score" value="92" tone="green" />
            <RadialIndicator label="Click Through Rate" value="8.4%" tone="blue" />
            <RadialIndicator label="Profile Completeness" value="96%" tone="green" />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Traffic Sources" subtitle="Where your profile traffic comes from" className="xl:col-span-1">
          <TrafficSourcesChart />
        </SectionCard>

        <SectionCard
          title="Top Search Terms"
          subtitle="Keywords driving local discovery"
          action="View all"
          className="xl:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                  <th className="pb-3 pr-4 font-semibold">Keyword</th>
                  <th className="pb-3 pr-4 font-semibold">Current Position</th>
                  <th className="pb-3 pr-4 font-semibold">Search Volume</th>
                  <th className="pb-3 font-semibold">Monthly Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {searchTerms.map((row) => (
                  <tr key={row.keyword}>
                    <td className="py-4 pr-4 font-medium text-navy-900">{row.keyword}</td>
                    <td className="py-4 pr-4 font-semibold text-brand-600">{row.position}</td>
                    <td className="py-4 pr-4 text-slate-600">{row.volume}</td>
                    <td className="py-4">
                      <span
                        className={`font-semibold ${
                          row.change.startsWith("+")
                            ? "text-growth-500"
                            : row.change === "0"
                              ? "text-slate-500"
                              : "text-rose-500"
                        }`}
                      >
                        {row.change === "0" ? "No change" : `${row.change} positions`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Monthly Summary" subtitle="Executive overview of this month's results" className="lg:col-span-2">
          <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-5 ring-1 ring-brand-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.2 3.6L17 8l-3.6 1.2L12 13l-1.2-3.6L7 8l3.6-1.2L12 3Z" />
              </svg>
              AI Insights
            </span>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              <p>Your Google visibility increased 18% this month.</p>
              <p>Phone calls increased 27%.</p>
              <p>Your highest-performing keyword is Emergency Plumber.</p>
              <p className="font-medium text-navy-900">
                Recommendation: Publish two additional educational posts next month.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Download Report" subtitle="Share results with your team">
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
            <p className="text-sm leading-7 text-slate-600">
              Export a polished monthly performance report with visibility, customer actions,
              and keyword growth.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:bg-[#0B1426]"
            >
              Download Monthly Report
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
