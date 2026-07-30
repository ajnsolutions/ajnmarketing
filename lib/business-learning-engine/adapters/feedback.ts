/**
 * Adapter: explicit customer feedback (Part 9) -> LearningSignalInput[].
 *
 * "This recommendation helped" / "This wasn't useful" is the most direct,
 * unambiguous signal the Learning Engine ever receives — a customer judging
 * a recommendation's real-world value, after the fact. Grouped by the
 * recommendation's action type, exactly like the recommendation-outcomes
 * adapter, so explicit feedback reinforces the same kind of pattern a
 * customer would recognize ("recommendations like this one").
 */

import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import type { RecommendedActionType } from "@/lib/marketing-decisions/types";
import type { LearningSignalInput, RecommendationFeedbackEvent } from "@/lib/business-learning-engine/types";

/** Minimum feedback events of the same action type before a pattern is
 * honest to state — a single "wasn't useful" click is real, but not yet a
 * pattern about that whole category of recommendation. */
const MIN_SAMPLE_SIZE = 2;

export type ActionTypeFeedbackBreakdown = {
  actionType: string;
  helpedCount: number;
  notUsefulCount: number;
  lastFeedbackAt: string | null;
};

function formatActionLabel(actionType: string): string {
  return formatRecommendedActionType(actionType as RecommendedActionType);
}

export function groupFeedbackEventsByActionType(
  events: Array<{ event: RecommendationFeedbackEvent; actionType: string }>,
): ActionTypeFeedbackBreakdown[] {
  const byActionType = new Map<string, ActionTypeFeedbackBreakdown>();

  for (const { event, actionType } of events) {
    const existing = byActionType.get(actionType) ?? {
      actionType,
      helpedCount: 0,
      notUsefulCount: 0,
      lastFeedbackAt: null,
    };
    if (event.feedback === "helped") existing.helpedCount += 1;
    else existing.notUsefulCount += 1;
    if (!existing.lastFeedbackAt || event.createdAt > existing.lastFeedbackAt) {
      existing.lastFeedbackAt = event.createdAt;
    }
    byActionType.set(actionType, existing);
  }

  return [...byActionType.values()];
}

export function feedbackBreakdownToLearningSignals(
  breakdowns: ActionTypeFeedbackBreakdown[] | null | undefined,
): LearningSignalInput[] {
  if (!breakdowns?.length) return [];

  const signals: LearningSignalInput[] = [];

  for (const breakdown of breakdowns) {
    const sampleSize = breakdown.helpedCount + breakdown.notUsefulCount;
    if (sampleSize < MIN_SAMPLE_SIZE) continue;

    const actionLabel = formatActionLabel(breakdown.actionType);
    const net = breakdown.helpedCount - breakdown.notUsefulCount;

    const direction: LearningSignalInput["direction"] =
      net > 0 ? "positive" : net < 0 ? "negative" : "inconclusive";

    const statement =
      direction === "positive"
        ? `Customers have told us ${actionLabel.toLowerCase()} recommendations helped.`
        : direction === "negative"
          ? `Customers have told us ${actionLabel.toLowerCase()} recommendations weren't useful.`
          : `Customer feedback on ${actionLabel.toLowerCase()} recommendations has been mixed.`;

    signals.push({
      sourceProviderId: "recommendation_feedback",
      sourceLabel: "Customer Feedback",
      patternKey: `recommendation_action_outcome:${breakdown.actionType}`,
      statement,
      direction,
      confidence: sampleSize >= 5 ? "high" : sampleSize >= 3 ? "medium" : "low",
      evidenceSummary: `${breakdown.helpedCount} said this helped, ${breakdown.notUsefulCount} said it wasn't useful.`,
      occurredAt: breakdown.lastFeedbackAt,
    });
  }

  return signals;
}
