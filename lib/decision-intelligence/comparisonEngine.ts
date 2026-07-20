/**
 * Deterministic comparison between two Marketing Director decision snapshots (Phase E).
 * Pure function — no I/O, no current time (evaluatedAt on the snapshots is the only
 * time reference). Compares by stable snapshot/evidence IDs only, never by title.
 */

import {
  DecisionChangeTypes,
  DecisionEvidenceTypes,
  type DecisionChangeSummary,
  type DecisionChangeType,
  type DecisionEvidenceTrace,
  type MarketingDirectorDecisionSnapshot,
} from "@/lib/decision-intelligence/types";
import { buildChangeExplanation } from "@/lib/decision-intelligence/explanations";

function traceKey(trace: DecisionEvidenceTrace): string {
  return `${trace.evidenceType}:${trace.evidenceId}`;
}

function diffTraces(
  current: DecisionEvidenceTrace[],
  previous: DecisionEvidenceTrace[],
): { added: DecisionEvidenceTrace[]; removed: DecisionEvidenceTrace[]; superseded: DecisionEvidenceTrace[] } {
  const previousKeys = new Set(previous.filter((t) => !t.excluded).map(traceKey));
  const currentKeys = new Set(current.filter((t) => !t.excluded).map(traceKey));

  const added = current.filter((t) => !t.excluded && !previousKeys.has(traceKey(t)));
  const removed = previous.filter((t) => !t.excluded && !currentKeys.has(traceKey(t)));
  const superseded = current.filter((t) => t.superseded);

  return { added, removed, superseded };
}

function inferChangeType(input: {
  hasPrevious: boolean;
  rankChanged: boolean;
  rankIncreased: boolean;
  statusChanged: boolean;
  currentStatus: MarketingDirectorDecisionSnapshot["decision_status"];
  evidenceAddedCount: number;
  evidenceRemovedCount: number;
  wasColdStart: boolean;
}): DecisionChangeType {
  if (!input.hasPrevious) return DecisionChangeTypes.ADDED;
  if (input.currentStatus === "superseded") return DecisionChangeTypes.SUPERSEDED;
  if (input.rankChanged) {
    return input.rankIncreased ? DecisionChangeTypes.INCREASED_PRIORITY : DecisionChangeTypes.DECREASED_PRIORITY;
  }
  if (input.evidenceAddedCount > 0 && input.evidenceRemovedCount === 0) return DecisionChangeTypes.EVIDENCE_STRENGTHENED;
  if (input.evidenceRemovedCount > 0 && input.evidenceAddedCount === 0) return DecisionChangeTypes.EVIDENCE_WEAKENED;
  if (input.wasColdStart) return DecisionChangeTypes.INSUFFICIENT_EVIDENCE;
  return DecisionChangeTypes.UNCHANGED;
}

export function compareDecisionSnapshots(
  current: MarketingDirectorDecisionSnapshot,
  previous: MarketingDirectorDecisionSnapshot | null,
  currentTraces: DecisionEvidenceTrace[],
  previousTraces: DecisionEvidenceTrace[],
): DecisionChangeSummary {
  const limitations: string[] = [];

  if (!previous) {
    limitations.push("No prior decision snapshot exists for this business — this is the first recorded decision.");
    return {
      previousDecisionId: null,
      currentDecisionId: current.id,
      changeType: DecisionChangeTypes.ADDED,
      rankChanged: false,
      previousRank: null,
      currentRank: current.priority_rank,
      statusChanged: false,
      actionChanged: false,
      evidenceAdded: currentTraces.filter((t) => !t.excluded),
      evidenceRemoved: [],
      evidenceSuperseded: [],
      preferenceImpact: currentTraces.some((t) => t.evidenceType === DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE),
      overrideImpact: false,
      experimentImpact: false,
      campaignImpact: Boolean(current.source_campaign_id),
      analyticsImpact: false,
      explanation: buildChangeExplanation({
        changeType: DecisionChangeTypes.ADDED,
        current,
        previous: null,
        evidenceAdded: currentTraces,
        evidenceRemoved: [],
      }),
      certainty: "no_safe_comparison",
      limitations,
    };
  }

  const { added, removed, superseded } = diffTraces(currentTraces, previousTraces);

  const rankChanged = current.priority_rank !== previous.priority_rank;
  const rankIncreased = current.priority_rank < previous.priority_rank; // lower number == higher priority
  const statusChanged = current.decision_type !== previous.decision_type;
  const actionChanged = current.action_type !== previous.action_type;

  const changeType = inferChangeType({
    hasPrevious: true,
    rankChanged,
    rankIncreased,
    statusChanged,
    currentStatus: current.decision_status,
    evidenceAddedCount: added.length,
    evidenceRemovedCount: removed.length,
    wasColdStart: current.was_cold_start,
  });

  const preferenceImpact =
    added.some((t) => t.evidenceType === DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE) ||
    removed.some((t) => t.evidenceType === DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE);
  const campaignImpact = current.source_campaign_id !== previous.source_campaign_id;

  // [Claude review, Phase 2F] experimentImpact/overrideImpact/analyticsImpact are
  // conservatively false here — establishing them precisely requires traversing beyond
  // the evidence a decision snapshot directly references (e.g. whether a *newly applied*
  // learning's supporting observations trace back to an experiment_completed event).
  // That deeper attribution is computed per-learning in learningImpact.ts
  // (LearningImpactSummary.relatedExperimentIds), not duplicated here — see
  // docs/DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md "Known limitations".
  if (added.some((t) => t.evidenceType === DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING)) {
    limitations.push(
      "New learnings were considered in this comparison; whether any originated from a specific experiment or campaign is shown on the Learning Impact panel, not inferred here.",
    );
  }

  return {
    previousDecisionId: previous.id,
    currentDecisionId: current.id,
    changeType,
    rankChanged,
    previousRank: previous.priority_rank,
    currentRank: current.priority_rank,
    statusChanged,
    actionChanged,
    evidenceAdded: added,
    evidenceRemoved: removed,
    evidenceSuperseded: superseded,
    preferenceImpact,
    overrideImpact: false,
    experimentImpact: false,
    campaignImpact,
    analyticsImpact: false,
    explanation: buildChangeExplanation({ changeType, current, previous, evidenceAdded: added, evidenceRemoved: removed }),
    certainty: "explicit_trace",
    limitations,
  };
}
