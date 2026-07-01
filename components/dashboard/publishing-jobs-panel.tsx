"use client";

import { useEffect, useState } from "react";
import {
  cancelPublishRequest,
  fetchPublishingHistory,
  retryPublishRequest,
} from "@/lib/publishing-client";
import {
  canCancelPublishingJob,
  canRetryPublishingJob,
  formatPublishingHistoryDate,
  formatPublishingJobStatus,
  publishingJobStatusStyles,
} from "@/lib/publishing/publishingStatus";
import type { PublishingHistoryEntry, PublishingJob } from "@/lib/publishing/publishingTypes";

export function PublishingHistoryDrawer({
  job,
  open,
  onClose,
}: {
  job: PublishingJob | null;
  open: boolean;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<PublishingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !job) return;

    setLoading(true);
    setError(null);

    void fetchPublishingHistory(job.id).then(({ history: entries, error: fetchError }) => {
      setHistory(entries);
      setError(fetchError ?? null);
      setLoading(false);
    });
  }, [open, job]);

  if (!open || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 p-4">
      <div className="flex h-full w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Publishing History</h2>
            <p className="mt-1 text-sm text-text-muted">
              Job {job.id.slice(0, 8)} · {formatPublishingJobStatus(job.status)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-navy-900"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-text-muted">Loading history...</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!loading && history.length === 0 && (
            <p className="text-sm text-text-muted">No history entries yet.</p>
          )}
          <ul className="space-y-3">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold capitalize text-navy-900">
                    {entry.action.replace(/_/g, " ")}
                  </p>
                  <span className="text-xs text-text-muted">
                    {formatPublishingHistoryDate(entry.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Status: {formatPublishingJobStatus(entry.status)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function JobActions({
  job,
  onUpdated,
  onShowHistory,
}: {
  job: PublishingJob;
  onUpdated: () => void;
  onShowHistory: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runRetry() {
    setBusy("retry");
    setError(null);
    const { error: retryError } = await retryPublishRequest(job.id);
    setBusy(null);
    if (retryError) {
      setError(retryError);
      return;
    }
    onUpdated();
  }

  async function runCancel() {
    setBusy("cancel");
    setError(null);
    const { error: cancelError } = await cancelPublishRequest(job.id);
    setBusy(null);
    if (cancelError) {
      setError(cancelError);
      return;
    }
    onUpdated();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onShowHistory}
        className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900"
      >
        History
      </button>
      {canRetryPublishingJob(job.status) && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void runRetry()}
          className="rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "retry" ? "Retrying..." : "Retry"}
        </button>
      )}
      {canCancelPublishingJob(job.status) && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void runCancel()}
          className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 disabled:opacity-60"
        >
          {busy === "cancel" ? "Cancelling..." : "Cancel"}
        </button>
      )}
      {error && <p className="w-full text-sm text-rose-600">{error}</p>}
    </div>
  );
}

export function PublishingJobsPanel({
  initialJobs,
}: {
  initialJobs: PublishingJob[];
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [historyJob, setHistoryJob] = useState<PublishingJob | null>(null);

  async function refreshJobs() {
    const response = await fetch("/api/publishing");
    const payload = (await response.json()) as { jobs?: PublishingJob[] };
    setJobs(payload.jobs ?? []);
  }

  const grouped = {
    active: jobs.filter((job) =>
      ["queued", "scheduled", "publishing", "retrying"].includes(job.status)
    ),
    published: jobs.filter((job) => ["published", "verified"].includes(job.status)),
    failed: jobs.filter((job) => job.status === "failed"),
  };

  function renderJob(job: PublishingJob) {
    return (
      <article
        key={job.id}
        className="rounded-xl border border-slate-100 bg-white p-5 ring-1 ring-slate-200/60"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${publishingJobStatusStyles(job.status)}`}
          >
            {formatPublishingJobStatus(job.status)}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {job.provider.replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold text-navy-900">
          {String(job.metadata.title ?? "Publishing job")}
        </p>
        <div className="mt-2 space-y-1 text-xs text-text-muted">
          <p>Queue item: {job.content_id.slice(0, 8)}</p>
          {job.scheduled_for && <p>Scheduled: {formatPublishingHistoryDate(job.scheduled_for)}</p>}
          {job.published_at && <p>Published: {formatPublishingHistoryDate(job.published_at)}</p>}
          {job.provider_post_id && <p>Provider post: {job.provider_post_id}</p>}
          {job.last_error && <p className="text-rose-600">{job.last_error}</p>}
          {job.retry_count > 0 && <p>Retries: {job.retry_count}</p>}
        </div>
        <div className="mt-4">
          <JobActions
            job={job}
            onUpdated={() => void refreshJobs()}
            onShowHistory={() => setHistoryJob(job)}
          />
        </div>
      </article>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Publishing Engine Jobs</h2>
          <p className="mt-1 text-sm text-text-muted">
            Autonomous publishing jobs with retries, verification, and audit history. Google
            Business Profile is supported today.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshJobs()}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900"
        >
          Refresh Jobs
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-text-muted">
            No publishing engine jobs yet. Use Publish Now on a queue item to start autonomous
            publishing.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.active.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
                Active Jobs
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">{grouped.active.map(renderJob)}</div>
            </div>
          )}
          {grouped.failed.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Failed</h3>
              <div className="grid gap-4 lg:grid-cols-2">{grouped.failed.map(renderJob)}</div>
            </div>
          )}
          {grouped.published.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
                Published / Verified
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">{grouped.published.map(renderJob)}</div>
            </div>
          )}
        </div>
      )}

      <PublishingHistoryDrawer
        job={historyJob}
        open={Boolean(historyJob)}
        onClose={() => setHistoryJob(null)}
      />
    </section>
  );
}
