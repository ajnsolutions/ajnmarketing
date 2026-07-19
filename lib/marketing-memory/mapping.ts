import "server-only";

import { RecommendationOutcomeEventTypes, type RecommendationOutcomeEventType } from "@/lib/recommendation-outcomes/types";
import {
  MarketingMemoryObservationTypes,
  MarketingMemoryOutcomeDirections,
  MarketingMemoryRetentionClassifications,
  type MarketingMemoryObservationType,
  type MarketingMemoryOutcomeDirection,
  type MarketingMemoryRetentionClassification,
} from "@/lib/marketing-memory/types";

const OUTCOME_EVENT_TO_OBSERVATION_TYPE: Record<RecommendationOutcomeEventType, MarketingMemoryObservationType> = {
  [RecommendationOutcomeEventTypes.DRAFT_CREATED]: MarketingMemoryObservationTypes.RECOMMENDATION_DRAFTED,
  [RecommendationOutcomeEventTypes.DRAFT_EDITED]: MarketingMemoryObservationTypes.RECOMMENDATION_EDITED,
  [RecommendationOutcomeEventTypes.DRAFT_APPROVED]: MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED,
  [RecommendationOutcomeEventTypes.DRAFT_REJECTED]: MarketingMemoryObservationTypes.RECOMMENDATION_REJECTED,
  [RecommendationOutcomeEventTypes.PUBLISHING_QUEUED]: MarketingMemoryObservationTypes.PUBLISHING_QUEUED,
  [RecommendationOutcomeEventTypes.PUBLISHING_SUCCEEDED]: MarketingMemoryObservationTypes.PUBLISHING_SUCCEEDED,
  [RecommendationOutcomeEventTypes.PUBLISHING_FAILED]: MarketingMemoryObservationTypes.PUBLISHING_FAILED,
  [RecommendationOutcomeEventTypes.PERFORMANCE_MEASURED]: MarketingMemoryObservationTypes.PERFORMANCE_MEASURED,
  [RecommendationOutcomeEventTypes.DO_MORE_LIKE_THIS]: MarketingMemoryObservationTypes.RECOMMENDATION_DO_MORE_LIKE_THIS,
};

/** Every RecommendationOutcomeEventType maps to exactly one observation type — a 1:1,
 * exhaustive, compile-time-checked table (adding a new event type without updating this
 * map is a TypeScript error). */
export function observationTypeForOutcomeEvent(
  eventType: RecommendationOutcomeEventType
): MarketingMemoryObservationType {
  return OUTCOME_EVENT_TO_OBSERVATION_TYPE[eventType];
}

/**
 * Purely factual, non-inferential mapping — records *what happened*, never *why* or
 * *whether it was good*. performance_measured is deliberately always "unknown": judging
 * whether a metric is good or bad requires a baseline comparison, which is Learning-
 * layer work and explicitly out of scope for Phase 1 (see
 * docs/MARKETING_MEMORY_ARCHITECTURE.md). "mixed" is a valid value in the schema for a
 * future source that can express it, but no Phase 1 mapping ever produces it.
 */
const OBSERVATION_TYPE_TO_OUTCOME_DIRECTION: Record<MarketingMemoryObservationType, MarketingMemoryOutcomeDirection> = {
  [MarketingMemoryObservationTypes.RECOMMENDATION_DRAFTED]: MarketingMemoryOutcomeDirections.NEUTRAL,
  [MarketingMemoryObservationTypes.RECOMMENDATION_EDITED]: MarketingMemoryOutcomeDirections.NEUTRAL,
  [MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED]: MarketingMemoryOutcomeDirections.POSITIVE,
  [MarketingMemoryObservationTypes.RECOMMENDATION_REJECTED]: MarketingMemoryOutcomeDirections.NEGATIVE,
  [MarketingMemoryObservationTypes.RECOMMENDATION_DO_MORE_LIKE_THIS]: MarketingMemoryOutcomeDirections.POSITIVE,
  [MarketingMemoryObservationTypes.PUBLISHING_QUEUED]: MarketingMemoryOutcomeDirections.NEUTRAL,
  [MarketingMemoryObservationTypes.PUBLISHING_SUCCEEDED]: MarketingMemoryOutcomeDirections.POSITIVE,
  [MarketingMemoryObservationTypes.PUBLISHING_FAILED]: MarketingMemoryOutcomeDirections.NEGATIVE,
  [MarketingMemoryObservationTypes.PERFORMANCE_MEASURED]: MarketingMemoryOutcomeDirections.UNKNOWN,
  [MarketingMemoryObservationTypes.ANALYTICS_SNAPSHOT_CAPTURED]: MarketingMemoryOutcomeDirections.NEUTRAL,
  [MarketingMemoryObservationTypes.CAMPAIGN_COMPLETED]: MarketingMemoryOutcomeDirections.NEUTRAL,
};

export function outcomeDirectionForObservationType(
  observationType: MarketingMemoryObservationType
): MarketingMemoryOutcomeDirection {
  return OBSERVATION_TYPE_TO_OUTCOME_DIRECTION[observationType];
}

/**
 * Every recommendation-outcome-derived observation inherits recommendation_outcome_
 * events' own "durable source of truth" treatment (long_term_audit_evidence) — that
 * table's own doc comment already establishes it as "one durable, uniquely-keyed row
 * per real lifecycle transition." analytics_snapshot_captured observations are daily
 * operational cadence facts, not individually significant lifecycle transitions, so they
 * default to standard_operational_evidence instead.
 */
export function retentionClassificationForObservationType(
  observationType: MarketingMemoryObservationType
): MarketingMemoryRetentionClassification {
  if (observationType === MarketingMemoryObservationTypes.ANALYTICS_SNAPSHOT_CAPTURED) {
    return MarketingMemoryRetentionClassifications.STANDARD_OPERATIONAL_EVIDENCE;
  }
  return MarketingMemoryRetentionClassifications.LONG_TERM_AUDIT_EVIDENCE;
}
