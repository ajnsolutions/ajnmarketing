const stats = [
  {
    value: "250+",
    label: "Local Businesses Supported",
    detail: "And growing every month",
    iconBg: "bg-growth-500 text-white",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    value: "10,000+",
    label: "Customer Interactions Generated",
    detail: "Calls, messages & direction requests",
    iconBg: "bg-brand-600 text-white",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-10M21 9v6h-6" />
      </svg>
    ),
  },
  {
    value: "4.9★",
    label: "Average Client Rating",
    detail: "Based on 128+ reviews",
    iconBg: "bg-growth-500 text-white",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 7.6 21.6l1.7-7.2-5.6-4.9 7.4-.6L12 2Z" />
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
