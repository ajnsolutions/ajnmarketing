import type { AdminExecutiveOverview } from "@/lib/head-of-marketing-orchestrator/adminOverview";

function BusinessList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: { businessProfileId: string; businessName: string; reason: string }[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.03]">
      <h2 className="text-base font-bold text-navy-900">
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.businessProfileId} className="text-sm leading-6">
              <span className="font-semibold text-navy-900">{item.businessName}</span>
              <span className="text-text-muted"> — {item.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Admin Executive Overview (Part 8) — the same orchestrator building blocks
 * used for a single business's Executive Review, rolled up across every
 * tenant: which businesses need attention, which are doing well, where
 * confidence is thin, and which opportunities have sat unaddressed too long.
 */
export function AdminExecutiveOverviewDashboard({ overview }: { overview: AdminExecutiveOverview }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Admin</p>
        <h1 className="mt-2 text-2xl font-bold text-navy-900">Executive Overview</h1>
        <p className="mt-2 text-sm text-text-muted">
          Generated {new Date(overview.generatedAt).toLocaleString()}. Reuses each business&apos;s already-computed
          operational health and already-detected opportunities — nothing here re-runs a provider.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <BusinessList
          title="Needs attention"
          emptyText="No businesses currently need attention."
          items={overview.businessesNeedingAttention}
        />
        <BusinessList
          title="Doing well"
          emptyText="No businesses are fully healthy across every dimension yet."
          items={overview.businessesDoingWell}
        />
        <BusinessList
          title="Confidence gaps"
          emptyText="No confidence gaps detected."
          items={overview.confidenceGaps}
        />
        <section className="rounded-xl border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.03]">
          <h2 className="text-base font-bold text-navy-900">
            Stalled opportunities ({overview.stalledOpportunities.length})
          </h2>
          {overview.stalledOpportunities.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No stalled opportunities.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {overview.stalledOpportunities.map((item) => (
                <li key={item.opportunityId} className="text-sm leading-6">
                  <span className="font-semibold text-navy-900">{item.businessName}</span>
                  <span className="text-text-muted">
                    {" "}
                    — {item.statement} (active {item.daysActive} days)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
