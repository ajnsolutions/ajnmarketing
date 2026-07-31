/**
 * Business Learning Engine adapter — turns a real, reinforced pattern about
 * a content-related action type into a content-refresh or content-expansion
 * opportunity. Never invents a pattern; only speaks up once the Learning
 * Engine itself has real reinforcement (reinforcementCount >= 2) behind a
 * genuinely positive or negative direction.
 */

import { RecommendedActionTypes, type RecommendedActionType } from "@/lib/marketing-decisions/types";
import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import { findPatternForActionType } from "@/lib/business-learning-engine/service";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import { OpportunityTypes, type OpportunityCandidateInput } from "@/lib/opportunity-engine/types";

const SOURCE_PROVIDER_ID = "business_learning_engine";
const SOURCE_LABEL = "Business Learning Engine";

const CONTENT_ACTION_TYPES = [
  RecommendedActionTypes.CREATE_TIMELY_CONTENT,
  RecommendedActionTypes.CREATE_SEASONAL_CONTENT,
  RecommendedActionTypes.REFRESH_WEBSITE_CONTENT,
] as const;

function patternToCandidate(actionType: RecommendedActionType, pattern: BusinessPattern): OpportunityCandidateInput | null {
  if (pattern.reinforcementCount < 2) return null;
  const label = formatRecommendedActionType(actionType);

  if (pattern.direction === "positive") {
    return {
      sourceProviderId: SOURCE_PROVIDER_ID,
      sourceLabel: SOURCE_LABEL,
      type: OpportunityTypes.HIGH_PERFORMING_CONTENT_EXPANSION,
      topic: label,
      statement: pattern.statement,
      whyNow: `We've seen ${label.toLowerCase()} work ${pattern.reinforcementCount} times before.`,
      expectedOutcome: "Doing more of what's already worked is lower-risk than starting a new approach from scratch.",
      confidence: pattern.effectiveConfidence,
      businessImpact: "medium",
      urgency: "low",
      evidenceSummary: pattern.statement,
      occurredAt: pattern.lastReinforced,
      relatedActionType: actionType,
    };
  }

  if (pattern.direction === "negative") {
    return {
      sourceProviderId: SOURCE_PROVIDER_ID,
      sourceLabel: SOURCE_LABEL,
      type: OpportunityTypes.UNDERPERFORMING_CONTENT_REFRESH,
      topic: label,
      statement: pattern.statement,
      whyNow: `${label} hasn't performed well ${pattern.reinforcementCount} times running.`,
      expectedOutcome: "A refreshed approach breaks the pattern before more effort goes into something that isn't landing.",
      confidence: pattern.effectiveConfidence,
      businessImpact: "medium",
      urgency: "medium",
      evidenceSummary: pattern.statement,
      occurredAt: pattern.lastReinforced,
      relatedActionType: actionType,
    };
  }

  return null;
}

export function businessLearningEngineOpportunityCandidates(
  patterns: BusinessPattern[] | null | undefined,
): OpportunityCandidateInput[] {
  if (!patterns?.length) return [];

  const candidates: OpportunityCandidateInput[] = [];
  for (const actionType of CONTENT_ACTION_TYPES) {
    const pattern = findPatternForActionType(patterns, actionType);
    if (!pattern) continue;
    const candidate = patternToCandidate(actionType, pattern);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}
