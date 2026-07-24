"use client";

import Link from "next/link";
import type { PilotValidationDashboardData } from "@/lib/assisted-pilot/pilotValidationService";
import type { ValidationTone } from "@/lib/assisted-pilot/pilotValidationCompose";

function TonePill({ tone }: { tone: ValidationTone | string }) {
  const style =
    tone === "ready"
      ? "bg-growth-50 text-growth-700 ring-emerald-100"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800 ring-amber-100"
        : tone === "blocked"
          ? "bg-rose-50 text-rose-700 ring-rose-100"
          : tone === "info"
            ? "bg-sky-50 text-sky-800 ring-sky-100"
            : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${style}`}>
      {String(tone).replace(/_/g, " ")}
    </span>
  );
}

function ReportList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ label: string; detail: string }>;
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
      <h3 className="text-sm font-bold text-navy-900 sm:text-base">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2 text-sm ring-1 ring-slate-200/60"
            >
              <p className="font-semibold text-navy-900">{item.label}</p>
              <p className="mt-1 text-xs text-text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PilotValidationDashboard({ data }: { data: PilotValidationDashboardData }) {
  const { view, scheduleGateOpen, generatedAt } = data;
  const obs = view.observability;
  const report = view.report;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Internal</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Pilot Validation & Go-Live Readiness
        </h1>
        <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
          Operator-only validation of existing platform state. No new AI, no recommendation changes,
          and the cron gate stays closed until a separate approved activation.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Generated {new Date(generatedAt).toLocaleString()} · Cron gate{" "}
          <span className="font-semibold text-navy-900">{scheduleGateOpen ? "OPEN" : "CLOSED"}</span>
        </p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Related admin surfaces">
          <Link
            href="/dashboard/admin/ops"
            className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
          >
            ← Operations
          </Link>
          <Link
            href="/dashboard/admin/customer-success"
            className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
          >
            Customer Success
          </Link>
        </nav>
      </header>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Admin observability"
      >
        {[
          { label: "Needs attention", value: obs.customersRequiringAttention },
          { label: "Inactive", value: obs.customersInactive },
          { label: "Fully onboarded", value: obs.customersFullyOnboarded },
          { label: "Blocked", value: obs.customersBlocked },
          { label: "Recent recoveries", value: obs.recentRecoveries },
          { label: "Recent publishes", value: obs.recentPublishes },
          { label: "Recent approvals", value: obs.recentApprovals },
          { label: "Stuck jobs / open issues", value: `${obs.stuckJobs} / ${obs.openPilotIssues}` },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]"
          >
            <p className="text-sm text-text-muted">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-navy-900">{item.value}</p>
          </article>
        ))}
      </section>

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="audit-heading"
      >
        <h2 id="audit-heading" className="text-base font-bold text-navy-900 sm:text-lg">
          Pilot readiness audit
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Existing setup, Google, website, profile, plan, brand voice, publishing, approvals, cron,
          and Trigger signals — no invented scores.
        </p>
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {view.audit.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy-900">{item.label}</p>
                <TonePill tone={item.tone} />
              </div>
              <p className="mt-2 text-xs leading-5 text-text-muted">{item.detail}</p>
              {item.href ? (
                <Link
                  href={item.href}
                  className="hom-focusable mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600"
                >
                  Open →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="ops-validation-heading"
      >
        <h2 id="ops-validation-heading" className="text-base font-bold text-navy-900 sm:text-lg">
          Operational validation
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Retry, recovery, approvals, publishing, Google reconnect, website re-analysis, and
          recommendation regeneration paths — highlights inconsistent states only.
        </p>
        <ul className="mt-4 space-y-3">
          {view.operational.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy-900">{item.label}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {item.inconsistent ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-100">
                      Inconsistent
                    </span>
                  ) : null}
                  <TonePill tone={item.tone} />
                </div>
              </div>
              <p className="mt-2 text-xs text-text-muted">{item.detail}</p>
              <Link
                href={item.path}
                className="hom-focusable mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600"
              >
                Validate path →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="journey-heading"
      >
        <h2 id="journey-heading" className="text-base font-bold text-navy-900 sm:text-lg">
          Customer journey validation
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Operator checklist for assisted pilot scenarios. Use as a guided walkthrough — not a
          customer-facing score.
        </p>
        <ol className="mt-4 space-y-3">
          {view.journey.map((item, index) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy-900">
                  <span className="text-text-muted">{index + 1}. </span>
                  {item.label}
                </p>
                <TonePill tone={item.tone} />
              </div>
              <p className="mt-1 text-sm text-slate-700">{item.description}</p>
              <p className="mt-2 text-xs text-text-muted">{item.detail}</p>
              <Link
                href={item.href}
                className="hom-focusable mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600"
              >
                Open scenario →
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="report-heading" className="space-y-4">
        <div>
          <h2 id="report-heading" className="text-base font-bold text-navy-900 sm:text-lg">
            Production readiness report
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Generated from existing readiness, ops queues, attention, and pilot issues. Overall:{" "}
            <strong>{report.overallStatus.replace(/_/g, " ")}</strong>
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportList
            title="Outstanding blockers"
            items={report.outstandingBlockers}
            empty="No outstanding blockers from current signals."
          />
          <ReportList
            title="Warnings"
            items={report.warnings.slice(0, 20)}
            empty="No warnings from current signals."
          />
          <ReportList
            title="Recovered issues"
            items={report.recoveredIssues}
            empty="No recovered issue signals yet."
          />
          <ReportList
            title="Healthy systems"
            items={report.healthySystems.slice(0, 20)}
            empty="No systems currently marked ready."
          />
        </div>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
          <h3 className="text-sm font-bold text-navy-900 sm:text-base">
            Required manual actions before enabling automation
          </h3>
          <ul className="mt-3 space-y-2">
            {report.requiredManualActions.map((action) => (
              <li
                key={action.label}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2 text-sm ring-1 ring-slate-200/60"
              >
                <p className="font-semibold text-navy-900">{action.label}</p>
                <p className="mt-1 text-xs text-text-muted">{action.detail}</p>
                <Link
                  href={action.href}
                  className="hom-focusable mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-brand-600"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </div>
  );
}
