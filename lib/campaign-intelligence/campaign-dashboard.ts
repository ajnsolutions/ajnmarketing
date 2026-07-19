/**
 * Customer-safe dashboard projections for Campaign Intelligence.
 */

import { getCampaignTemplate } from "@/lib/campaign-intelligence/campaign-templates";
import {
  nextMilestone,
  orderTimeline,
  timelineCompletionPercent,
} from "@/lib/campaign-intelligence/campaign-timeline";
import {
  CampaignStepStatuses,
  type CampaignDashboardCard,
  type MarketingCampaign,
} from "@/lib/campaign-intelligence/campaign-types";

function recentProgressLines(campaign: MarketingCampaign): string[] {
  const completed = orderTimeline(campaign.timeline)
    .filter((step) => step.status === CampaignStepStatuses.COMPLETED)
    .slice(-3)
    .map((step) => `Completed: ${step.label}`);

  if (completed.length > 0) return completed;

  const next = nextMilestone(campaign.timeline);
  if (next) return [`Next up: ${next}`];
  return [`Status: ${campaign.status.replaceAll("_", " ")}`];
}

export function toCampaignDashboardCard(campaign: MarketingCampaign): CampaignDashboardCard {
  const template = getCampaignTemplate(campaign.campaign_type);
  const timeline = orderTimeline(campaign.timeline);
  return {
    id: campaign.id,
    campaignType: campaign.campaign_type,
    title: template?.title ?? campaign.campaign_type.replaceAll("_", " "),
    objective: campaign.objective,
    status: campaign.status,
    nextMilestone: nextMilestone(timeline),
    completionPercent: timelineCompletionPercent(timeline),
    timeline,
    recentProgress: recentProgressLines(campaign),
  };
}

export function toCampaignDashboardCards(
  campaigns: MarketingCampaign[],
): CampaignDashboardCard[] {
  return campaigns.map(toCampaignDashboardCard);
}
