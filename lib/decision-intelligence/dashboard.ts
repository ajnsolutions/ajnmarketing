/**
 * Compact "Why the Plan Changed" preview for the Head of Marketing page (Phase K).
 * A summary of the full DecisionIntelligenceSummary, not a duplicate of its logic.
 */

import type { DecisionIntelligenceSummary } from "@/lib/decision-intelligence/types";

export type WhyPlanChangedPreview = {
  hasDecision: boolean;
  headline: string;
  supportingReasons: string[];
  latestLearning: string | null;
  latestOverride: string | null;
  latestInconclusiveExperiment: string | null;
  isStale: boolean;
  warningCount: number;
};

export function buildWhyPlanChangedPreview(
  summary: DecisionIntelligenceSummary,
): WhyPlanChangedPreview {
  if (!summary.currentDecision || !summary.comparison) {
    return {
      hasDecision: false,
      headline: "Not enough decision history yet to explain what changed.",
      supportingReasons: [],
      latestLearning: null,
      latestOverride: null,
      latestInconclusiveExperiment: null,
      isStale: false,
      warningCount: summary.warnings.length,
    };
  }

  const supportingReasons = [
    ...summary.comparison.evidenceAdded.slice(0, 2).map((trace) => trace.customerExplanation),
  ];

  const latestLearningImpact = summary.learningImpact.find(
    (item) => item.kind === "learning" && item.activeState === "active",
  );
  const latestOverrideImpact = summary.learningImpact.find((item) => item.kind === "override");
  const latestInconclusiveExperimentTrace = summary.currentPriorities
    .flatMap((p) => p.trace)
    .find((trace) => trace.evidenceType === "experiment_completion");

  return {
    hasDecision: true,
    headline: summary.comparison.explanation,
    supportingReasons,
    latestLearning: latestLearningImpact ? latestLearningImpact.label : null,
    latestOverride: latestOverrideImpact ? latestOverrideImpact.label : null,
    latestInconclusiveExperiment: latestInconclusiveExperimentTrace
      ? latestInconclusiveExperimentTrace.customerExplanation
      : null,
    isStale: summary.currentDecision.decision_status === "superseded",
    warningCount: summary.warnings.length,
  };
}
