/**
 * Customer-safe dashboard projections for experiments.
 */

import {
  ExperimentConfidenceLevels,
  type ExperimentDashboardCard,
  type MarketingExperiment,
} from "@/lib/marketing-experimentation/experiment-types";

function confidenceLabel(level: string): string {
  switch (level) {
    case ExperimentConfidenceLevels.STRONG:
      return "Strong signal";
    case ExperimentConfidenceLevels.MODERATE:
      return "Moderate signal";
    case ExperimentConfidenceLevels.EARLY:
      return "Early signal";
    default:
      return "Insufficient data";
  }
}

export function toExperimentDashboardCard(
  experiment: MarketingExperiment,
): ExperimentDashboardCard {
  return {
    id: experiment.id,
    experimentType: experiment.experiment_type,
    title: experiment.title,
    hypothesis: experiment.hypothesis,
    status: experiment.status,
    outcomeSummary: experiment.outcome.summary,
    confidenceLabel: confidenceLabel(experiment.outcome.confidenceLevel),
    attributionAvailable: experiment.outcome.attributionAvailable,
    recommendationId: experiment.created_from_recommendation_id,
    campaignId: experiment.related_campaign_id,
    variants: experiment.variants,
  };
}

export function toExperimentDashboardCards(
  experiments: MarketingExperiment[],
): ExperimentDashboardCard[] {
  return experiments.map(toExperimentDashboardCard);
}
