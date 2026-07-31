/**
 * Opportunity scoring (Part 3) — evidence strength, business impact,
 * urgency, confidence, and historical success (Business Learning Engine),
 * blended so current evidence always remains the strongest signal. Pure,
 * deterministic — no AI call, nothing fabricated.
 */

import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import { findPatternForActionType } from "@/lib/business-learning-engine/service";
import type {
  ConfidenceLevel,
  ImpactLevel,
  OpportunityEvidence,
  OpportunityScore,
  UrgencyLevel,
} from "@/lib/opportunity-engine/types";

const TIER_SCORE: Record<"low" | "medium" | "high", number> = { low: 35, medium: 65, high: 100 };

function tierScore(tier: ConfidenceLevel | ImpactLevel | UrgencyLevel): number {
  return TIER_SCORE[tier];
}

/** More corroborating providers and more recent evidence make evidence
 * stronger — mirrors the Business Knowledge Graph's provider-count-driven
 * confidence, but scored continuously rather than tiered. */
export function evidenceStrengthScore(evidence: OpportunityEvidence[], now: Date): number {
  if (evidence.length === 0) return 0;

  const providerCount = new Set(evidence.map((e) => e.sourceProviderId)).size;
  const providerScore = Math.min(providerCount / 3, 1) * 70;

  const mostRecent = evidence
    .map((e) => e.occurredAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const daysOld = mostRecent ? Math.max(0, (now.getTime() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24)) : 90;
  const recencyScore = Math.max(0, 1 - daysOld / 60) * 30;

  return Math.round(providerScore + recencyScore);
}

/**
 * Historical success (Part 3) — reuses the Business Learning Engine's own
 * pattern for this opportunity's related action type, never a second
 * learning model. A genuinely positive, reinforced pattern nudges the score
 * up; a negative one nudges it down; anything thin or absent is neutral.
 * Weighted lowest of all factors in the total (see scoreOpportunity) so
 * history can never outweigh current evidence.
 */
export function historicalSuccessScore(
  relatedActionType: string | null | undefined,
  patterns: BusinessPattern[],
): number {
  if (!relatedActionType) return 50;
  const pattern = findPatternForActionType(patterns, relatedActionType);
  if (!pattern || pattern.reinforcementCount < 2) return 50;

  if (pattern.direction === "positive") return tierScore(pattern.effectiveConfidence);
  if (pattern.direction === "negative") return 100 - tierScore(pattern.effectiveConfidence);
  return 50;
}

const WEIGHTS = {
  evidenceStrength: 0.35,
  businessImpact: 0.2,
  urgency: 0.15,
  confidence: 0.2,
  historicalSuccess: 0.1,
} as const;

export function scoreOpportunity(input: {
  evidence: OpportunityEvidence[];
  businessImpact: ImpactLevel;
  urgency: UrgencyLevel;
  confidence: ConfidenceLevel;
  relatedActionType?: string | null;
  patterns: BusinessPattern[];
  now?: Date;
}): OpportunityScore {
  const now = input.now ?? new Date();
  const evidenceStrength = evidenceStrengthScore(input.evidence, now);
  const businessImpact = tierScore(input.businessImpact);
  const urgency = tierScore(input.urgency);
  const confidence = tierScore(input.confidence);
  const historicalSuccess = historicalSuccessScore(input.relatedActionType, input.patterns);

  const total = Math.round(
    evidenceStrength * WEIGHTS.evidenceStrength +
      businessImpact * WEIGHTS.businessImpact +
      urgency * WEIGHTS.urgency +
      confidence * WEIGHTS.confidence +
      historicalSuccess * WEIGHTS.historicalSuccess,
  );

  return { total, evidenceStrength, businessImpact, urgency, confidence, historicalSuccess };
}
