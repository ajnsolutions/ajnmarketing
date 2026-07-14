"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AssistedPilotDashboardData, PilotBusinessSummary } from "@/lib/assisted-pilot/types";
import { PilotManualActionKeys } from "@/lib/assisted-pilot/types";

function StatusPill({ status }: { status: string }) {
  const ring =
    status === "completed" || status === "healthy" || status === "success" || status === "active"
      ? "bg-growth-50 text-growth-600 ring-emerald-100"
      : status === "running" || status === "warning" || status === "in_progress"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : status === "pending" || status === "paused"
          ? "bg-slate-100 text-slate-600 ring-slate-200"
          : "bg-rose-50 text-rose-600 ring-rose-100";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${ring}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const MANUAL_ACTIONS: Array<{ key: string; label: string }> = [
  { key: PilotManualActionKeys.WEBSITE_ANALYSIS, label: "Website analysis" },
  { key: PilotManualActionKeys.RECOMMENDATION_GENERATION, label: "Recommendation generation" },
  { key: PilotManualActionKeys.WEEKLY_PACKAGE, label: "Weekly package" },
  { key: PilotManualActionKeys.PUBLISHING, label: "Publishing (job id)" },
  { key: PilotManualActionKeys.ANALYTICS_CAPTURE, label: "Analytics capture" },
  { key: PilotManualActionKeys.OUTCOME_RECONCILIATION, label: "Outcome reconciliation" },
  { key: PilotManualActionKeys.HEALTH_REFRESH, label: "Health refresh" },
];

export function AssistedPilotPanel({ data }: { data: AssistedPilotDashboardData }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPilotId, setSelectedPilotId] = useState(data.pilots[0]?.id ?? "");
  const [publishingJobId, setPublishingJobId] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  async function postAction(body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/pilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string; result?: string; durationMs?: number | null };
    if (!res.ok) {
      setError(json.error ?? "Request failed");
      return null;
    }
    router.refresh();
    return json;
  }

  async function runManual(actionKey: string) {
    if (!selectedPilotId) {
      setError("Select a pilot business first.");
      return;
    }
    setBusyKey(actionKey);
    const json = await postAction({
      action: "manual_action",
      pilotBusinessId: selectedPilotId,
      actionKey,
      publishingJobId: publishingJobId || undefined,
    });
    setBusyKey(null);
    if (json) {
      setMessage(
        `${actionKey}: ${json.result ?? "ok"}${
          json.durationMs != null ? ` (${json.durationMs}ms)` : ""
        }`
      );
    }
  }

  async function createIssue() {
    if (!issueDescription.trim()) return;
    setBusyKey("create_issue");
    const json = await postAction({
      action: "create_issue",
      pilotBusinessId: selectedPilotId || null,
      severity: "medium",
      category: "operational",
      description: issueDescription.trim(),
    });
    setBusyKey(null);
    if (json) {
      setIssueDescription("");
      setMessage("Issue recorded.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-navy-900 sm:text-lg">Assisted Pilot</h2>
          <p className="mt-1 text-sm text-text-muted">
            Manual operation for owned businesses. Cron gate{" "}
            <span className="font-semibold text-navy-900">
              {data.scheduleGateOpen ? "OPEN" : "CLOSED"}
            </span>
            . Advisory launch recommendation:{" "}
            <span className="font-semibold text-navy-900">{data.launchRecommendation}</span>
            {" · "}
            readiness {data.aggregateReadiness.total}/100.
          </p>
        </div>
      </div>

      {(message || error) && (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            error
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-growth-50 text-growth-600"
          }`}
        >
          {error ?? message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 p-4 lg:col-span-1">
          <h3 className="text-sm font-bold text-navy-900">Launch readiness</h3>
          <p className="mt-2 text-3xl font-bold text-navy-900">{data.aggregateReadiness.total}</p>
          <p className="mt-1 text-sm text-text-muted">{data.launchRecommendation}</p>
          <ul className="mt-3 space-y-1 text-xs text-text-muted">
            {data.aggregateReadiness.dimensions.map((d) => (
              <li key={d.key} className="flex justify-between gap-2">
                <span>{d.label}</span>
                <span className="font-semibold text-navy-900">{d.score}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-navy-900">Manual operations console</h3>
          <p className="mt-1 text-xs text-text-muted">
            Reuses existing services/admin triggers. Never activates schedules or auto-approves.
          </p>
          <label className="mt-3 block text-xs font-semibold text-text-muted">
            Pilot business
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-900"
              value={selectedPilotId}
              onChange={(e) => setSelectedPilotId(e.target.value)}
            >
              <option value="">Select…</option>
              {data.pilots.map((pilot) => (
                <option key={pilot.id} value={pilot.id}>
                  {pilot.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold text-text-muted">
            Publishing job id (only for Publishing action)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={publishingJobId}
              onChange={(e) => setPublishingJobId(e.target.value)}
              placeholder="uuid"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {MANUAL_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={!!busyKey}
                onClick={() => void runManual(action.key)}
                className="rounded-full bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {busyKey === action.key ? "Running…" : action.label}
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.pilots.length === 0 ? (
          <p className="text-sm text-text-muted xl:col-span-2">
            No pilot businesses registered yet. Use the API action{" "}
            <code className="text-xs">register_pilot</code> with MySafetyTeam / Sunspots profile ids
            after migration <code className="text-xs">023_assisted_pilot_framework</code>.
          </p>
        ) : (
          data.pilots.map((pilot) => <PilotCard key={pilot.id} pilot={pilot} />)
        )}
      </div>

      <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-navy-900">Issue tracker</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Describe an internal pilot issue…"
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
          />
          <button
            type="button"
            disabled={!!busyKey}
            onClick={() => void createIssue()}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-navy-900"
          >
            Log issue
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {data.openIssues.length === 0 ? (
            <p className="text-sm text-text-muted">No open issues.</p>
          ) : (
            data.openIssues.map((issue) => (
              <div key={issue.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={issue.severity} />
                  <StatusPill status={issue.category} />
                  <StatusPill status={issue.status} />
                </div>
                <p className="mt-1 text-sm text-navy-900">{issue.description}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PilotCard({ pilot }: { pilot: PilotBusinessSummary }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-navy-900">{pilot.displayName}</h3>
          <p className="mt-1 text-xs text-text-muted">
            Cycle {pilot.currentCycle} · started {pilot.startDate}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill status={pilot.status} />
          <StatusPill status={pilot.currentHealth} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
        <div>Completion: {pilot.completionPercentage}%</div>
        <div>Manual remaining: {pilot.manualActionsRemaining}</div>
        <div>Issues: {pilot.outstandingIssueCount}</div>
        <div>Readiness: {pilot.readiness.total}</div>
        <div>Last recs: {pilot.lastRecommendationRunAt ? new Date(pilot.lastRecommendationRunAt).toLocaleString() : "—"}</div>
        <div>Last package: {pilot.lastApprovalPackageAt ? new Date(pilot.lastApprovalPackageAt).toLocaleString() : "—"}</div>
        <div>Last approval: {pilot.lastApprovalAt ? new Date(pilot.lastApprovalAt).toLocaleString() : "—"}</div>
        <div>Last publish: {pilot.lastPublishAt ? new Date(pilot.lastPublishAt).toLocaleString() : "—"}</div>
        <div>Last analytics: {pilot.lastAnalyticsCaptureAt ? new Date(pilot.lastAnalyticsCaptureAt).toLocaleString() : "—"}</div>
        <div>Approval rate: {(pilot.metrics.approvalRate * 100).toFixed(0)}%</div>
      </dl>

      <div className="mt-3 space-y-1">
        {pilot.checklist.map((item) => (
          <div key={item.stageKey} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-text-muted">{item.label}</span>
            <StatusPill status={item.status} />
          </div>
        ))}
      </div>

      {pilot.recentManualRuns.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-navy-900">Recent manual runs</p>
          <ul className="mt-1 space-y-1 text-xs text-text-muted">
            {pilot.recentManualRuns.slice(0, 4).map((run) => (
              <li key={run.id}>
                {run.actionKey} · {run.result}
                {run.durationMs != null ? ` · ${run.durationMs}ms` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
