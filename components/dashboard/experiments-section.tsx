"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExperimentDashboardCard } from "@/lib/marketing-experimentation/experiment-types";
import type { ExperimentProposalCard } from "@/lib/marketing-experimentation/proposal-types";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function ProposalCard({ proposal }: { proposal: ExperimentProposalCard }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/experiment-proposals/${proposal.id}`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not approve this experiment.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not approve this experiment. Please try again.");
      setBusy(false);
    }
  }

  return (
    <article
      className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5"
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-base font-semibold text-navy-900">
            {proposal.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-text-muted">{proposal.hypothesis}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-navy-900 ring-1 ring-slate-200">
          Proposed — awaiting your approval
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Control
          </dt>
          <dd className="mt-1 text-navy-900">
            <span className="font-semibold">{proposal.controlDefinition.label}</span>
            {" — "}
            {proposal.controlDefinition.description}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Treatment
          </dt>
          <dd className="mt-1 text-navy-900">
            <span className="font-semibold">{proposal.treatmentDefinition.label}</span>
            {" — "}
            {proposal.treatmentDefinition.description}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Primary KPI
          </dt>
          <dd className="mt-1 text-navy-900 capitalize">{proposal.primaryKpi}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Measurement window
          </dt>
          <dd className="mt-1 text-navy-900">{proposal.measurementWindowDays} days</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-5 text-text-muted">
        Linked recommendation · {proposal.recommendationId.slice(0, 8)}…
        {proposal.campaignId ? ` · Campaign · ${proposal.campaignId.slice(0, 8)}…` : ""}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        className="hom-focusable mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={approve}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Approving…" : "Approve experiment"}
      </button>
    </article>
  );
}

function ExperimentCard({ experiment }: { experiment: ExperimentDashboardCard }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const isCompletedWithoutAttribution =
    experiment.status === "completed" && !experiment.attributionAvailable;

  return (
    <article
      className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5"
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-base font-semibold text-navy-900">
            {experiment.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-text-muted">{experiment.hypothesis}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-navy-900 ring-1 ring-slate-200">
          {statusLabel(experiment.status)}
        </span>
      </div>

      {isCompletedWithoutAttribution ? (
        <div className="mt-4 rounded-lg border border-slate-200/80 bg-white p-3 text-sm text-navy-900">
          <p className="font-semibold">Inconclusive</p>
          <p className="mt-1 text-text-muted">Aggregate performance observed.</p>
          <p className="text-text-muted">Variant attribution unavailable.</p>
          <p className="text-text-muted">Early confidence maximum.</p>
          <p className="text-text-muted">No winner selected.</p>
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Outcome
            </dt>
            <dd className="mt-1 text-navy-900">{experiment.outcomeSummary}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Confidence
            </dt>
            <dd className="mt-1 text-navy-900">{experiment.confidenceLabel}</dd>
          </div>
        </dl>
      )}

      <p className="mt-3 text-xs leading-5 text-text-muted">
        Linked recommendation · {experiment.recommendationId.slice(0, 8)}…
        {experiment.campaignId
          ? ` · Campaign · ${experiment.campaignId.slice(0, 8)}…`
          : ""}
      </p>

      <button
        type="button"
        className="hom-focusable mt-4 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Hide variants" : "Show variants"}
      </button>

      {expanded && (
        <ul
          id={panelId}
          className="hom-disclose-content mt-3 space-y-2 border-t border-slate-200/80 pt-3"
        >
          {experiment.variants.map((variant) => (
            <li key={variant.key} className="text-sm leading-6 text-text-muted">
              <span className="font-semibold text-navy-900">{variant.label}</span>
              {" — "}
              {variant.description}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ExperimentsSection({
  pendingProposals,
  active,
  completed,
}: {
  pendingProposals: ExperimentProposalCard[];
  active: ExperimentDashboardCard[];
  completed: ExperimentDashboardCard[];
}) {
  return (
    <section
      className="hom-disclose-content mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-6"
      aria-labelledby="experiments-heading"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
        Experiments
      </p>
      <h2 id="experiments-heading" className="mt-2 text-xl font-bold text-navy-900">
        Marketing experiments
      </h2>
      <p className="mt-3 text-sm leading-7 text-text-muted">
        Controlled tests proposed by your Head of Marketing — measurement only, not new
        strategy. Every experiment starts from a proposal your Head of Marketing wrote; you
        can approve it here, but not edit or invent one yourself.
      </p>

      {pendingProposals.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
            Proposed
          </h3>
          <ul className="mt-3 grid gap-4">
            {pendingProposals.map((proposal) => (
              <li key={proposal.id}>
                <ProposalCard proposal={proposal} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
        Active
      </h3>
      {active.length === 0 ? (
        <p className="mt-3 text-sm leading-7 text-text-muted">
          No active experiments right now. When your Head of Marketing proposes one and you
          approve it, it will appear here.
        </p>
      ) : (
        <ul className="mt-3 grid gap-4">
          {active.map((experiment) => (
            <li key={experiment.id}>
              <ExperimentCard experiment={experiment} />
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
        Completed
      </h3>
      {completed.length === 0 ? (
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Completed experiment outcomes will show up here.
        </p>
      ) : (
        <ul className="mt-3 grid gap-4">
          {completed.map((experiment) => (
            <li key={experiment.id}>
              <ExperimentCard experiment={experiment} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
