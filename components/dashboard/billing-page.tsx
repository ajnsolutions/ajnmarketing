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

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-navy-900">{label}</span>
        <span className="text-text-muted">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BillingPage() {
  const plans = [
    {
      name: "Starter",
      price: "$99",
      description: "Essential local visibility for one location.",
      features: ["8 GBP posts/month", "Review monitoring", "Basic analytics"],
      current: false,
    },
    {
      name: "Growth",
      price: "$199",
      description: "Full AI marketing for growing local businesses.",
      features: [
        "16 GBP posts/month",
        "AI content + approvals",
        "Market Context scans",
        "Review reply drafts",
      ],
      current: true,
    },
    {
      name: "Pro",
      price: "$299",
      description: "Maximum reach with multi-channel publishing.",
      features: [
        "Unlimited GBP posts",
        "Social + email campaigns",
        "Priority AI support",
        "Advanced market intelligence",
      ],
      current: false,
    },
  ];

  const history = [
    { date: "May 20, 2026", description: "Growth Plan — Monthly", amount: "$199.00", status: "Paid" },
    { date: "Apr 20, 2026", description: "Growth Plan — Monthly", amount: "$199.00", status: "Paid" },
    { date: "Mar 20, 2026", description: "Growth Plan — Monthly", amount: "$199.00", status: "Paid" },
    { date: "Feb 20, 2026", description: "Starter Plan — Monthly", amount: "$99.00", status: "Paid" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Billing</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Manage your plan, payment method, and billing history.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            Change Plan
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Update Payment Method
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] lg:col-span-2 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Current Plan
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Growth Plan
              </h2>
              <p className="mt-2 text-lg font-semibold text-slate-300">
                $199<span className="text-base font-medium text-slate-400">/month</span>
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-growth-500/15 px-3 py-1.5 text-sm font-semibold text-growth-500 ring-1 ring-emerald-400/20">
              Active
            </span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Next billing date
              </p>
              <p className="mt-2 text-lg font-semibold text-white">June 20, 2026</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Billing cycle
              </p>
              <p className="mt-2 text-lg font-semibold text-white">Monthly</p>
            </div>
          </div>
        </section>

        <SectionCard title="Payment Method" subtitle="Default card on file">
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600 ring-1 ring-brand-100">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16v8H4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 11h16M8 15h3" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-navy-900">Visa ending in 4242</p>
                <p className="mt-1 text-sm text-text-muted">Expires 08/2028</p>
                <p className="mt-2 text-sm text-text-muted">Mike Reynolds · Riverside Plumbing Co.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Update Payment Method
          </button>
        </SectionCard>
      </div>

      <SectionCard title="Usage Summary" subtitle="Current billing period — resets June 20">
        <div className="grid gap-6 sm:grid-cols-2">
          <UsageMeter label="Google Business Profile posts" used={12} limit={16} />
          <UsageMeter label="AI-generated content" used={18} limit={24} />
          <UsageMeter label="Review replies" used={9} limit={20} />
          <UsageMeter label="Market scans" used={4} limit={8} />
        </div>
      </SectionCard>

      <SectionCard title="Compare Plans" subtitle="Choose the plan that fits your growth goals">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-xl border p-5 ring-1 ${
                plan.current
                  ? "border-brand-200 bg-brand-50/40 ring-brand-100"
                  : "border-slate-100 bg-[#F8FAFC] ring-slate-200/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-navy-900">{plan.name}</h3>
                  <p className="mt-1 text-2xl font-bold text-brand-600">
                    {plan.price}
                    <span className="text-sm font-medium text-text-muted">/month</span>
                  </p>
                </div>
                {plan.current && (
                  <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-navy-900">
                    <span className="mt-0.5 text-growth-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`mt-5 w-full rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
                  plan.current
                    ? "cursor-default border border-brand-200 bg-white text-brand-600"
                    : "bg-brand-600 text-white hover:bg-brand-700"
                }`}
              >
                {plan.current ? "Current Plan" : "Switch Plan"}
              </button>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Billing History" subtitle="Download past invoices anytime" action="View all">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="pb-3 pr-4 font-semibold">Date</th>
                <th className="pb-3 pr-4 font-semibold">Description</th>
                <th className="pb-3 pr-4 font-semibold">Amount</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.date} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 pr-4 font-medium text-navy-900">{row.date}</td>
                  <td className="py-4 pr-4 text-slate-600">{row.description}</td>
                  <td className="py-4 pr-4 font-semibold text-navy-900">{row.amount}</td>
                  <td className="py-4 pr-4">
                    <span className="rounded-full bg-growth-50 px-2.5 py-1 text-[11px] font-semibold text-growth-500 ring-1 ring-emerald-100">
                      {row.status}
                    </span>
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                    >
                      Download Invoice
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
