/**
 * Marketing Director → Campaign Intelligence handoff.
 *
 * Marketing Director remains the only strategic decision-maker. This helper never
 * creates recommendations and never calls the Campaign Engine autonomously — callers
 * must still invoke initiateCampaignForBusiness with the returned payload.
 */

import type { CampaignType, InitiateCampaignInput } from "@/lib/campaign-intelligence/campaign-types";
import type { MarketingDirectorDecision } from "@/lib/marketing-director/types";

export type MarketingDirectorCampaignDirective = {
  campaignType: CampaignType;
  objective: string;
  /** Optional link to an existing recommendation the Director is executing against. */
  createdFromRecommendationId?: string | null;
  startDate?: string | null;
};

/**
 * Build a Campaign Engine initiation payload from an already-resolved Director decision.
 * Campaign Engine will refuse the payload if initiatedBy is missing/altered.
 */
export function buildCampaignInitiationFromDirectorDecision(
  decision: MarketingDirectorDecision,
  directive: MarketingDirectorCampaignDirective,
): InitiateCampaignInput {
  const decisionKey = [
    decision.decisionType,
    decision.evaluatedAt,
    decision.primaryAction.kind,
    directive.campaignType,
  ].join("|");

  return {
    campaignType: directive.campaignType,
    objective: directive.objective,
    marketingDirectorDecisionKey: decisionKey,
    createdFromRecommendationId: directive.createdFromRecommendationId ?? null,
    startDate: directive.startDate ?? null,
    initiatedBy: "marketing_director",
  };
}
