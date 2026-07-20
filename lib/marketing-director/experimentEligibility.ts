/**
 * Marketing Director → Experimentation Engine proposal eligibility.
 *
 * Deterministic, declarative rule for whether Marketing Director may propose an
 * experiment for a given recommendation. No LLM. No ML. No inferred/arbitrary variants —
 * every experiment type this rule can produce maps to a fixed, pre-declared template
 * (lib/marketing-experimentation/experiment-templates.ts). A recommendation existing is
 * not, by itself, an experiment proposal; every condition below must hold.
 *
 * This module is pure — it takes already-fetched facts and returns a decision. Callers
 * (lib/marketing-experimentation/proposal-service.ts) are responsible for fetching those
 * facts and, if eligible, persisting the resulting proposal server-side only.
 */

import { RecommendationStatuses, type RecommendedActionType } from "@/lib/marketing-decisions/types";
import type { ExperimentType } from "@/lib/marketing-experimentation/experiment-types";

/**
 * A recommendation's action type must appear here to ever be proposable. Deliberately
 * narrow: only the two experiment types whose "variant" concept already maps onto an
 * existing, timestamped record (publishing_queue's scheduled_for/published_at) are
 * eligible in this phase. See experiment-templates.ts SUPPORTED_EXPERIMENT_TYPES for the
 * matching allowlist and the reasoning for deferring the other five declared types.
 */
const ACTION_TYPE_TO_EXPERIMENT_TYPE: Partial<Record<RecommendedActionType, ExperimentType>> = {
  publish_gbp_post: "posting_time",
  increase_posting_frequency: "posting_time",
  request_reviews: "review_request_timing",
};

/** Minimum analytics_snapshots rows required before a proposal may be produced. */
export const MIN_ANALYTICS_HISTORY_SNAPSHOTS = 3;

/** Exposed so callers can resolve the target experiment type before running duplicate
 * checks (evaluateExperimentEligibility itself needs those checks as input). Returns
 * null for any action type not allowlisted for experimentation. */
export function experimentTypeForRecommendedActionType(
  actionType: RecommendedActionType,
): ExperimentType | null {
  return ACTION_TYPE_TO_EXPERIMENT_TYPE[actionType] ?? null;
}

export type ExperimentEligibilityInput = {
  recommendation: {
    id: string;
    recommendedActionType: RecommendedActionType;
    status: string;
  };
  analyticsSnapshotCount: number;
  /** A pending proposal already exists for this recommendation + the mapped experiment type. */
  hasPendingProposalForType: boolean;
  /** An active (non-terminal) experiment already exists for this recommendation + type. */
  hasActiveExperimentForType: boolean;
};

export type ExperimentEligibilityResult =
  | { eligible: true; experimentType: ExperimentType; reason: string }
  | { eligible: false; reason: string };

export function evaluateExperimentEligibility(
  input: ExperimentEligibilityInput,
): ExperimentEligibilityResult {
  if (input.recommendation.status !== RecommendationStatuses.OPEN) {
    return {
      eligible: false,
      reason: `recommendation status "${input.recommendation.status}" is not "open"`,
    };
  }

  const experimentType = ACTION_TYPE_TO_EXPERIMENT_TYPE[input.recommendation.recommendedActionType];
  if (!experimentType) {
    return {
      eligible: false,
      reason: `recommendation action type "${input.recommendation.recommendedActionType}" is not allowlisted for experimentation`,
    };
  }

  if (input.analyticsSnapshotCount < MIN_ANALYTICS_HISTORY_SNAPSHOTS) {
    return {
      eligible: false,
      reason: `insufficient analytics history (${input.analyticsSnapshotCount} snapshot(s), need at least ${MIN_ANALYTICS_HISTORY_SNAPSHOTS})`,
    };
  }

  if (input.hasPendingProposalForType) {
    return {
      eligible: false,
      reason: "a pending proposal already exists for this recommendation and experiment type",
    };
  }

  if (input.hasActiveExperimentForType) {
    return {
      eligible: false,
      reason: "an active experiment already exists for this recommendation and experiment type",
    };
  }

  return {
    eligible: true,
    experimentType,
    reason: `recommendation action type "${input.recommendation.recommendedActionType}" is allowlisted for "${experimentType}" experimentation, with sufficient analytics history and no conflicting proposal or experiment`,
  };
}
