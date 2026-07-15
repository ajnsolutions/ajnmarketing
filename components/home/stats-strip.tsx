const stats = [
  {
    value: "Weekly",
    label: "Approval by email or text",
    detail: "Nothing publishes without your OK",
    iconBg: "bg-growth-500 text-white",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" />
      </svg>
    ),
  },
  {
    value: "Google",
    label: "Business Profile focus",
    detail: "Listings, reviews, and local posts",
    iconBg: "bg-brand-600 text-white",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    value: "90-day",
    label: "Visibility guarantee",
    detail: "If Google visibility doesn’t improve, you don’t pay",
    iconBg: "bg-growth-500 text-white",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
  },
] as const;

export function StatsStrip() {
  return (
    <section className="bg-deep-navy">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
        <div className="grid gap-10 md:grid-cols-3 md:gap-0">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex gap-4 md:px-8 ${
                index > 0 ? "md:border-l md:border-white/10" : ""
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${stat.iconBg}`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm text-slate-400">{stat.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
