import type { ProductionHealthReport } from "@/lib/production-health/types";
import type { OpsDashboardSummary } from "@/lib/ops-dashboard/types";
import type { OpsAlertSnapshot } from "@/lib/production-alerts/types";
import type { WorkflowValidationReport } from "@/lib/workflow-validation/harness";
import type { FailureInjectionState } from "@/lib/failure-injection/gate";

function statusColor(status: string): string {
  if (status === "healthy" || status === "success" || status === "info") return "text-growth-600";
  if (status === "warning") return "text-amber-700";
  return "text-rose-600";
}

function StatusPill({ status }: { status: string }) {
  const ring =
    status === "healthy" || status === "info"
      ? "bg-growth-50 text-growth-600 ring-emerald-100"
      : status === "warning"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-rose-50 text-rose-600 ring-rose-100";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${ring}`}>
      {status}
    </span>
  );
}

export function AdminOpsDashboard({
  health,
  summary,
  alerts,
  workflow,
  failureInjection,
}: {
  health: ProductionHealthReport;
  summary: OpsDashboardSummary | null;
  alerts: OpsAlertSnapshot;
  workflow: WorkflowValidationReport;
  failureInjection: FailureInjectionState;
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Internal</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Operational Dashboard
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted sm:text-base">
          Monitor autonomous pipeline health, queues, alerts, and launch gates. This surface is
          admin-allowlist only and does not activate schedules, auto-approve, or auto-publish.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
          <p className="text-sm font-medium text-text-muted">Overall health</p>
          <p className={`mt-2 text-2xl font-bold ${statusColor(health.overall)}`}>{health.overall}</p>
          <p className="mt-2 text-xs text-text-muted">Correlation {health.correlationId.slice(0, 8)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
          <p className="text-sm font-medium text-text-muted">Cron gate</p>
          <p className="mt-2 text-2xl font-bold text-navy-900">
            {summary?.scheduleGateOpen || health.checks.some((c) => c.category === "schedules" && c.status === "critical")
              ? "OPEN"
              : "CLOSED"}
          </p>
          <p className="mt-2 text-xs text-text-muted">ATTACH_DECLARATIVE_PRODUCTION_CRONS</p>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
          <p className="text-sm font-medium text-text-muted">Alerts</p>
          <p className="mt-2 text-2xl font-bold text-navy-900">
            {alerts.counts.critical + alerts.counts.warning}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {alerts.counts.critical} critical · {alerts.counts.warning} warning
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
          <p className="text-sm font-medium text-text-muted">Workflow validation</p>
          <p className={`mt-2 text-2xl font-bold ${workflow.ok ? "text-growth-600" : "text-rose-600"}`}>
            {workflow.ok ? "PASS" : "FAIL"}
          </p>
          <p className="mt-2 text-xs text-text-muted">{workflow.scenarios.length} scenarios</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold text-navy-900 sm:text-lg">Active alerts</h2>
          <p className="mt-1 text-sm text-text-muted">
            Internal only — no external notification providers wired yet.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4 sm:px-6">
          {alerts.alerts.length === 0 ? (
            <p className="text-sm text-text-muted">No active alerts.</p>
          ) : (
            alerts.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={alert.severity} />
                  <p className="text-sm font-semibold text-navy-900">{alert.title}</p>
                </div>
                <p className="mt-1 text-sm text-text-muted">{alert.message}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold text-navy-900 sm:text-lg">Queue & subsystem status</h2>
        </div>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
          {(summary?.sections ?? []).map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-navy-900">{item.title}</h3>
                <span className="text-xs font-semibold text-slate-500">depth {item.queueDepth}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted">
                <div>pending: {item.counts.pending}</div>
                <div>running: {item.counts.running}</div>
                <div>retrying: {item.counts.retrying}</div>
                <div>failed: {item.counts.failed}</div>
                <div>completed: {item.counts.completed}</div>
                <div>
                  last:{" "}
                  {item.lastExecutionAt
                    ? new Date(item.lastExecutionAt).toLocaleString()
                    : "—"}
                </div>
              </dl>
              {item.lastError && (
                <p className="mt-2 text-xs text-rose-600">Last error: {item.lastError}</p>
              )}
              {item.notes && <p className="mt-2 text-xs text-text-muted">{item.notes}</p>}
            </article>
          ))}
          {!summary && (
            <p className="text-sm text-amber-700 sm:col-span-2 xl:col-span-3">
              Ops summary unavailable — configure SUPABASE_SECRET_KEY for cross-tenant aggregation.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-navy-900">Health checks</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {health.checks.map((check) => (
              <li key={`${check.category}-${check.title}`} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-navy-900">{check.title}</p>
                  <StatusPill status={check.status} />
                </div>
                <p className="mt-1 text-sm text-text-muted">{check.diagnostic}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-navy-900">Workflow validation & failure injection</h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm text-text-muted">
              Failure injection:{" "}
              <span className="font-semibold text-navy-900">
                {failureInjection.enabled ? "ENABLED" : "disabled"}
              </span>
              {failureInjection.reasonDisabled ? ` — ${failureInjection.reasonDisabled}` : null}
            </p>
            {workflow.scenarios.map((scenario) => (
              <div key={scenario.scenario} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-navy-900">{scenario.scenario}</p>
                  <StatusPill status={scenario.ok ? "healthy" : "critical"} />
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {scenario.assertions.filter((a) => a.ok).length}/{scenario.assertions.length}{" "}
                  assertions passed
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
