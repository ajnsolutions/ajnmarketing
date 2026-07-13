import type { RecommendedActionType } from "@/lib/marketing-decisions/types";

/**
 * Five-state execution outcome for one recommendation:
 *  - executed:         a new content_approvals draft was created just now.
 *  - already_executed: an active draft already existed (idempotent no-op, not an error).
 *  - skipped:          the recommendation's current status makes it ineligible right now
 *                       (not open/in_progress) -- may become eligible again later.
 *  - unsupported:      the recommendation's action type does not produce content at all
 *                       (e.g. request_reviews) -- this is a permanent classification for
 *                       that action type, not a transient failure.
 *  - failed:           an unexpected error occurred (generation, persistence, or the
 *                       recommendation/tenant could not be resolved). Always retryable --
 *                       nothing is left half-written on this path.
 */
export type RecommendationExecutionStatus =
  | "executed"
  | "already_executed"
  | "skipped"
  | "unsupported"
  | "failed";

export type RecommendationExecutionResult = {
  status: RecommendationExecutionStatus;
  recommendationId: string;
  businessProfileId: string | null;
  actionType: RecommendedActionType | null;
  contentApprovalId: string | null;
  reason: string;
};

export type RecommendationExecutionBatchSummary = {
  evaluated: number;
  executed: number;
  alreadyExecuted: number;
  skipped: number;
  unsupported: number;
  failed: number;
};

export type RecommendationExecutionBatchResult = {
  summary: RecommendationExecutionBatchSummary;
  results: RecommendationExecutionResult[];
};
