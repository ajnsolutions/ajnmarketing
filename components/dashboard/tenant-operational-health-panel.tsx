"use client";

import { useState, useTransition } from "react";
import type { TenantHealthPage, TenantHealthSnapshot } from "@/lib/ops-dashboard/tenantHealth";

const STATE_TONE: Record<string, string> = {
  healthy: "bg-growth-50 text-growth-600 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  blocked: "bg-rose-50 text-rose-600 ring-rose-100",
  unavailable: "bg-slate-100 text-slate-600 ring-slate-200",
  intentionally_unused: "bg-slate-100 text-slate-600 ring-slate-200",
  unknown: "bg-slate-100 text-slate-600 ring-slate-200",
};

function StatePill({ state }: { state: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATE_TONE[state] ?? STATE_TONE.unknown}`}
    >
      {state.replace(/_/g, " ")}
    </span>
  );
}

function TenantCard({ tenant }: { tenant: TenantHealthSnapshot }) {
  return (
    <li className="rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy-900">{tenant.businessName}</p>
        <StatePill state={tenant.overallState} />
      </div>
      <p className="mt-1 text-xs text-text-muted">
        {tenant.onboardingCompleted ? "Onboarded" : "Onboarding incomplete"} · joined{" "}
        {new Date(tenant.createdAt).toLocaleDateString()}
      </p>
      <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {tenant.dimensions.map((dim) => (
          <div key={dim.key} className="flex items-center justify-between gap-2 text-xs text-text-muted">
            <span>{dim.label}</span>
            <StatePill state={dim.state} />
          </div>
        ))}
      </dl>
    </li>
  );
}

export function TenantOperationalHealthPanel({
  initialPage,
}: {
  initialPage: TenantHealthPage | null;
}) {
  const [data, setData] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function loadPage(page: number, q?: string) {
    startTransition(async () => {
      setError(null);
      try {
        const params = new URLSearchParams({ view: "tenants", page: String(page), pageSize: "20" });
        if (q?.trim()) params.set("q", q.trim());
        const response = await fetch(`/api/admin/ops?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to load tenants.");
        setData((await response.json()) as TenantHealthPage);
      } catch {
        setError("Unable to load tenant health right now.");
      }
    });
  }

  if (!data) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
        <h2 className="text-base font-bold text-navy-900">Tenant operational health</h2>
        <p className="mt-2 text-sm text-amber-700">
          Tenant health unavailable — configure SUPABASE_SECRET_KEY.
        </p>
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold text-navy-900 sm:text-lg">Tenant operational health</h2>
        <p className="mt-1 text-sm text-text-muted">
          Google Business disconnected or unused is shown as optional, not a failure. Analytics
          and publishing state is bounded to this page of tenants only.
        </p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            loadPage(1, search);
          }}
        >
          <label htmlFor="tenant-search" className="sr-only">
            Search tenants by business name
          </label>
          <input
            id="tenant-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by business name…"
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-navy-900"
          />
          <button
            type="submit"
            disabled={isPending}
            className="hom-focusable min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="px-5 pt-3 text-sm text-rose-700 sm:px-6">
          {error}
        </p>
      )}

      {data.tenants.length === 0 ? (
        <p className="px-5 py-6 text-sm text-text-muted sm:px-6">
          {search ? "No tenants match that search." : "No tenants found."}
        </p>
      ) : (
        <ul className="space-y-3 px-5 py-4 sm:px-6">
          {data.tenants.map((tenant) => (
            <TenantCard key={tenant.businessProfileId} tenant={tenant} />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-text-muted sm:px-6">
        <span>
          Page {data.page} of {totalPages} · {data.totalCount} tenant(s)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending || data.page <= 1}
            onClick={() => loadPage(data.page - 1, search)}
            className="hom-focusable min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={isPending || data.page >= totalPages}
            onClick={() => loadPage(data.page + 1, search)}
            className="hom-focusable min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
