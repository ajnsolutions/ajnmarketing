/**
 * Deterministic, customer-friendly explanation catalog (Phase F). Templates only — no
 * LLM. Every explanation is grounded in the evidence actually passed in; nothing here
 * invents a reason. Correlation is never described as causation unless the underlying
 * data is an explicit, recorded relationship (e.g. "based_on" a specific recommendation).
 */

import {
  DecisionChangeTypes,
  DecisionEvidenceTypes,
  type DecisionChangeType,
  type DecisionEvidenceTrace,
  type MarketingDirectorDecisionSnapshot,
} from "@/lib/decision-intelligence/types";

function actionLabel(actionType: string | null): string {
  if (!actionType || actionType === "none") return "this priority";
  return actionType.replaceAll("_", " ");
}

function describeEvidenceKind(trace: DecisionEvidenceTrace): string {
  switch (trace.evidenceType) {
    case DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE:
      return "a customer preference";
    case DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING:
      return "a Marketing Memory learning";
    case DecisionEvidenceTypes.CAMPAIGN:
    case DecisionEvidenceTypes.CAMPAIGN_COMPLETION:
      return "a campaign";
    case DecisionEvidenceTypes.EXPERIMENT_PROPOSAL:
    case DecisionEvidenceTypes.EXPERIMENT_COMPLETION:
      return "an experiment";
    case DecisionEvidenceTypes.RECOMMENDATION:
    case DecisionEvidenceTypes.RECOMMENDATION_OUTCOME:
      return "a recommendation";
    case DecisionEvidenceTypes.MARKET_CONTEXT:
      return "market context";
    default:
      return "additional evidence";
  }
}

export function buildChangeExplanation(input: {
  changeType: DecisionChangeType;
  current: MarketingDirectorDecisionSnapshot;
  previous: MarketingDirectorDecisionSnapshot | null;
  evidenceAdded: DecisionEvidenceTrace[];
  evidenceRemoved: DecisionEvidenceTrace[];
}): string {
  const { changeType, current, evidenceAdded, evidenceRemoved } = input;
  const label = actionLabel(current.action_type);
  const preferenceAdded = evidenceAdded.find((t) => t.evidenceType === DecisionEvidenceTypes.MARKETING_MEMORY_PREFERENCE);
  const learningAdded = evidenceAdded.find((t) => t.evidenceType === DecisionEvidenceTypes.MARKETING_MEMORY_LEARNING);

  switch (changeType) {
    case DecisionChangeTypes.ADDED:
      return `${current.title} is a new priority. ${current.customer_summary}`;
    case DecisionChangeTypes.INCREASED_PRIORITY:
      if (preferenceAdded) {
        return `${current.title} moved higher because a customer preference now applies to it.`;
      }
      if (learningAdded) {
        return `${current.title} moved higher because a new Marketing Memory learning now supports it: ${learningAdded.customerExplanation}`;
      }
      return `${current.title} moved higher based on updated evidence.`;
    case DecisionChangeTypes.DECREASED_PRIORITY:
      if (evidenceRemoved.length > 0) {
        return `${current.title} moved lower because ${describeEvidenceKind(evidenceRemoved[0]!)} that previously supported it is no longer active.`;
      }
      return `${current.title} moved lower based on updated evidence.`;
    case DecisionChangeTypes.EVIDENCE_STRENGTHENED:
      return `${current.title} remained the priority, and new evidence (${evidenceAdded.map(describeEvidenceKind).join(", ")}) now supports it more directly.`;
    case DecisionChangeTypes.EVIDENCE_WEAKENED:
      return `${current.title} remained the priority, but evidence that previously supported it (${evidenceRemoved.map(describeEvidenceKind).join(", ")}) is no longer active.`;
    case DecisionChangeTypes.SUPERSEDED:
      return `${current.title} was superseded by a more recent decision.`;
    case DecisionChangeTypes.INSUFFICIENT_EVIDENCE:
      return `${current.title} is shown, but there is not yet enough Marketing Memory evidence to explain why in more detail.`;
    case DecisionChangeTypes.UNCHANGED:
    default:
      return `${label} remained unchanged since the previous decision — no new evidence changed the plan.`;
  }
}

export function explainPrecedence(input: {
  winningKind: "prohibition" | "preference" | "goal" | "strong_learning" | "developing_learning" | "market_context";
  overriddenKind?: "developing_learning" | "early_learning" | "recommendation" | null;
}): string {
  const winnerLabel: Record<string, string> = {
    prohibition: "A customer instruction not to take this action",
    preference: "A customer preference",
    goal: "An active business goal",
    strong_learning: "A strong Marketing Memory learning",
    developing_learning: "A developing Marketing Memory learning",
    market_context: "Market context",
  };
  const overriddenLabel: Record<string, string> = {
    developing_learning: "a developing learning",
    early_learning: "an early signal",
    recommendation: "the underlying recommendation",
  };

  const winner = winnerLabel[input.winningKind] ?? "An existing rule";
  if (input.overriddenKind) {
    return `${winner} took precedence over ${overriddenLabel[input.overriddenKind] ?? "other evidence"}.`;
  }
  return `${winner} applied to this decision.`;
}

export function explainIgnoredEvidence(reason: string): string {
  return `This evidence was available but was not used: ${reason}.`;
}

export function explainInconclusiveExperiment(experimentTitle: string): string {
  return `${experimentTitle} produced aggregate activity but no per-variant attribution, so it did not change any preference or priority. The result remains inconclusive.`;
}

export function explainCampaignInfluence(campaignTitle: string, promotedToLearning: boolean): string {
  if (promotedToLearning) {
    return `${campaignTitle} influenced later planning because its completion created a Marketing Memory observation that was later promoted into a learning.`;
  }
  return `${campaignTitle} completed and recorded an observation, but that observation has not yet been promoted into a learning that could influence a later decision.`;
}

export function explainTemporaryOverride(overrideNotes: string | null): string {
  if (overrideNotes) {
    return `A temporary override changed the current plan (${overrideNotes}) but did not permanently alter Marketing Memory.`;
  }
  return "A temporary override changed the current plan but did not permanently alter Marketing Memory.";
}
