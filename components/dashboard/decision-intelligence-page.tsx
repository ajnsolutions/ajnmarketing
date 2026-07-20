"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type {
  DecisionEvidenceTrace,
  DecisionIntelligenceSummary,
} from "@/lib/decision-intelligence/types";
import type { LearningImpactSummary } from "@/lib/decision-intelligence/types";

function stateLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function EvidenceRow({ trace }: { trace: DecisionEvidenceTrace }) {
  return (
    <li className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-navy-900">{stateLabel(trace.evidenceType)}</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold capitalize text-navy-900 ring-1 ring-slate-200">
          {stateLabel(trace.influenceState)}
        </span>
      </div>
      <p className="mt-1.5 text-text-muted">{trace.customerExplanation}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted sm:grid-cols-4">
        <div>
          <dt className="font-semibold uppercase tracking-wide">Confidence</dt>
          <dd className="capitalize">{stateLabel(trace.confidenceState)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Recency</dt>
          <dd className="capitalize">{stateLabel(trace.recencyState)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Relationship</dt>
          <dd className="capitalize">{stateLabel(trace.relationshipType)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Status</dt>
          <dd>
            {trace.superseded ? "Superseded" : trace.overridden ? "Overridden" : trace.excluded ? "Excluded" : "Active"}
          </dd>
        </div>
      </dl>
      {trace.sourceTarget && (
        <Link href={trace.sourceTarget} className="hom-focusable mt-2 inline-block text-xs font-semibold text-brand-600 hover:text-brand-700">
          View source →
        </Link>
      )}
    </li>
  );
}

function EvidenceDisclosure({ traces }: { traces: DecisionEvidenceTrace[] }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (traces.length === 0) {
    return <p className="mt-3 text-sm text-text-muted">No evidence is linked to this decision.</p>;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        className="hom-focusable text-sm font-semibold text-brand-600 hover:text-brand-700"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Hide evidence" : `Show evidence (${traces.length})`}
      </button>
      {expanded && (
        <ul id={panelId} className="mt-3 space-y-2">
          {traces.map((trace) => (
            <EvidenceRow key={trace.id} trace={trace} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LearningImpactCard({ item }: { item: LearningImpactSummary }) {
  return (
    <li className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-navy-900 capitalize">{item.kind}</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold capitalize text-navy-900 ring-1 ring-slate-200">
          {stateLabel(item.activeState)}
        </span>
      </div>
      <p className="mt-1.5 text-text-muted">{item.label}</p>
      <p className="mt-1 text-xs text-text-muted">Origin: {item.origin}</p>
      <p className="mt-1 text-xs text-text-muted">
        {item.influencedLaterDecision
          ? "Influenced a later Marketing Director decision."
          : item.influenceUnavailableReason}
      </p>
      {item.ignoredDueToPrecedence && (
        <p className="mt-1 text-xs text-text-muted">Not used: {item.ignoredDueToPrecedence}.</p>
      )}
      {item.insufficientEvidence && (
        <p className="mt-1 text-xs font-semibold text-amber-700">Insufficient evidence</p>
      )}
      {(item.relatedCampaignIds.length > 0 || item.relatedExperimentIds.length > 0) && (
        <p className="mt-1 text-xs text-text-muted">
          {item.relatedCampaignIds.length > 0 && `Linked to ${item.relatedCampaignIds.length} campaign(s). `}
          {item.relatedExperimentIds.length > 0 && `Linked to ${item.relatedExperimentIds.length} experiment(s).`}
        </p>
      )}
    </li>
  );
}

export function DecisionIntelligencePage({ summary }: { summary: DecisionIntelligenceSummary }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-navy-900">Decision Intelligence</h1>
      <p className="mt-2 text-sm leading-7 text-text-muted">
        A read-only explanation of what your Head of Marketing decided, what evidence supports it, and
        what remains uncertain. This page never creates or changes recommendations, campaigns, or
        experiments.
      </p>

      {summary.warnings.length > 0 && (
        <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">
          Some sources were unavailable while building this page ({summary.warnings.length}). What follows may
          be incomplete.
        </p>
      )}

      {/* Current Decision Summary */}
      <section className="mt-8" aria-labelledby="current-decision-heading">
        <h2 id="current-decision-heading" className="text-lg font-bold text-navy-900">
          Current decision
        </h2>
        {summary.currentDecision ? (
          <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-base font-semibold text-navy-900">{summary.currentDecision.title}</p>
            <p className="mt-1 text-sm text-text-muted">{summary.currentDecision.customer_summary}</p>
            <p className="mt-2 text-xs text-text-muted">
              {summary.currentPriorities[0]?.trace.length ?? 0} piece(s) of evidence · generated{" "}
              {new Date(summary.currentDecision.evaluated_at).toLocaleString()}
            </p>
            {summary.limitations.map((limitation, index) => (
              <p key={index} className="mt-2 text-xs text-amber-700">
                {limitation}
              </p>
            ))}
            <EvidenceDisclosure traces={summary.currentPriorities[0]?.trace ?? []} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">
            No Marketing Director decision has been recorded yet. Check back after your next Head of
            Marketing visit.
          </p>
        )}
      </section>

      {/* What Changed */}
      <section className="mt-8" aria-labelledby="what-changed-heading">
        <h2 id="what-changed-heading" className="text-lg font-bold text-navy-900">
          What changed
        </h2>
        {summary.comparison ? (
          <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm text-navy-900">{summary.comparison.explanation}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-text-muted sm:grid-cols-4">
              <div>
                <dt className="font-semibold uppercase tracking-wide">Change type</dt>
                <dd className="capitalize">{stateLabel(summary.comparison.changeType)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide">Rank</dt>
                <dd>
                  {summary.comparison.previousRank ?? "—"} → {summary.comparison.currentRank}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide">Evidence added</dt>
                <dd>{summary.comparison.evidenceAdded.length}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide">Evidence removed</dt>
                <dd>{summary.comparison.evidenceRemoved.length}</dd>
              </div>
            </dl>
            {summary.comparison.certainty === "no_safe_comparison" && (
              <p className="mt-2 text-xs text-text-muted">No safe historical comparison is available yet.</p>
            )}
            {summary.comparison.limitations.map((limitation, index) => (
              <p key={index} className="mt-2 text-xs text-text-muted">
                {limitation}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">Nothing to compare yet.</p>
        )}
      </section>

      {/* Learning Impact */}
      <section className="mt-8" aria-labelledby="learning-impact-heading">
        <h2 id="learning-impact-heading" className="text-lg font-bold text-navy-900">
          Learning impact
        </h2>
        {summary.learningImpact.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No learnings, preferences, or overrides recorded yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {summary.learningImpact.map((item) => (
              <LearningImpactCard key={`${item.kind}:${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </section>

      {/* Decision Timeline */}
      <section className="mt-8" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="text-lg font-bold text-navy-900">
          Decision timeline
        </h2>
        {summary.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No timeline events recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {summary.timeline.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {new Date(event.occurredAt).toLocaleString()} · {stateLabel(event.type)}
                </p>
                <p className="mt-1 font-semibold text-navy-900">{event.title}</p>
                <p className="text-text-muted">{event.description}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
