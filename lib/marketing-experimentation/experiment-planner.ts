/**
 * Pure planner — builds experiment drafts from Director-gated proposals + templates.
 */

import {
  emptyExperimentMetrics,
  emptyExperimentOutcome,
} from "@/lib/marketing-experimentation/experiment-outcomes";
import { getExperimentTemplate } from "@/lib/marketing-experimentation/experiment-templates";
import {
  ExperimentStatuses,
  type ExperimentMetrics,
  type ExperimentOutcome,
  type ExperimentType,
  type ExperimentVariant,
  type ProposeExperimentInput,
} from "@/lib/marketing-experimentation/experiment-types";

export type PlannedExperimentDraft = {
  experiment_type: ExperimentType;
  title: string;
  hypothesis: string;
  status: typeof ExperimentStatuses.DRAFT;
  variants: ExperimentVariant[];
  outcome: ExperimentOutcome;
  metrics: ExperimentMetrics;
  created_from_recommendation_id: string;
  related_campaign_id: string | null;
  marketing_director_decision_key: string;
  template_id: string;
  started_at: null;
  measured_at: null;
  completed_at: null;
  schema_version: number;
};

export function planExperimentFromDirector(
  input: ProposeExperimentInput,
): PlannedExperimentDraft {
  if (input.proposedBy !== "marketing_director") {
    throw new Error(
      "Experimentation Engine refuses self-proposal; Marketing Director must propose.",
    );
  }
  if (!input.marketingDirectorDecisionKey.trim()) {
    throw new Error("marketingDirectorDecisionKey is required.");
  }
  if (!input.createdFromRecommendationId.trim()) {
    throw new Error(
      "createdFromRecommendationId is required — experiments must cite an existing recommendation.",
    );
  }

  const template = getExperimentTemplate(input.experimentType);
  if (!template) {
    throw new Error(`Unknown experiment type: ${input.experimentType}`);
  }

  return {
    experiment_type: template.experimentType,
    title: template.title,
    hypothesis: input.hypothesis?.trim() || template.defaultHypothesis,
    status: ExperimentStatuses.DRAFT,
    variants: [...template.variants],
    outcome: emptyExperimentOutcome(),
    metrics: emptyExperimentMetrics(),
    created_from_recommendation_id: input.createdFromRecommendationId.trim(),
    related_campaign_id: input.relatedCampaignId ?? null,
    marketing_director_decision_key: input.marketingDirectorDecisionKey.trim(),
    template_id: template.id,
    started_at: null,
    measured_at: null,
    completed_at: null,
    schema_version: 1,
  };
}
