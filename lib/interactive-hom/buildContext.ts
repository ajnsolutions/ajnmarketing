/**
 * Build grounded Interactive HoM context from existing briefing + memory evidence.
 * Pure — no DB, no LLM, no second decision pipeline.
 */

import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import type { MarketingMemoryEvidencePackage } from "@/lib/marketing-memory/evidenceTypes";
import type { InteractiveHomGroundedContext } from "@/lib/interactive-hom/types";

export type BuildInteractiveHomContextInput = {
  briefing: HeadOfMarketingBriefing;
  memoryEvidence: MarketingMemoryEvidencePackage | null;
  pendingApprovals?: number;
  openRecommendations?: number;
  unansweredReviews?: number;
  publishFailures?: number;
};

/**
 * Assembles customer-safe facts already produced by Marketing Director, Executive Brief,
 * Campaign Intelligence, and Marketing Memory. Never re-ranks or invents recommendations.
 */
export function buildInteractiveHomContext(
  input: BuildInteractiveHomContextInput,
): InteractiveHomGroundedContext {
  const { briefing, memoryEvidence } = input;

  return {
    businessName: briefing.businessName,
    health: briefing.health,
    primaryAction: briefing.primaryAction,
    recommendation: briefing.recommendation,
    thisWeek: [...briefing.thisWeek],
    noticed: [...briefing.noticed],
    nextWeek: [...briefing.nextWeek],
    monthlyFocus: briefing.monthlyFocus,
    executiveBrief: briefing.executiveBrief,
    campaigns: [...briefing.campaigns],
    preferences: memoryEvidence?.preferences ?? [],
    learnings: memoryEvidence?.learnings ?? [],
    marketContextSignals: memoryEvidence?.marketContextSignals ?? [],
    memoryColdStart: memoryEvidence?.isColdStart ?? true,
    pendingApprovals: input.pendingApprovals ?? 0,
    openRecommendations: input.openRecommendations ?? 0,
    unansweredReviews: input.unansweredReviews ?? 0,
    publishFailures: input.publishFailures ?? 0,
  };
}
