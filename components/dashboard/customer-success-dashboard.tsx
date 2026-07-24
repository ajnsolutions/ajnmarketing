"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerSuccessDashboardData } from "@/lib/assisted-pilot/customerSuccessService";
import {
  filterCustomerSuccessCards,
  PILOT_FEEDBACK_TYPES,
  type CustomerSuccessCard,
  type CustomerSuccessFilter,
  type PilotFeedbackTypeId,
} from "@/lib/assisted-pilot/customerSuccessCompose";
import { GUIDED_RECOVERY_ACTIONS } from "@/lib/assisted-pilot/recoveryLinks";
import { AssistedPilotPanel } from "@/components/dashboard/assisted-pilot-panel";

const FILTERS: Array<{ id: CustomerSuccessFilter; label: string }> = [
  { id: "all", label: "All customers" },
  { id: "attention_needed", label: "Attention needed" },
  { id: "onboarding", label: "Onboarding" },
  { id: "recently_active", label: "Recently active" },
  { id: "inactive", label: "Inactive" },
  { id: "google_issue", label: "Google status" },
  { id: "publishing_issue", label: "Publishing status" },
];

function HealthPill({ state }: { state: string }) {
  const tone =
    state === "healthy"
      ? "bg-growth-50 text-growth-700 ring-emerald-100"
      : state === "warning"
        ? "bg-amber-50 text-amber-800 ring-amber-100"
        : state === "blocked" || state === "critical"
          ? "bg-rose-50 text-rose-700 ring-rose-100"
          : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${tone}`}>
      {state.replace(/_/g, " ")}
    </span>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-slate-700">
      <span className={ok ? "text-growth-600" : "text-slate-400"} aria-hidden>
        {ok ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </li>
  );
}

function CustomerCard({ card }: { card: CustomerSuccessCard }) {
  const remaining = card.checklist.filter((item) => !item.complete);
  const blockers = card.checklist.filter((item) => item.blocked);

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-navy-900">{card.businessName}</h3>
          <p className="mt-1 text-xs text-text-muted">
            Profile {card.businessProfileId.slice(0, 8)}
            {card.pilotStatus ? ` · Pilot ${card.pilotStatus}` : " · Not in pilot registry"}
          </p>
        </div>
        <HealthPill state={card.overallHealth} />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <Flag ok={card.onboardingCompleted} label="Onboarding complete" />
        <Flag ok={card.websiteConnected} label="Website connected/analyzed" />
        <Flag ok={card.googleConnected} label="Google Business connected" />
        <Flag ok={card.aiProfileComplete} label="AI Marketing Profile complete" />
        <Flag ok={card.brandVoiceComplete} label="Brand Voice complete" />
        <Flag ok={card.marketingPlanGenerated} label="Marketing Plan generated" />
        <Flag ok={card.firstContentGenerated} label="First content generated" />
        <Flag ok={card.firstApprovalCompleted} label="First approval completed" />
        <Flag ok={card.firstPublishCompleted} label="First publish completed" />
      </ul>

      <dl className="mt-4 grid gap-2 text-xs text-text-muted sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-navy-900">Latest activity</dt>
          <dd>
            {card.latestActivityAt ? new Date(card.latestActivityAt).toLocaleString() : "No recent activity recorded"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">Last successful sync</dt>
          <dd>
            {card.lastSuccessfulSyncAt
              ? new Date(card.lastSuccessfulSyncAt).toLocaleString()
              : "Not recorded (analytics capture)"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">Google detail</dt>
          <dd>{card.googleDetail}</dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">Setup progress</dt>
          <dd>{card.setupPercent != null ? `${card.setupPercent}% required` : "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-navy-900">Pilot checklist</dt>
          <dd>{card.completionPercentage != null ? `${card.completionPercentage}%` : "—"}</dd>
        </div>
      </dl>

      <details className="mt-4 group">
        <summary className="hom-focusable cursor-pointer list-none text-sm font-semibold text-brand-600 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-h-11 items-center gap-2">
            Operator checklist ({remaining.length} remaining)
            {blockers.length > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-100">
                {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        </summary>
        <ul className="mt-3 space-y-2">
          {card.checklist.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2 text-sm ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-navy-900">
                  <span aria-hidden>{item.complete ? "☑" : "☐"} </span>
                  {item.label}
                  {item.blocked ? (
                    <span className="ml-2 text-xs font-semibold text-amber-700">Blocked</span>
                  ) : null}
                </p>
                <Link
                  href={item.href}
                  className="hom-focusable text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Open
                </Link>
              </div>
              <p className="mt-1 text-xs text-text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      </details>

      <details className="mt-3 group">
        <summary className="hom-focusable cursor-pointer list-none text-sm font-semibold text-brand-600 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-h-11 items-center">Activity timeline</span>
        </summary>
        {card.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            No persisted timeline events yet. Register the business as a pilot to capture checklist and
            manual-action history.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {card.timeline.map((event) => (
              <li key={event.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                <p className="font-medium text-navy-900">{event.label}</p>
                <p className="text-xs text-text-muted">{new Date(event.at).toLocaleString()}</p>
                {event.detail ? <p className="text-xs text-text-muted">{event.detail}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </details>
    </article>
  );
}

function PilotFeedbackForm({ pilotBusinessId }: { pilotBusinessId: string | null }) {
  const router = useRouter();
  const [type, setType] = useState<PilotFeedbackTypeId>("general_note");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const meta = PILOT_FEEDBACK_TYPES.find((t) => t.id === type);
    const res = await fetch("/api/admin/pilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_issue",
        pilotBusinessId: pilotBusinessId || null,
        severity: type === "bug" ? "high" : "medium",
        category: meta?.category ?? "operational",
        description: `[Pilot feedback · ${meta?.label ?? type}] ${note.trim()}`,
      }),
    });
    const json = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Unable to save feedback");
      return;
    }
    setNote("");
    setMessage("Feedback saved to pilot issues.");
    router.refresh();
  }

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="pilot-feedback-heading"
    >
      <h2 id="pilot-feedback-heading" className="text-base font-bold text-navy-900 sm:text-lg">
        Pilot feedback
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Lightweight learning log — questions, bugs, confusing workflows, and requests. Stored as pilot
        issues (no new engines).
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Feedback type">
        {PILOT_FEEDBACK_TYPES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={type === option.id}
            onClick={() => setType(option.id)}
            className={`hom-focusable inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ${
              type === option.id
                ? "bg-brand-600 text-white ring-brand-600"
                : "border border-slate-200 bg-white text-navy-900 ring-slate-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
          placeholder="What should we learn from this pilot moment?"
        />
      </label>
      <button
        type="button"
        disabled={busy || !note.trim()}
        onClick={() => void submit()}
        className="hom-focusable mt-3 inline-flex min-h-11 items-center rounded-full bg-[#081426] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save feedback"}
      </button>
      {message ? (
        <p className="mt-2 text-sm text-growth-600" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function CustomerSuccessDashboard({ data }: { data: CustomerSuccessDashboardData }) {
  const [filter, setFilter] = useState<CustomerSuccessFilter>("all");
  const filtered = useMemo(
    () => filterCustomerSuccessCards(data.cards, filter),
    [data.cards, filter],
  );

  const selectedPilotId = data.pilot?.pilots[0]?.id ?? null;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Internal</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Customer Success Dashboard
        </h1>
        <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
          Assisted pilot readiness for real customers — onboarding, attention, timelines, and guided
          recovery using existing platform signals only. Cron gate stays closed.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Generated {new Date(data.generatedAt).toLocaleString()} · Cron gate{" "}
          <span className="font-semibold text-navy-900">
            {data.scheduleGateOpen ? "OPEN" : "CLOSED"}
          </span>
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/dashboard/admin/ops"
            className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
          >
            ← Operations dashboard
          </Link>
          <Link
            href="/dashboard/admin/pilot-validation"
            className="hom-focusable font-semibold text-brand-600 hover:text-brand-700"
          >
            Pilot Validation →
          </Link>
        </div>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="System readiness summary"
      >
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">Customers</p>
          <p className="mt-2 text-3xl font-bold text-navy-900">{data.cards.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">Attention items</p>
          <p className="mt-2 text-3xl font-bold text-navy-900">{data.attention.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">Stuck jobs</p>
          <p className="mt-2 text-3xl font-bold text-navy-900">{data.stuckJobCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-text-muted">Pilot readiness</p>
          <p className="mt-2 text-3xl font-bold text-navy-900">
            {data.pilot?.aggregateReadiness.total ?? "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {data.pilot?.launchRecommendation ?? "Register pilots after migration"}
          </p>
        </article>
      </section>

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="attention-heading"
      >
        <h2 id="attention-heading" className="text-base font-bold text-navy-900 sm:text-lg">
          Attention Center
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Onboarding help, inactivity, Google issues, publishing failures, pending approvals, and
          retries — from existing state only.
        </p>
        {data.attention.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">Nothing needs operator attention right now.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.attention.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <HealthPill state={item.severity} />
                  <p className="text-sm font-semibold text-navy-900">{item.title}</p>
                </div>
                <p className="mt-2 text-sm text-text-muted">{item.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.recovery.map((action) => (
                    <Link
                      key={action.id}
                      href={action.href}
                      className="hom-focusable inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-900"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="recovery-heading"
      >
        <h2 id="recovery-heading" className="text-base font-bold text-navy-900 sm:text-lg">
          Guided recovery
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Safe operator assists — only actions already supported by the product. Prefer customer
          routes; use assisted-pilot manual actions for one-off runs.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {GUIDED_RECOVERY_ACTIONS.map((action) => (
            <li
              key={action.id}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <p className="text-sm font-semibold text-navy-900">{action.label}</p>
              <p className="mt-1 text-xs leading-5 text-text-muted">{action.description}</p>
              <Link
                href={action.href}
                className="hom-focusable mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-600"
              >
                Open →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter customers">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={`hom-focusable inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm font-semibold ring-1 ${
              filter === option.id
                ? "bg-[#081426] text-white ring-[#081426]"
                : "border border-slate-200 bg-white text-navy-900 ring-slate-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section aria-label="Customer success cards" className="grid gap-6 xl:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-text-muted">No customers match this filter.</p>
        ) : (
          filtered.map((card) => <CustomerCard key={card.businessProfileId} card={card} />)
        )}
      </section>

      <PilotFeedbackForm pilotBusinessId={selectedPilotId} />

      {data.pilot ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6">
          <h2 className="text-base font-bold text-navy-900 sm:text-lg">Assisted pilot console</h2>
          <p className="mt-1 mb-4 text-sm text-text-muted">
            Existing checklist updates, manual actions, and issue tracker — unchanged engines.
          </p>
          <AssistedPilotPanel data={data.pilot} />
        </section>
      ) : null}

      <section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-6"
        aria-labelledby="ops-readiness-heading"
      >
        <h2 id="ops-readiness-heading" className="text-base font-bold text-navy-900 sm:text-lg">
          Production readiness snapshot
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Deployment/config signals from the existing readiness model. Does not activate schedules.
        </p>
        <ul className="mt-4 space-y-2">
          {(data.readiness?.items ?? []).slice(0, 8).map((item) => (
            <li
              key={item.key}
              className="rounded-xl border border-slate-100 px-4 py-3 text-sm ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy-900">{item.label}</p>
                <HealthPill state={item.status} />
              </div>
              <p className="mt-1 text-xs text-text-muted">{item.reason}</p>
            </li>
          ))}
        </ul>
        {data.opsSummary ? (
          <p className="mt-4 text-xs text-text-muted">
            Publishing failed queue depth:{" "}
            {data.opsSummary.sections.find((s) => s.id === "publishing_failures")?.counts.failed ?? 0}
            {" · "}
            OAuth failed:{" "}
            {data.opsSummary.sections.find((s) => s.id === "oauth_health")?.counts.failed ?? 0}
          </p>
        ) : null}
      </section>
    </div>
  );
}
