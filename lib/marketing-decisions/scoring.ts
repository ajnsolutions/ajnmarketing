import type { MarketingOpportunity, OpportunitySeverity } from "@/lib/marketing-opportunities/types";
import type { RecommendationUrgency } from "@/lib/marketing-decisions/types";
import { RecommendationUrgencies } from "@/lib/marketing-decisions/types";

const SEVERITY_WEIGHT: Record<OpportunitySeverity, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

/**
 * How much sooner an opportunity's time window closes should raise its urgency.
 * Opportunities with no expires_at (persistent-state categories like missing photos)
 * get no time-urgency bonus — their weight comes entirely from severity/confidence.
 */
function timeUrgencyBonus(expiresAt: string | null, now: Date): number {
  if (!expiresAt) return 0;

  const daysUntilExpiry = (new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= 0) return 0; // already past its window; caller is expected to only pass active opportunities
  if (daysUntilExpiry <= 3) return 100;
  if (daysUntilExpiry <= 7) return 70;
  if (daysUntilExpiry <= 14) return 40;
  return 10;
}

/**
 * Deterministic 0-100 score for a single opportunity: 50% severity, 30% confidence, 20%
 * how soon its window closes. Weighted this way so a low-confidence, low-severity
 * opportunity can't outrank a high-severity one just by having a near-term expiry, but a
 * closing window still meaningfully nudges otherwise-similar opportunities apart.
 */
export function scoreOpportunity(opportunity: MarketingOpportunity, now: Date = new Date()): number {
  const severityComponent = SEVERITY_WEIGHT[opportunity.severity];
  const confidenceComponent = opportunity.confidence;
  const timeComponent = timeUrgencyBonus(opportunity.expires_at, now);

  return clampScore(severityComponent * 0.5 + confidenceComponent * 0.3 + timeComponent * 0.2);
}

/**
 * A recommendation's priority is the strongest single opportunity behind it, plus a
 * small bonus per additional merged opportunity (capped) — several opportunities
 * pointing the same direction is more compelling than one alone, but shouldn't let a
 * pile of weak signals out-rank one strong, urgent one on its own.
 */
export function aggregatePriorityScore(opportunityScores: number[]): number {
  if (opportunityScores.length === 0) return 0;

  const max = Math.max(...opportunityScores);
  const groupBonus = Math.min(15, (opportunityScores.length - 1) * 5);

  return clampScore(max + groupBonus);
}

export function aggregateConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;

  const average = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return clampScore(average);
}

/** Urgency is derived directly from priority_score, so the two never contradict each other. */
export function urgencyFromPriorityScore(priorityScore: number): RecommendationUrgency {
  if (priorityScore >= 85) return RecommendationUrgencies.CRITICAL;
  if (priorityScore >= 65) return RecommendationUrgencies.HIGH;
  if (priorityScore >= 40) return RecommendationUrgencies.MEDIUM;
  return RecommendationUrgencies.LOW;
}
