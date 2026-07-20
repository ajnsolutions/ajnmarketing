/**
 * Marketing Director → Experimentation Engine handoff.
 *
 * Marketing Director remains the only strategic decision-maker. This helper never
 * creates experiments autonomously — callers must still invoke the experiment service.
 */

import type {
  ExperimentType,
  ProposeExperimentInput,
} from "@/lib/marketing-experimentation/experiment-types";
import type { MarketingDirectorDecision } from "@/lib/marketing-director/types";

export type MarketingDirectorExperimentDirective = {
  experimentType: ExperimentType;
  createdFromRecommendationId: string;
  relatedCampaignId?: string | null;
  hypothesis?: string;
};

export function buildExperimentProposalFromDirectorDecision(
  decision: MarketingDirectorDecision,
  directive: MarketingDirectorExperimentDirective,
): ProposeExperimentInput {
  const decisionKey = [
    decision.decisionType,
    decision.evaluatedAt,
    decision.primaryAction.kind,
    directive.experimentType,
  ].join("|");

  return {
    experimentType: directive.experimentType,
    createdFromRecommendationId: directive.createdFromRecommendationId,
    marketingDirectorDecisionKey: decisionKey,
    relatedCampaignId: directive.relatedCampaignId ?? null,
    hypothesis: directive.hypothesis,
    proposedBy: "marketing_director",
  };
}
