/**
 * Business Learning Engine — reusable patterns learned from real
 * recommendation outcomes, not a generic memory database and not a generic
 * event log. Builds on top of already-shipped infrastructure:
 *
 *  - lib/recommendation-outcomes/ (deterministic lifecycle + usefulness signal)
 *  - lib/marketing-memory/ (statistically evaluated timing/action-outcome learnings)
 *  - lib/business-knowledge-graph/ (cross-source business conclusions)
 *  - this module's own recommendation_feedback_events (explicit customer reinforcement)
 *
 * Every provider normalizes into the shared LearningSignalInput contract so a
 * future provider (Testimonials, Weather, GBP Insights, Competitor
 * Intelligence, Social Analytics, Advertising, Email Marketing) contributes
 * automatically by adding one adapter — see docs/project-magic/BUSINESS_LEARNING_ENGINE.md.
 */

export const PatternDirections = {
  POSITIVE: "positive",
  NEGATIVE: "negative",
  NEUTRAL: "neutral",
  INCONCLUSIVE: "inconclusive",
} as const;

export type PatternDirection = (typeof PatternDirections)[keyof typeof PatternDirections];

export const ConfidenceLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type ConfidenceLevel = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

export const DecayStates = {
  FRESH: "fresh",
  DECAYING: "decaying",
  STALE: "stale",
} as const;

export type DecayState = (typeof DecayStates)[keyof typeof DecayStates];

/** One piece of evidence backing a pattern — always traceable to a real,
 * opaque provider id. Never a raw provider payload; never chain-of-thought. */
export type PatternEvidence = {
  id: string;
  sourceProviderId: string;
  sourceLabel: string;
  summary: string;
  occurredAt: string | null;
};

/**
 * One normalized signal a provider adapter emits — the common contract
 * every adapter (Marketing Memory, Recommendation Outcomes, Business
 * Knowledge Graph, explicit feedback, and any future provider) produces.
 * The reinforcement engine only ever operates on this shape — never on a
 * provider-specific payload (Part 10).
 */
export type LearningSignalInput = {
  sourceProviderId: string;
  sourceLabel: string;
  /** Deterministic key identifying "this same pattern" across reinforcements
   * — namespaced per provider so two providers never accidentally collide
   * on the same key for unrelated patterns. */
  patternKey: string;
  /** Customer-safe statement — never internal/raw language. */
  statement: string;
  direction: PatternDirection;
  /** This signal's own confidence — not the pattern's blended confidence. */
  confidence: ConfidenceLevel;
  evidenceSummary: string;
  occurredAt: string | null;
};

/** One row of public.business_learning_patterns, as read from the database. */
export type BusinessPattern = {
  id: string;
  patternKey: string;
  statement: string;
  direction: PatternDirection;
  /** Stored confidence level, before decay is applied. */
  confidenceLevel: ConfidenceLevel;
  contributingProviders: string[];
  evidence: PatternEvidence[];
  firstObserved: string;
  lastReinforced: string;
  reinforcementCount: number;
  decayState: DecayState;
  /** confidenceLevel after decay is applied — the level consumers should
   * actually present and reason with. See confidence.ts. */
  effectiveConfidence: ConfidenceLevel;
};

/** Every distinct sourceProviderId represented in a pattern's evidence. */
export function contributingProvidersFromEvidence(evidence: PatternEvidence[]): string[] {
  return [...new Set(evidence.map((e) => e.sourceProviderId))];
}

export const RecommendationFeedbackValues = {
  HELPED: "helped",
  NOT_USEFUL: "not_useful",
} as const;

export type RecommendationFeedbackValue =
  (typeof RecommendationFeedbackValues)[keyof typeof RecommendationFeedbackValues];

/** One row of public.recommendation_feedback_events. */
export type RecommendationFeedbackEvent = {
  id: string;
  recommendationId: string;
  feedback: RecommendationFeedbackValue;
  comment: string | null;
  createdAt: string;
};
