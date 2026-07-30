/**
 * Recommendation lifecycle (Part 3) — a customer-facing normalization over
 * three already-existing, narrower vocabularies (RecommendationStatus from
 * lib/marketing-decisions/types.ts, RecommendationLifecycleStatus +
 * UsefulnessSignal from lib/recommendation-outcomes/types.ts, and this
 * module's own explicit feedback). Never a new persisted status column —
 * derived on read, exactly like lib/recommendation-outcomes' own
 * presentOutcomeStatus() pattern.
 */

import type { RecommendationOutcomeSummary } from "@/lib/recommendation-outcomes/types";
import type { RecommendationFeedbackValue } from "@/lib/business-learning-engine/types";

export const RecommendationLifecycleStates = {
  SUGGESTED: "suggested",
  GENERATED: "generated",
  APPROVED: "approved",
  REJECTED: "rejected",
  DEFERRED: "deferred",
  PUBLISHED: "published",
  OBSERVED: "observed",
  SUCCESSFUL: "successful",
  UNSUCCESSFUL: "unsuccessful",
  RETIRED: "retired",
} as const;

export type RecommendationLifecycleState =
  (typeof RecommendationLifecycleStates)[keyof typeof RecommendationLifecycleStates];

export const RECOMMENDATION_LIFECYCLE_LABELS: Record<RecommendationLifecycleState, string> = {
  suggested: "Suggested",
  generated: "Content generated",
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
  published: "Published",
  observed: "Observing results",
  successful: "Successful",
  unsuccessful: "Unsuccessful",
  retired: "Retired",
};

export type DeriveLifecycleStateInput = {
  /** Row status from public.marketing_recommendations. */
  recommendationStatus: "open" | "in_progress" | "dismissed" | "completed" | "superseded";
  /** Null when no draft/outcome activity exists yet for this recommendation. */
  outcome: RecommendationOutcomeSummary | null;
  /** True when an active marketing_memory_overrides row of type
   * "deferred_recommendation" exists for this recommendation. */
  isDeferred: boolean;
  /** Most recent explicit customer feedback (Part 9), if any. */
  feedback: RecommendationFeedbackValue | null;
};

/**
 * Pure, deterministic derivation — first matching rule wins. Explicit
 * customer feedback is the most authoritative signal (it directly answers
 * "did this work"); terminal recommendation states come next; then the
 * deterministic outcome lifecycle; falling back to "suggested" when nothing
 * has happened yet.
 */
export function deriveRecommendationLifecycleState(
  input: DeriveLifecycleStateInput,
): RecommendationLifecycleState {
  if (input.feedback === "not_useful") return RecommendationLifecycleStates.UNSUCCESSFUL;
  if (input.feedback === "helped") return RecommendationLifecycleStates.SUCCESSFUL;

  if (input.recommendationStatus === "superseded" || input.recommendationStatus === "dismissed") {
    return RecommendationLifecycleStates.RETIRED;
  }

  if (!input.outcome) return RecommendationLifecycleStates.SUGGESTED;

  if (input.outcome.lifecycleStatus === "measured") return RecommendationLifecycleStates.OBSERVED;

  if (
    input.outcome.lifecycleStatus === "published" ||
    input.outcome.lifecycleStatus === "publishing" ||
    input.outcome.lifecycleStatus === "publishing_queued" ||
    input.outcome.lifecycleStatus === "publish_failed"
  ) {
    return RecommendationLifecycleStates.PUBLISHED;
  }

  if (input.outcome.rejectedAt) return RecommendationLifecycleStates.REJECTED;
  if (input.isDeferred) return RecommendationLifecycleStates.DEFERRED;
  if (input.outcome.approvedAt) return RecommendationLifecycleStates.APPROVED;
  if (input.outcome.lifecycleStatus === "awaiting_review") return RecommendationLifecycleStates.GENERATED;

  return RecommendationLifecycleStates.SUGGESTED;
}
