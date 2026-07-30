import Link from "next/link";
import {
  formatSearchConsoleConnectionStatus,
  formatSearchConsoleSyncDate,
} from "@/lib/google-search-console/persistence";
import type { SearchConsoleDashboardData } from "@/lib/google-search-console/dashboard";

export function SearchConsolePage({ data }: { data: SearchConsoleDashboardData }) {
  const { status, contribution, emptyReason } = data;
  const connection = status.connection;
  const isConnected = status.connected && connection?.connection_status === "connected";

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Search Console
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
            Not connected yet. Once connected, the Growth Advisor will learn which searches
            bring people to your site — rising and declining queries, pages gaining or losing
            visibility, and search opportunities where you show up but aren&apos;t getting
            clicked. This becomes supporting evidence for weekly recommendations, never the
            sole driver.
          </p>
        </div>
        <Link
          href="/dashboard/search-console/connect"
          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Connect Search Console
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Search Console
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
            Search performance evidence for your Business Brain.
          </p>
        </div>
        <Link
          href="/dashboard/search-console/connect"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
        >
          Manage connection
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03]">
        <h2 className="text-base font-bold text-navy-900">Connection health</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Status</dt>
            <dd className="mt-1 text-sm font-semibold text-navy-900">
              {formatSearchConsoleConnectionStatus(connection?.connection_status ?? "not_connected")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Property</dt>
            <dd className="mt-1 text-sm font-semibold text-navy-900">
              {connection?.selected_site_url ?? "Not selected"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">Last synced</dt>
            <dd className="mt-1 text-sm font-semibold text-navy-900">
              {formatSearchConsoleSyncDate(connection?.last_synced_at)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/[0.03]">
        <h2 className="text-base font-bold text-navy-900">Contribution to the Business Brain</h2>
        {contribution ? (
          <ul className="mt-4 space-y-3">
            {contribution.map((item) => (
              <li key={item.title} className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
                <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm leading-7 text-text-muted">{emptyReason}</p>
        )}
      </section>
    </div>
  );
}
