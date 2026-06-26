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

function OpportunityBadge({ label }: { label: string }) {
  const styles =
    label === "High"
      ? "bg-growth-50 text-growth-500 ring-emerald-100"
      : label === "Medium"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {label}
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

function MarketScoreHero() {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Overall Market Opportunity
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <p className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
              86<span className="text-2xl font-semibold text-slate-400"> / 100</span>
            </p>
            <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-growth-500/15 px-3 py-1.5 text-sm font-semibold text-growth-500 ring-1 ring-emerald-400/20">
              High Opportunity
            </span>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Your market currently shows strong growth potential with several opportunities
            your competitors are not taking advantage of.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg viewBox="0 0 36 36" className="h-40 w-40 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#22C55E"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="86 100"
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-bold text-white">86</p>
              <p className="text-xs font-medium text-slate-400">Score</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchTrendsChart() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60 sm:p-5">
      <div className="mb-4 flex flex-wrap gap-4 text-xs font-medium text-text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Emergency Plumber
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-growth-500" />
          Water Heater Repair
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Drain Cleaning
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Leak Detection
        </span>
      </div>
      <svg viewBox="0 0 760 220" className="h-auto w-full" aria-hidden="true">
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="40" y1={y} x2="720" y2={y} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        <path d="M40 150 L98 142 L156 136 L214 128 L272 118 L330 108 L388 98 L446 88 L504 78 L562 68 L620 58 L678 48" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 160 L98 154 L156 148 L214 140 L272 132 L330 124 L388 116 L446 108 L504 100 L562 92 L620 84 L678 76" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 168 L98 164 L156 158 L214 152 L272 146 L330 140 L388 134 L446 128 L504 122 L562 116 L620 110 L678 104" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M40 176 L98 172 L156 168 L214 162 L272 156 L330 150 L388 144 L446 138 L504 132 L562 126 L620 120 L678 114" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
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

function MarketShareChart() {
  const segments = [
    { label: "Your Business", value: 28, color: "#2563EB" },
    { label: "Competitor A", value: 24, color: "#64748B" },
    { label: "Competitor B", value: 22, color: "#94A3B8" },
    { label: "Competitor C", value: 26, color: "#CBD5E1" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{ width: `${segment.value}%`, backgroundColor: segment.color }}
            title={segment.label}
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-sm font-medium text-navy-900">{segment.label}</span>
            </div>
            <span className="text-sm font-bold text-slate-600">{segment.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketContextPage() {
  const competitors = [
    { name: "ABC Plumbing", rating: "4.7", reviews: "96", posting: "Weekly", visibility: "High", opportunity: "Medium" },
    { name: "Rapid Rooter", rating: "4.8", reviews: "142", posting: "2x / week", visibility: "High", opportunity: "Low" },
    { name: "Smith Plumbing", rating: "4.5", reviews: "68", posting: "Monthly", visibility: "Medium", opportunity: "High" },
    { name: "Metro Plumbing", rating: "4.3", reviews: "41", posting: "Inactive", visibility: "Low", opportunity: "High" },
  ];

  const activity = [
    { text: "ABC Plumbing posted yesterday", tone: "blue" },
    { text: "Rapid Rooter gained 4 reviews", tone: "green" },
    { text: "Smith Plumbing updated service areas", tone: "blue" },
    { text: "Metro Plumbing inactive for 18 days", tone: "amber" },
  ];

  const events = [
    {
      title: "Summer Home Maintenance",
      score: "88",
      campaign: "Seasonal maintenance checklist post",
      date: "Publish by May 15",
    },
    {
      title: "Local Community Festival",
      score: "74",
      campaign: "Community sponsorship spotlight",
      date: "Publish by June 2",
    },
    {
      title: "Storm Season",
      score: "91",
      campaign: "Emergency plumbing readiness guide",
      date: "Publish by April 28",
    },
    {
      title: "Holiday Preparation",
      score: "69",
      campaign: "Pre-holiday home prep tips",
      date: "Publish by November 10",
    },
  ];

  const recommendations = [
    {
      title: "Publish a plumbing maintenance guide",
      priority: "High" as const,
      impact: "High visibility gain",
      effort: "Low effort",
    },
    {
      title: "Request reviews from recent customers",
      priority: "High" as const,
      impact: "Strong reputation boost",
      effort: "Low effort",
    },
    {
      title: "Create before-and-after photo posts",
      priority: "Medium" as const,
      impact: "Better trust signals",
      effort: "Medium effort",
    },
    {
      title: "Update Google Business Profile services",
      priority: "Medium" as const,
      impact: "Improved local relevance",
      effort: "Low effort",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Market Context
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            AI monitors your local market and competitors to uncover opportunities for growth.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Refresh Analysis
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:bg-[#0B1426] hover:-translate-y-0.5 hover:shadow-lg"
          >
            AI Strategy Report
          </button>
        </div>
      </div>

      <MarketScoreHero />

      <SectionCard title="AI Executive Summary" subtitle="What your AI strategist sees in the market right now">
        <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-5 ring-1 ring-brand-100">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.2 3.6L17 8l-3.6 1.2L12 13l-1.2-3.6L7 8l3.6-1.2L12 3Z" />
            </svg>
            AI Insights
          </span>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
            <p>Competitors are posting less frequently than recommended.</p>
            <p>Review activity has slowed across the market.</p>
            <p>Google searches for emergency plumbing continue to rise.</p>
            <p>
              Your business is positioned to gain market share by increasing educational
              content and responding to reviews within 24 hours.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Local Search Trends" subtitle="Demand signals across high-value local keywords">
        <SearchTrendsChart />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Competitor Snapshot"
          subtitle="How nearby businesses compare"
          action="View all"
          className="xl:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-text-muted">
                  <th className="pb-3 pr-4 font-semibold">Competitor</th>
                  <th className="pb-3 pr-4 font-semibold">Average Rating</th>
                  <th className="pb-3 pr-4 font-semibold">Reviews</th>
                  <th className="pb-3 pr-4 font-semibold">Posting Frequency</th>
                  <th className="pb-3 pr-4 font-semibold">Visibility</th>
                  <th className="pb-3 font-semibold">Opportunity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competitors.map((row) => (
                  <tr key={row.name}>
                    <td className="py-4 pr-4 font-medium text-navy-900">{row.name}</td>
                    <td className="py-4 pr-4 text-amber-500">★ {row.rating}</td>
                    <td className="py-4 pr-4 text-slate-600">{row.reviews}</td>
                    <td className="py-4 pr-4 text-slate-600">{row.posting}</td>
                    <td className="py-4 pr-4">
                      <span
                        className={`font-semibold ${
                          row.visibility === "High"
                            ? "text-growth-500"
                            : row.visibility === "Medium"
                              ? "text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {row.visibility}
                      </span>
                    </td>
                    <td className="py-4">
                      <OpportunityBadge label={row.opportunity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Market Share Estimate" subtitle="Estimated local visibility split">
          <MarketShareChart />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Competitor Activity" subtitle="Recent moves in your local market">
          <ol className="relative space-y-0">
            {activity.map((item, index) => (
              <li key={item.text} className="relative flex gap-4 pb-6 last:pb-0">
                {index < activity.length - 1 && (
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
                <p className="pt-0.5 text-sm font-medium text-navy-900">{item.text}</p>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Local Events & Seasonal Opportunities" subtitle="Timely campaigns worth acting on">
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <article
                key={event.title}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-navy-900">{event.title}</h3>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-600 ring-1 ring-brand-100">
                    {event.score}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{event.campaign}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-600">
                  {event.date}
                </p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="AI Recommendations" subtitle="Priority actions based on market intelligence" action="View all">
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-semibold text-navy-900">{item.title}</h3>
                <PriorityBadge priority={item.priority} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-growth-50 px-3 py-1 font-medium text-growth-600 ring-1 ring-emerald-100">
                  {item.impact}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
                  {item.effort}
                </span>
              </div>
              <button
                type="button"
                className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                Generate Content
              </button>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
