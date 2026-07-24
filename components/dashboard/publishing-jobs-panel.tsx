"use client";

import { useEffect, useState } from "react";
import {
  cancelPublishRequest,
  fetchPublishingHistory,
  fetchPublishingJobs,
  retryPublishRequest,
} from "@/lib/publishing-client";
import {
  canCancelPublishingJob,
  canRetryPublishingJob,
  formatPublishingHistoryDate,
  formatPublishingJobStatus,
  publishingJobStatusStyles,
} from "@/lib/publishing/publishingStatus";
import { publishingJobStatusGuide } from "@/lib/customer-ux/workflowPresentation";
import type { PublishingHistoryEntry, PublishingJob } from "@/lib/publishing/publishingTypes";
import { ProcessingNotice } from "@/components/dashboard/ui/page-chrome";

function PublishingHistoryBody({ jobId }: { jobId: string }) {
  const [history, setHistory] = useState<PublishingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchPublishingHistory(jobId).then(({ history: entries, error: fetchError }) => {
      if (cancelled) return;
      setHistory(entries);
      setError(fetchError ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (loading) {
    return (
      <ProcessingNotice
        label="Loading recent publishing activity…"
        hint="This usually takes a second."
      />
    );
  }
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (history.length === 0) {
    return <p className="text-sm text-text-muted">No history entries yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {history.map((entry) => (
        <li key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
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
  );
}

export function PublishingHistoryDrawer({
  job,
  open,
  onClose,
}: {
  job: PublishingJob | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publishing-history-title"
        className="flex h-full w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="publishing-history-title" className="text-lg font-bold text-navy-900">
              Publishing history
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {formatPublishingJobStatus(job.status)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-navy-900"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PublishingHistoryBody key={job.id} jobId={job.id} />
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
        className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900"
      >
        View history
      </button>
      {canRetryPublishingJob(job.status) && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void runRetry()}
          className="hom-focusable inline-flex min-h-11 items-center rounded-full bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "retry" ? "Retrying…" : "Retry publish"}
        </button>
      )}
      {canCancelPublishingJob(job.status) && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void runCancel()}
          className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 disabled:opacity-60"
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      )}
      {busy ? (
        <div className="w-full">
          <ProcessingNotice
            label={busy === "retry" ? "Starting retry…" : "Cancelling…"}
            hint="Please wait a moment."
          />
        </div>
      ) : null}
      {error && <p className="w-full text-sm text-rose-600">{error}</p>}
    </div>
  );
}

export function PublishingJobsPanel({
  initialJobs,
}: {
  initialJobs: PublishingJob[];
}) {
  const [refreshedJobs, setRefreshedJobs] = useState<PublishingJob[] | null>(null);
  const [baselineJobs, setBaselineJobs] = useState(initialJobs);
  const [historyJob, setHistoryJob] = useState<PublishingJob | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Adjust local override when the server-rendered baseline changes (React-approved render-time sync).
  if (baselineJobs !== initialJobs) {
    setBaselineJobs(initialJobs);
    setRefreshedJobs(null);
  }

  const jobs = refreshedJobs ?? initialJobs;

  async function refreshJobs() {
    setRefreshing(true);
    setRefreshError(null);

    try {
      const { jobs: nextJobs, error } = await fetchPublishingJobs();

      if (error) {
        setRefreshError(error);
        return;
      }

      setRefreshedJobs(nextJobs);
      setLastRefreshedAt(new Date().toISOString());
    } catch {
      setRefreshError("Unable to refresh publishing activity. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  const grouped = {
    active: jobs.filter((job) =>
      ["queued", "scheduled", "publishing", "retrying"].includes(job.status)
    ),
    published: jobs.filter((job) => ["published", "verified"].includes(job.status)),
    failed: jobs.filter((job) => job.status === "failed"),
  };

  function renderJob(job: PublishingJob) {
    const guide = publishingJobStatusGuide(job.status);
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
          {String(job.metadata.title ?? "Publishing update")}
        </p>
        <p className="mt-2 text-xs leading-5 text-text-muted" role="note">
          <span className="font-semibold text-navy-900">What’s happening: </span>
          {guide.happening}{" "}
          <span className="font-semibold text-navy-900">Do you need to act? </span>
          {guide.needAction}{" "}
          <span className="font-semibold text-navy-900">Next: </span>
          {guide.next}
        </p>
        <div className="mt-2 space-y-1 text-xs text-text-muted">
          {job.scheduled_for && <p>Scheduled: {formatPublishingHistoryDate(job.scheduled_for)}</p>}
          {job.published_at && <p>Published: {formatPublishingHistoryDate(job.published_at)}</p>}
          {job.last_error && <p className="text-rose-600">{job.last_error}</p>}
          {job.retry_count > 0 && <p>Retries so far: {job.retry_count}</p>}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Live publishing activity</h2>
          <p className="mt-1 text-sm text-text-muted">
            Plain-language status for each update on its way out — including retries when something
            needs a second try.
          </p>
          {lastRefreshedAt && !refreshError && (
            <p className="mt-2 text-xs font-medium text-growth-500">
              Refreshed {formatPublishingHistoryDate(lastRefreshedAt)}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void refreshJobs()}
          className="hom-focusable inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
            />
          )}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {refreshError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          {refreshError}
        </p>
      )}

      {refreshing && !refreshError ? (
        <ProcessingNotice
          label="Refreshing publishing activity…"
          hint="Hang tight — this is a quick check, not a long wait."
        />
      ) : null}

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-navy-900">No live publishing activity yet</p>
          <p className="mt-2 text-sm text-text-muted">
            When you publish or schedule an approved item, its progress will show here in plain
            language.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.active.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
                In progress
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">{grouped.active.map(renderJob)}</div>
            </div>
          )}
          {grouped.failed.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
                Needs a retry
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">{grouped.failed.map(renderJob)}</div>
            </div>
          )}
          {grouped.published.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
                Published successfully
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
