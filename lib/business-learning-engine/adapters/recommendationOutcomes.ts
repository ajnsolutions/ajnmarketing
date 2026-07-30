/**
 * Adapter: recommendation outcomes, grouped by recommended action type ->
 * LearningSignalInput[].
 *
 * lib/recommendation-outcomes/ already derives a deterministic lifecycle +
 * usefulness signal per recommendation; this adapter aggregates those real,
 * already-computed outcomes across every recommendation of the same action
 * type to answer "does this kind of recommendation tend to land well." It
 * never invents a topic/service-level correlation the underlying data can't
 * support (e.g. "commercial roofing" specifically) — see Known Limitations
 * in docs/project-magic/BUSINESS_LEARNING_ENGINE.md. A future provider with
 * genuinely topic-level outcome data can produce a topic-scoped pattern
 * through the same LearningSignalInput contract without any engine change.
 */

import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import type { RecommendedActionType } from "@/lib/marketing-decisions/types";
import type { LearningSignalInput } from "@/lib/business-learning-engine/types";

/** Minimum recommendations of the same action type before a pattern is
 * honest to state — never claims a trend from 1-2 data points. */
const MIN_SAMPLE_SIZE = 3;

export type ActionTypeOutcomeBreakdown = {
  actionType: string;
  sampleSize: number;
  approvedCount: number;
  rejectedCount: number;
  publishedCount: number;
  dominantRejectionReason: string | null;
  lastActivityAt: string | null;
};

function formatActionLabel(actionType: string): string {
  return formatRecommendedActionType(actionType as RecommendedActionType);
}

export function actionTypeBreakdownToLearningSignals(
  breakdowns: ActionTypeOutcomeBreakdown[] | null | undefined,
): LearningSignalInput[] {
  if (!breakdowns?.length) return [];

  const signals: LearningSignalInput[] = [];

  for (const breakdown of breakdowns) {
    if (breakdown.sampleSize < MIN_SAMPLE_SIZE) continue;

    const actionLabel = formatActionLabel(breakdown.actionType);
    const approvalRate = breakdown.approvedCount / breakdown.sampleSize;
    const rejectionRate = breakdown.rejectedCount / breakdown.sampleSize;

    let direction: LearningSignalInput["direction"] = "inconclusive";
    let statement = `${actionLabel} recommendations are approved ${Math.round(approvalRate * 100)}% of the time.`;

    if (rejectionRate >= 0.5) {
      direction = "negative";
      statement = breakdown.dominantRejectionReason
        ? `${actionLabel} recommendations are often rejected, most commonly for being "${breakdown.dominantRejectionReason.replace(/_/g, " ")}."`
        : `${actionLabel} recommendations have shown limited impact so far.`;
    } else if (approvalRate >= 0.7 && breakdown.publishedCount > 0) {
      direction = "positive";
      statement = `${actionLabel} recommendations consistently perform well for your business.`;
    }

    signals.push({
      sourceProviderId: "recommendation_outcomes",
      sourceLabel: "Recommendation Outcomes",
      patternKey: `recommendation_action_outcome:${breakdown.actionType}`,
      statement,
      direction,
      confidence: breakdown.sampleSize >= 8 ? "high" : breakdown.sampleSize >= 5 ? "medium" : "low",
      evidenceSummary: `${breakdown.sampleSize} ${actionLabel} recommendations: ${breakdown.approvedCount} approved, ${breakdown.rejectedCount} rejected.`,
      occurredAt: breakdown.lastActivityAt,
    });
  }

  return signals;
}
