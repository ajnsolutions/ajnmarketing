/**
 * Shared BusinessInsight contract for Business Brain intelligence sources.
 *
 * Every intelligence engine (Customer Voice, External Intelligence, future)
 * normalizes into this shape so Recommendation Engine / Growth Advisor /
 * Marketing Health never consume provider-specific payloads.
 *
 * Generate once. Reuse everywhere.
 */

export const ConfidenceLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type ConfidenceLevel = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

export const BusinessImpactLevels = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type BusinessImpactLevel =
  (typeof BusinessImpactLevels)[keyof typeof BusinessImpactLevels];

export const TimeHorizons = {
  IMMEDIATE: "immediate",
  NEAR_TERM: "near_term",
  THIS_SEASON: "this_season",
  ONGOING: "ongoing",
  UNKNOWN: "unknown",
} as const;

export type TimeHorizon = (typeof TimeHorizons)[keyof typeof TimeHorizons];

/** Opaque evidence supporting an insight — never a raw provider payload. */
export type BusinessInsightEvidence = {
  id: string;
  summary: string;
  occurredAt: string | null;
  /** Opaque provider id — consumers must not branch on this for product logic. */
  sourceProviderId: string;
  sourceLabel: string;
  quality: ConfidenceLevel;
};

/** Suggestion only — never prioritized here. */
export type BusinessInsightPossibleAction = {
  id: string;
  label: string;
  href: string | null;
};

/**
 * Shared Business Brain insight contract.
 * All intelligence sources implement (or adapt to) this interface.
 */
export type BusinessInsight = {
  id: string;
  /** Source-specific category key (e.g. seasonal_opportunities, customer_voice_strength). */
  category: string;
  insight: string;
  confidence: ConfidenceLevel;
  businessImpact: BusinessImpactLevel;
  timeHorizon: TimeHorizon;
  evidence: BusinessInsightEvidence[];
  possibleActions: BusinessInsightPossibleAction[];
  /** Business goal keys when known — never invented. */
  relatedGoals: string[];
  lastUpdated: string;
};

export function isBusinessInsight(value: unknown): value is BusinessInsight {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.category === "string" &&
    typeof v.insight === "string" &&
    (v.confidence === "low" || v.confidence === "medium" || v.confidence === "high") &&
    (v.businessImpact === "low" ||
      v.businessImpact === "medium" ||
      v.businessImpact === "high") &&
    typeof v.timeHorizon === "string" &&
    Array.isArray(v.evidence) &&
    Array.isArray(v.possibleActions) &&
    Array.isArray(v.relatedGoals) &&
    typeof v.lastUpdated === "string"
  );
}
