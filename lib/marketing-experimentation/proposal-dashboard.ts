/**
 * Customer-safe dashboard projections for experiment proposals.
 */

import type { ExperimentProposalCard, MarketingExperimentProposal } from "@/lib/marketing-experimentation/proposal-types";

export function toExperimentProposalCard(
  proposal: MarketingExperimentProposal,
): ExperimentProposalCard {
  return {
    id: proposal.id,
    experimentType: proposal.experiment_type,
    title: proposal.title,
    hypothesis: proposal.hypothesis,
    controlDefinition: proposal.control_definition,
    treatmentDefinition: proposal.treatment_definition,
    primaryKpi: proposal.primary_kpi,
    measurementWindowDays: proposal.measurement_window_days,
    recommendationId: proposal.recommendation_id,
    campaignId: proposal.campaign_id,
    proposalStatus: proposal.proposal_status,
  };
}

export function toExperimentProposalCards(
  proposals: MarketingExperimentProposal[],
): ExperimentProposalCard[] {
  return proposals.map(toExperimentProposalCard);
}
