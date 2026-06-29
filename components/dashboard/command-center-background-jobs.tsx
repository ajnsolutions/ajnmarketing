"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { patchBackgroundJob } from "@/lib/background-jobs/client";
import {
  BACKGROUND_JOB_TYPE_LABELS,
  type BackgroundJobDashboardData,
} from "@/lib/background-jobs/types";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-amber-50 text-amber-700 ring-amber-100",
    running: "bg-brand-50 text-brand-600 ring-brand-100",
    completed: "bg-growth-50 text-growth-500 ring-emerald-100",
    failed: "bg-rose-50 text-rose-600 ring-rose-100",
    cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ${styles[status] ?? styles.queued}`}
    >
      {status}
    </span>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-navy-900">{value}</p>
    </div>
  );
}

export function CommandCenterBackgroundJobs({
  data,
}: {
  data: BackgroundJobDashboardData;
}) {
  const router = useRouter();
  const hasActiveJobs = data.counts.queued + data.counts.running > 0;

  useEffect(() => {
    if (!hasActiveJobs) return;

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [hasActiveJobs, router]);

  async function handleRetry(jobId: string) {
    await patchBackgroundJob({ id: jobId, action: "retry" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CountCard label="Queued" value={data.counts.queued} />
        <CountCard label="Running" value={data.counts.running} />
        <CountCard label="Failed" value={data.counts.failed} />
        <CountCard label="Completed" value={data.counts.completed} />
      </div>

      {data.recent.length === 0 ? (
        <p className="text-sm text-text-muted">
          Background jobs will appear here when you queue website analysis, marketing plans, content
          generation, Google sync, or other async work.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.recent.map((job) => (
            <li
              key={job.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-navy-900">
                    {BACKGROUND_JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                  </p>
                  <StatusBadge status={job.status} />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {new Date(job.created_at).toLocaleString()}
                  {job.attempts > 0 ? ` · Attempt ${job.attempts}` : ""}
                </p>
                {job.error && (
                  <p className="mt-2 text-sm text-rose-600">{job.error}</p>
                )}
              </div>
              {job.status === "failed" && (
                <button
                  type="button"
                  onClick={() => void handleRetry(job.id)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  Retry
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
