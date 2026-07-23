"use client";

import { useState } from "react";
import type { ProductionReadinessSummary, ReadinessItem } from "@/lib/production-readiness/types";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  ready: { label: "Ready", tone: "bg-growth-50 text-growth-600 ring-emerald-100" },
  ready_with_warnings: { label: "Ready with warnings", tone: "bg-amber-50 text-amber-700 ring-amber-100" },
  needs_attention: { label: "Needs attention", tone: "bg-amber-50 text-amber-700 ring-amber-100" },
  blocked: { label: "Blocked", tone: "bg-rose-50 text-rose-600 ring-rose-100" },
  not_configured: { label: "Not configured", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  degraded: { label: "Degraded", tone: "bg-amber-50 text-amber-700 ring-amber-100" },
  unknown: { label: "Unknown", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  intentionally_disabled: { label: "Intentionally disabled", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
};

function StatusPill({ status }: { status: string }) {
  const entry = STATUS_LABELS[status] ?? { label: status, tone: "bg-slate-100 text-slate-600 ring-slate-200" };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${entry.tone}`}
    >
      {entry.label}
    </span>
  );
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  return (
    <li className="rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy-900">{item.label}</p>
        <StatusPill status={item.status} />
      </div>
      <p className="mt-1 text-sm text-text-muted">{item.reason}</p>
      <dl className="mt-2 grid gap-1 text-xs text-text-muted sm:grid-cols-2">
        <div>Impact: {item.impact}</div>
        <div>Recovery: {item.recoveryAction}</div>
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {item.blocksPilot && <span className="font-semibold text-rose-600">Blocks pilot</span>}
        {item.blocksScheduleActivation && (
          <span className="font-semibold text-rose-600">Blocks schedule activation</span>
        )}
        {item.runbookRef && (
          <span>
            Runbook: <code className="text-[11px]">{item.runbookRef}</code>
          </span>
        )}
        <span>Checked {new Date(item.lastCheckedAt).toLocaleString()}</span>
      </div>
    </li>
  );
}

export function ProductionReadinessPanel({
  initialSummary,
}: {
  initialSummary: ProductionReadinessSummary | null;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function revalidate() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/ops?view=readiness");
      if (!response.ok) throw new Error("Revalidation failed.");
      const data = (await response.json()) as ProductionReadinessSummary;
      setSummary(data);
      setMessage("Readiness revalidated.");
    } catch {
      setMessage("Unable to revalidate readiness right now.");
    } finally {
      setPending(false);
    }
  }

  if (!summary) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
        <h2 className="text-base font-bold text-navy-900">Production readiness</h2>
        <p className="mt-2 text-sm text-amber-700">
          Readiness summary unavailable — configure SUPABASE_SECRET_KEY.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold text-navy-900 sm:text-lg">Production readiness</h2>
          <p className="mt-1 text-sm text-text-muted">
            Last validated {new Date(summary.generatedAt).toLocaleString()}. Composed from existing
            health checks, configuration, and migration state — never a second scoring model.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={summary.overallStatus} />
          <button
            type="button"
            disabled={pending}
            onClick={revalidate}
            className="hom-focusable mt-1 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-navy-900 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? "Revalidating…" : "Revalidate now"}
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="px-5 pt-3 text-xs text-text-muted sm:px-6">
          {message}
        </p>
      )}
      {summary.blockers.length > 0 && (
        <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 sm:mx-6" role="alert">
          <p className="text-sm font-semibold text-rose-700">
            {summary.blockers.length} pilot activation blocker(s)
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-rose-700">
            {summary.blockers.map((b) => (
              <li key={b.key}>{b.label}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-3 px-5 py-4 sm:px-6">
        {summary.items.map((item) => (
          <ReadinessRow key={item.key} item={item} />
        ))}
      </ul>
    </section>
  );
}
