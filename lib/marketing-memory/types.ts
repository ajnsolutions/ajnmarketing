import "server-only";

/**
 * Marketing Memory Phase 1 — shared types and closed vocabularies. See
 * docs/MARKETING_MEMORY_FOUNDATION.md for the full design. Every enum here has a
 * matching `check` constraint in supabase/migrations/024_marketing_memory_foundation.sql
 * — this file and that migration must be changed together.
 */

export const MarketingMemoryObservationTypes = {
  RECOMMENDATION_DRAFTED: "recommendation_drafted",
  RECOMMENDATION_EDITED: "recommendation_edited",
  RECOMMENDATION_APPROVED: "recommendation_approved",
  RECOMMENDATION_REJECTED: "recommendation_rejected",
  RECOMMENDATION_DO_MORE_LIKE_THIS: "recommendation_do_more_like_this",
  PUBLISHING_QUEUED: "publishing_queued",
  PUBLISHING_SUCCEEDED: "publishing_succeeded",
  PUBLISHING_FAILED: "publishing_failed",
  PERFORMANCE_MEASURED: "performance_measured",
  ANALYTICS_SNAPSHOT_CAPTURED: "analytics_snapshot_captured",
  /** Campaign Intelligence — campaign execution finished (evidence only). */
  CAMPAIGN_COMPLETED: "campaign_completed",
} as const;

export type MarketingMemoryObservationType =
  (typeof MarketingMemoryObservationTypes)[keyof typeof MarketingMemoryObservationTypes];

export const MarketingMemorySourceSystems = {
  RECOMMENDATION_OUTCOMES: "recommendation-outcomes",
  ANALYTICS: "analytics",
  CAMPAIGN_INTELLIGENCE: "campaign-intelligence",
} as const;

export type MarketingMemorySourceSystem =
  (typeof MarketingMemorySourceSystems)[keyof typeof MarketingMemorySourceSystems];

/**
 * Factual outcome category only — never an interpretation of *why* something happened.
 * See lib/marketing-memory/mapping.ts for the exact, non-inferential
 * observation_type -> outcome_direction rule table.
 */
export const MarketingMemoryOutcomeDirections = {
  POSITIVE: "positive",
  NEGATIVE: "negative",
  NEUTRAL: "neutral",
  MIXED: "mixed",
  UNKNOWN: "unknown",
} as const;

export type MarketingMemoryOutcomeDirection =
  (typeof MarketingMemoryOutcomeDirections)[keyof typeof MarketingMemoryOutcomeDirections];

/** "permanent_explicit_preference" is reserved for a future phase (customer
 * preferences don't exist yet) and is deliberately not a valid value here. */
export const MarketingMemoryRetentionClassifications = {
  SHORT_LIVED_CONTEXT: "short_lived_context",
  STANDARD_OPERATIONAL_EVIDENCE: "standard_operational_evidence",
  LONG_TERM_AUDIT_EVIDENCE: "long_term_audit_evidence",
} as const;

export type MarketingMemoryRetentionClassification =
  (typeof MarketingMemoryRetentionClassifications)[keyof typeof MarketingMemoryRetentionClassifications];

/**
 * Central, closed vocabulary of supported evidence-link source entity types — the
 * single place that prevents arbitrary unvalidated source-type strings from spreading
 * through the codebase. 'monthly_focus' is reserved: Monthly Focus is currently a
 * computed-on-demand value with no persisted row, so no Phase 1 ingestion path
 * populates it yet.
 */
export const MarketingMemorySourceEntityTypes = {
  RECOMMENDATION: "recommendation",
  RECOMMENDATION_OUTCOME_EVENT: "recommendation_outcome_event",
  CONTENT_APPROVAL: "content_approval",
  PUBLISHING_JOB: "publishing_job",
  ANALYTICS_SNAPSHOT: "analytics_snapshot",
  MARKET_CONTEXT_ITEM: "market_context_item",
  MONTHLY_FOCUS: "monthly_focus",
  /** Phase 2 learning-anchored evidence citing an observation. */
  OBSERVATION: "observation",
  /** Phase 3: customer override cited as (usually contradicting) learning evidence. */
  OVERRIDE: "override",
  /** Campaign Intelligence execution plan (evidence only — never a Learning write). */
  CAMPAIGN: "campaign",
} as const;

export type MarketingMemorySourceEntityType =
  (typeof MarketingMemorySourceEntityTypes)[keyof typeof MarketingMemorySourceEntityTypes];

export const MarketingMemoryLinkTypes = {
  PRIMARY_SOURCE: "primary_source",
  RELATED_SOURCE: "related_source",
} as const;

export type MarketingMemoryLinkType =
  (typeof MarketingMemoryLinkTypes)[keyof typeof MarketingMemoryLinkTypes];

export const MarketingMemoryImpactDirections = {
  POSITIVE: "positive",
  NEGATIVE: "negative",
  NEUTRAL: "neutral",
  UNKNOWN: "unknown",
} as const;

export type MarketingMemoryImpactDirection =
  (typeof MarketingMemoryImpactDirections)[keyof typeof MarketingMemoryImpactDirections];

export const MarketingMemoryObservedVsForecastValues = {
  OBSERVED: "observed",
  FORECAST: "forecast",
} as const;

export type MarketingMemoryObservedVsForecast =
  (typeof MarketingMemoryObservedVsForecastValues)[keyof typeof MarketingMemoryObservedVsForecastValues];

/** One row of public.marketing_memory_context_snapshots. */
export type MarketingMemoryContextSnapshot = {
  id: string;
  user_id: string;
  business_profile_id: string;
  captured_at: string;
  context_item_ids: string[];
  context_summary: Record<string, unknown>;
  impact_direction: MarketingMemoryImpactDirection;
  observed_vs_forecast: MarketingMemoryObservedVsForecast;
  retention_classification: MarketingMemoryRetentionClassification;
  valid_from: string;
  valid_until: string | null;
  expires_at: string;
  idempotency_key: string;
  created_at: string;
};

/** One row of public.marketing_memory_observations. */
export type MarketingMemoryObservation = {
  id: string;
  user_id: string;
  business_profile_id: string;
  observation_type: MarketingMemoryObservationType;
  source_system: MarketingMemorySourceSystem;
  source_outcome_event_id: string | null;
  source_analytics_snapshot_id: string | null;
  source_campaign_id: string | null;
  context_snapshot_id: string | null;
  occurred_at: string;
  outcome_direction: MarketingMemoryOutcomeDirection;
  location_scope: string | null;
  metric_summary: Record<string, unknown>;
  schema_version: number;
  retention_classification: MarketingMemoryRetentionClassification;
  idempotency_key: string;
  created_at: string;
};

/** One row of public.marketing_memory_evidence_links. */
export type MarketingMemoryEvidenceLink = {
  id: string;
  user_id: string;
  business_profile_id: string;
  observation_id: string;
  source_type: MarketingMemorySourceEntityType;
  source_id: string;
  link_type: MarketingMemoryLinkType;
  idempotency_key: string;
  created_at: string;
};

/** Result of a best-effort ingestion attempt — never throws, always reports outcome. */
export type MarketingMemoryIngestionResult = {
  recorded: boolean;
  duplicate: boolean;
  observationId: string | null;
};
