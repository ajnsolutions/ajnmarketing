/**
 * Declarative campaign planning — builds an execution plan from a template.
 * Never invents recommendations; steps only reuse existing action types.
 */

import { emptyCampaignMetrics } from "@/lib/campaign-intelligence/campaign-metrics";
import { getCampaignTemplate } from "@/lib/campaign-intelligence/campaign-templates";
import {
  buildTimelineFromTemplate,
  currentStepIndex,
  orderTimeline,
} from "@/lib/campaign-intelligence/campaign-timeline";
import {
  CampaignStatuses,
  type CampaignType,
  type InitiateCampaignInput,
  type MarketingCampaign,
} from "@/lib/campaign-intelligence/campaign-types";

export type PlannedCampaignDraft = {
  campaign_type: CampaignType;
  objective: string;
  status: typeof CampaignStatuses.DRAFT;
  start_date: string | null;
  target_end_date: string | null;
  current_step_index: number;
  timeline: MarketingCampaign["timeline"];
  metrics: MarketingCampaign["metrics"];
  created_from_recommendation_id: string | null;
  marketing_director_decision_key: string;
  template_id: string;
  schema_version: number;
};

function addDaysIso(startDate: string, dayOffset: number): string {
  const date = new Date(`${startDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * Pure planner. Identical inputs always produce identical drafts.
 * Rejects self-initiation — Marketing Director gate is mandatory.
 */
export function planCampaignFromDirector(
  input: InitiateCampaignInput,
): PlannedCampaignDraft {
  if (input.initiatedBy !== "marketing_director") {
    throw new Error("Campaign Engine refuses self-initiation; Marketing Director must initiate.");
  }
  if (!input.marketingDirectorDecisionKey.trim()) {
    throw new Error("marketingDirectorDecisionKey is required for Director-initiated campaigns.");
  }

  const template = getCampaignTemplate(input.campaignType);
  if (!template) {
    throw new Error(`Unknown campaign type: ${input.campaignType}`);
  }

  const startDate = input.startDate ?? null;
  const timeline = orderTimeline(buildTimelineFromTemplate(template, startDate));
  const maxOffset = timeline.reduce((max, step) => Math.max(max, step.dayOffset), 0);
  const targetEndDate = startDate ? addDaysIso(startDate, maxOffset) : null;

  return {
    campaign_type: template.campaignType,
    objective: input.objective?.trim() || template.defaultObjective,
    status: CampaignStatuses.DRAFT,
    start_date: startDate,
    target_end_date: targetEndDate,
    current_step_index: currentStepIndex(timeline),
    timeline,
    metrics: emptyCampaignMetrics(),
    created_from_recommendation_id: input.createdFromRecommendationId ?? null,
    marketing_director_decision_key: input.marketingDirectorDecisionKey.trim(),
    template_id: template.id,
    schema_version: 1,
  };
}
