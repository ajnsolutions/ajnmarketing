/**
 * Decision Intelligence & Learning Impact — closed vocabularies and entity shapes.
 * See docs/DECISION_INTELLIGENCE_AND_LEARNING_IMPACT.md.
 *
 * This is a read/explain layer over existing authoritative records. It never decides
 * anything — lib/marketing-director/resolveDecision.ts remains the sole place a
 * decision is made. Nothing here creates recommendations, campaigns, experiments,
 * preferences, learnings, or overrides.
 */

import type { MarketingDirectorDecisionType } from "@/lib/marketing-director/types";
import type { HeadOfMarketingPrimaryActionKind } from "@/lib/head-of-marketing/types";

// --- Decision snapshot (public.marketing_memory_decision_links) ----------------------

export type DecisionSnapshotStatus = "active" | "superseded";

export type IgnoredEvidenceEntry = {
  id: string;
  evidenceType: "learning" | "preference";
  reason: string;
};

/** One row of public.marketing_memory_decision_links. */
export type MarketingDirectorDecisionSnapshot = {
  id: string;
  user_id: string;
  business_profile_id: string;
  decision_type: MarketingDirectorDecisionType;
  title: string;
  customer_summary: string;
  priority_rank: number;
  action_type: HeadOfMarketingPrimaryActionKind | null;
  source_recommendation_id: string | null;
  source_campaign_id: string | null;
  consulted_learning_ids: string[];
  consulted_preference_ids: string[];
  ignored_evidence: IgnoredEvidenceEntry[];
  was_cold_start: boolean;
  decision_status: DecisionSnapshotStatus;
  evidence_version: number;
  input_fingerprint: string;
  supersedes_decision_id: string | null;
  evaluated_at: string;
  created_at: string;
};

// --- Evidence trace (Phase C/D) -------------------------------------------------------

/** Centralized, closed allowlist — see relationships.ts. Never an arbitrary string. */
export const DecisionEvidenceTypes = {
  RECOMMENDATION: "recommendation",
  RECOMMENDATION_OUTCOME: "recommendation_outcome",
  CAMPAIGN: "campaign",
  CAMPAIGN_COMPLETION: "campaign_completion",
  EXPERIMENT_PROPOSAL: "experiment_proposal",
  EXPERIMENT_COMPLETION: "experiment_completion",
  MARKETING_MEMORY_OBSERVATION: "marketing_memory_observation",
  MARKETING_MEMORY_LEARNING: "marketing_memory_learning",
  MARKETING_MEMORY_PREFERENCE: "marketing_memory_preference",
  MARKETING_MEMORY_OVERRIDE: "marketing_memory_override",
  MARKET_CONTEXT: "market_context",
} as const;

export type DecisionEvidenceType =
  (typeof DecisionEvidenceTypes)[keyof typeof DecisionEvidenceTypes];

export const DecisionEvidenceRelationshipTypes = {
  BASED_ON: "based_on",
  SUPPORTED_BY: "supported_by",
  CONSTRAINED_BY: "constrained_by",
  OVERRIDDEN_BY: "overridden_by",
  SUPERSEDED_BY: "superseded_by",
  INFORMED_BY: "informed_by",
  MEASURED_BY: "measured_by",
  PRODUCED_OBSERVATION: "produced_observation",
  PROMOTED_TO_LEARNING: "promoted_to_learning",
  LINKED_TO_CAMPAIGN: "linked_to_campaign",
  LINKED_TO_EXPERIMENT: "linked_to_experiment",
  LINKED_TO_RECOMMENDATION: "linked_to_recommendation",
  EXCLUDED_LOW_CONFIDENCE: "excluded_due_to_low_confidence",
  EXCLUDED_STALE: "excluded_due_to_staleness",
  EXCLUDED_CUSTOMER_OVERRIDE: "excluded_due_to_customer_override",
  EXCLUDED_PROHIBITION: "excluded_due_to_prohibition",
  EXCLUDED_INSUFFICIENT_ATTRIBUTION: "excluded_due_to_insufficient_attribution",
} as const;

export type DecisionEvidenceRelationshipType =
  (typeof DecisionEvidenceRelationshipTypes)[keyof typeof DecisionEvidenceRelationshipTypes];

export const DecisionEvidenceInfluenceStates = {
  APPLIED: "applied",
  CONSIDERED: "considered",
  EXCLUDED: "excluded",
  UNAVAILABLE: "unavailable",
} as const;

export type DecisionEvidenceInfluenceState =
  (typeof DecisionEvidenceInfluenceStates)[keyof typeof DecisionEvidenceInfluenceStates];

export const DecisionEvidenceConfidenceStates = {
  STRONG: "strong",
  DEVELOPING: "developing",
  EARLY: "early",
  INCONCLUSIVE: "inconclusive",
  NOT_APPLICABLE: "not_applicable",
} as const;

export type DecisionEvidenceConfidenceState =
  (typeof DecisionEvidenceConfidenceStates)[keyof typeof DecisionEvidenceConfidenceStates];

export const DecisionEvidenceRecencyStates = {
  CURRENT: "current",
  RECENT: "recent",
  STALE: "stale",
  UNKNOWN: "unknown",
} as const;

export type DecisionEvidenceRecencyState =
  (typeof DecisionEvidenceRecencyStates)[keyof typeof DecisionEvidenceRecencyStates];

/**
 * Client-safe, normalized evidence-trace entry. Never exposes internal scores, raw
 * weighting, unrestricted metadata, raw analytics payloads, or service-role details.
 */
export type DecisionEvidenceTrace = {
  id: string;
  decisionId: string;
  businessProfileId: string;
  evidenceType: DecisionEvidenceType;
  /** ID of the underlying authoritative record (recommendation/campaign/experiment/etc). */
  evidenceId: string;
  relationshipType: DecisionEvidenceRelationshipType;
  influenceState: DecisionEvidenceInfluenceState;
  /** Customer-facing sentence — no internal jargon. */
  customerExplanation: string;
  confidenceState: DecisionEvidenceConfidenceState;
  recencyState: DecisionEvidenceRecencyState;
  /** True when this evidence type is itself an authoritative decision-maker (e.g. an
   * explicit preference) rather than informational context (e.g. market context). */
  authoritative: boolean;
  overridden: boolean;
  superseded: boolean;
  excluded: boolean;
  exclusionReason: string | null;
  observedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** Allowlisted internal route to the authoritative feature — never an arbitrary URL. */
  sourceTarget: string | null;
};

// --- Decision comparison (Phase E) ----------------------------------------------------

export const DecisionChangeTypes = {
  ADDED: "added",
  REMOVED: "removed",
  INCREASED_PRIORITY: "increased_priority",
  DECREASED_PRIORITY: "decreased_priority",
  UNCHANGED: "unchanged",
  DEFERRED: "deferred",
  SUPERSEDED: "superseded",
  COMPLETED: "completed",
  BLOCKED: "blocked",
  EVIDENCE_STRENGTHENED: "evidence_strengthened",
  EVIDENCE_WEAKENED: "evidence_weakened",
  CUSTOMER_OVERRIDE_APPLIED: "customer_override_applied",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
} as const;

export type DecisionChangeType = (typeof DecisionChangeTypes)[keyof typeof DecisionChangeTypes];

export type DecisionChangeSummary = {
  previousDecisionId: string | null;
  currentDecisionId: string;
  changeType: DecisionChangeType;
  rankChanged: boolean;
  previousRank: number | null;
  currentRank: number;
  statusChanged: boolean;
  actionChanged: boolean;
  evidenceAdded: DecisionEvidenceTrace[];
  evidenceRemoved: DecisionEvidenceTrace[];
  evidenceSuperseded: DecisionEvidenceTrace[];
  preferenceImpact: boolean;
  overrideImpact: boolean;
  experimentImpact: boolean;
  campaignImpact: boolean;
  analyticsImpact: boolean;
  /** Deterministic, template-based — see explanations.ts. */
  explanation: string;
  certainty: "explicit_trace" | "no_safe_comparison";
  limitations: string[];
};

// --- Learning impact (Phase G/I) -------------------------------------------------------

export type LearningImpactSummary = {
  id: string;
  kind: "learning" | "preference" | "override";
  label: string;
  origin: string;
  supportingObservationCount: number;
  relatedCampaignIds: string[];
  relatedExperimentIds: string[];
  relatedRecommendationOutcomeCount: number;
  firstObservedAt: string | null;
  mostRecentSupportingAt: string | null;
  confidenceState: DecisionEvidenceConfidenceState;
  activeState: "active" | "superseded" | "inactive";
  influencedLaterDecision: boolean;
  influenceUnavailableReason: string | null;
  overriddenByCustomer: boolean;
  ignoredDueToPrecedence: string | null;
  insufficientEvidence: boolean;
};

// --- Timeline (Phase J) ----------------------------------------------------------------

export const DecisionTimelineEventTypes = {
  DECISION_GENERATED: "decision_generated",
  CAMPAIGN_COMPLETED: "campaign_completed",
  EXPERIMENT_PROPOSED: "experiment_proposed",
  EXPERIMENT_APPROVED: "experiment_approved",
  EXPERIMENT_COMPLETED: "experiment_completed",
  OBSERVATION_RECORDED: "observation_recorded",
  LEARNING_PROMOTED: "learning_promoted",
  PREFERENCE_PROMOTED: "preference_promoted",
  OVERRIDE_RECORDED: "override_recorded",
} as const;

export type DecisionTimelineEventType =
  (typeof DecisionTimelineEventTypes)[keyof typeof DecisionTimelineEventTypes];

export type DecisionTimelineEvent = {
  id: string;
  type: DecisionTimelineEventType;
  occurredAt: string;
  title: string;
  description: string;
  sourceTarget: string | null;
};

// --- Top-level response payload --------------------------------------------------------

export type DecisionIntelligenceWarning = {
  source: string;
  message: string;
};

export type DecisionIntelligenceSummary = {
  currentDecision: MarketingDirectorDecisionSnapshot | null;
  currentPriorities: { snapshot: MarketingDirectorDecisionSnapshot; trace: DecisionEvidenceTrace[] }[];
  comparison: DecisionChangeSummary | null;
  learningImpact: LearningImpactSummary[];
  timeline: DecisionTimelineEvent[];
  limitations: string[];
  warnings: DecisionIntelligenceWarning[];
  generatedAt: string;
};
