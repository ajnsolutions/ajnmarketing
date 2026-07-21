"use client";

import { useState } from "react";
import type { StuckJobSummary } from "@/lib/ops-dashboard/jobLifecycle";

type StuckJobWithSafety = StuckJobSummary & { retrySafety: string };

const SAFETY_COPY: Record<string, { label: string; tone: string; needsConfirmation: boolean }> = {
  safe_and_idempotent: {
    label: "Safe to retry",
    tone: "bg-growth-50 text-growth-600 ring-emerald-100",
    needsConfirmation: false,
  },
  safe_with_deduplication: {
    label: "Safe (deduplicated)",
    tone: "bg-growth-50 text-growth-600 ring-emerald-100",
    needsConfirmation: false,
  },
  requires_operator_review: {
    label: "Requires operator review",
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
    needsConfirmation: true,
  },
  not_retryable: {
    label: "Not retryable",
    tone: "bg-slate-100 text-slate-600 ring-slate-200",
    needsConfirmation: true,
  },
};

export function StuckJobsPanel({ initialJobs }: { initialJobs: StuckJobWithSafety[] | null }) {
  const [jobs, setJobs] = useState(initialJobs ?? []);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function retry(job: StuckJobWithSafety, confirmOperatorReview: boolean) {
    setPendingId(job.id);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/admin/ops/jobs/${job.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmOperatorReview }),
      });
      const data = (await response.json()) as { retried?: boolean; error?: string; message?: string };
      if (!response.ok) {
        setStatusMessage(data.error ?? "Retry could not be completed.");
        return;
      }
      if (data.retried === false) {
        setStatusMessage(data.message ?? "Job was already retried.");
      } else {
        setStatusMessage(`Job ${job.id.slice(0, 8)}… queued for retry.`);
        setJobs((current) => current.filter((j) => j.id !== job.id));
      }
    } catch {
      setStatusMessage("Retry request failed. Please try again.");
    } finally {
      setPendingId(null);
      setConfirmingId(null);
    }
  }

  if (initialJobs === null) {
    return (
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
        <h2 className="text-base font-bold text-navy-900">Stuck jobs</h2>
        <p className="mt-2 text-sm text-amber-700">
          Job health unavailable — configure SUPABASE_SECRET_KEY.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold text-navy-900 sm:text-lg">Stuck jobs</h2>
        <p className="mt-1 text-sm text-text-muted">
          Queued 30+ minutes or running 15+ minutes without completing. Retry never runs
          automatically — every retry here is an explicit, confirmed operator action.
        </p>
      </div>

      {statusMessage && (
        <p role="status" aria-live="polite" className="px-5 pt-3 text-sm text-navy-900 sm:px-6">
          {statusMessage}
        </p>
      )}

      {jobs.length === 0 ? (
        <p className="px-5 py-6 text-sm text-text-muted sm:px-6">No stuck jobs detected.</p>
      ) : (
        <ul className="space-y-3 px-5 py-4 sm:px-6">
          {jobs.map((job) => {
            const safety = SAFETY_COPY[job.retrySafety] ?? SAFETY_COPY.requires_operator_review;
            const isConfirming = confirmingId === job.id;
            const isPending = pendingId === job.id;
            return (
              <li key={job.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-navy-900">{job.jobType}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${safety.tone}`}
                  >
                    {safety.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {job.reason === "queued_too_long" ? "Queued" : "Running"} for{" "}
                  {job.stuckSinceMinutes} minute(s) · {job.attempts} attempt(s) · job {job.id.slice(0, 8)}…
                </p>

                {job.retrySafety === "not_retryable" ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Not retryable from this panel — inspect directly before taking action.
                  </p>
                ) : isConfirming ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-amber-700">
                      Confirm: this job may have an external side effect. Retry only if you have
                      verified no duplicate work will occur.
                    </p>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => retry(job, true)}
                      className="hom-focusable min-h-11 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {isPending ? "Retrying…" : "Confirm retry"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setConfirmingId(null)}
                      className="hom-focusable min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      safety.needsConfirmation ? setConfirmingId(job.id) : retry(job, false)
                    }
                    className="hom-focusable mt-2 inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isPending ? "Retrying…" : "Retry"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
