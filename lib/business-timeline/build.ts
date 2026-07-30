/**
 * Pure composition — no I/O. Takes already-fetched Business Brain packages
 * (the same ones Growth Advisor and the Weekly Growth Plan already fetch)
 * and produces a chronological, customer-safe timeline. Every entry's
 * `occurredAt` is the real timestamp of the underlying signal (an outcome
 * event, an upload, a search insight's own evidence, a pattern's first
 * observation) — never "now," even when the surrounding computation is
 * refreshed on every page load.
 */

import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import type { RecommendedActionType } from "@/lib/marketing-decisions/types";
import type { RecommendationOutcomeEvent } from "@/lib/recommendation-outcomes/types";
import type { MarketingCampaign } from "@/lib/campaign-intelligence/campaign-types";
import type { SmartUploadDocumentRecord } from "@/lib/smart-uploads/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import { OPPORTUNITY_TYPE_LABELS } from "@/lib/opportunity-engine/types";
import { BusinessTimelineEntryTypes, type BusinessTimelineEntry } from "@/lib/business-timeline/types";

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  back_to_school: "Back to School",
  holiday_promotion: "Holiday Promotion",
  customer_appreciation: "Customer Appreciation",
  community_event: "Community Event",
  hiring: "Hiring",
  seasonal_promotion: "Seasonal Promotion",
};

const RECOMMENDATION_EVENT_ENTRIES: Partial<
  Record<RecommendationOutcomeEvent["event_type"], { changeTemplate: (label: string) => string; learnTemplate: ((label: string) => string) | null }>
> = {
  draft_approved: {
    changeTemplate: (label) => `You approved a recommendation to ${label.toLowerCase()}.`,
    learnTemplate: null,
  },
  publishing_succeeded: {
    changeTemplate: (label) => `Your ${label.toLowerCase()} content went live.`,
    learnTemplate: null,
  },
  performance_measured: {
    changeTemplate: (label) => `We measured the results of your ${label.toLowerCase()} content.`,
    learnTemplate: (label) => `This adds to what we know about how ${label.toLowerCase()} performs for your business.`,
  },
};

function recommendationEntries(
  events: Array<{ event: RecommendationOutcomeEvent; actionType: string }>,
): BusinessTimelineEntry[] {
  const entries: BusinessTimelineEntry[] = [];
  for (const { event, actionType } of events) {
    const config = RECOMMENDATION_EVENT_ENTRIES[event.event_type];
    if (!config) continue;
    const label = formatRecommendedActionType(actionType as RecommendedActionType);
    entries.push({
      id: `recommendation_${event.id}`,
      type: BusinessTimelineEntryTypes.RECOMMENDATION,
      occurredAt: event.created_at,
      whatChanged: config.changeTemplate(label),
      whatDidAILearn: config.learnTemplate ? config.learnTemplate(label) : null,
    });
  }
  return entries;
}

function campaignEntries(campaigns: MarketingCampaign[]): BusinessTimelineEntry[] {
  return campaigns
    .filter((c) => c.status === "completed" || c.status === "measured")
    .map((c) => ({
      id: `campaign_${c.id}`,
      type: BusinessTimelineEntryTypes.CAMPAIGN,
      occurredAt: c.updated_at,
      whatChanged: `You completed a ${CAMPAIGN_TYPE_LABELS[c.campaign_type] ?? c.campaign_type} campaign.`,
      whatDidAILearn: null,
    }));
}

function uploadEntries(documents: SmartUploadDocumentRecord[]): BusinessTimelineEntry[] {
  return documents
    .filter((doc) => doc.status === "extracted" && doc.processed_at)
    .map((doc) => ({
      id: `upload_${doc.id}`,
      type: BusinessTimelineEntryTypes.UPLOAD,
      occurredAt: doc.processed_at!,
      whatChanged: `You uploaded "${doc.file_name}."`,
      whatDidAILearn:
        doc.fact_count > 0
          ? `We learned ${doc.fact_count} new thing${doc.fact_count === 1 ? "" : "s"} about your business from it.`
          : "We didn't find anything new to learn from it.",
    }));
}

function searchMilestoneEntries(
  externalIntelligence: ExternalIntelligence | null | undefined,
): BusinessTimelineEntry[] {
  if (!externalIntelligence || externalIntelligence.emptyState === "no_evidence") return [];
  return externalIntelligence.searchDemandTrends.slice(0, 5).map((trend) => ({
    id: `search_${trend.id}`,
    type: BusinessTimelineEntryTypes.SEARCH_MILESTONE,
    occurredAt: trend.lastUpdated,
    whatChanged: trend.insight,
    whatDidAILearn: "This is now part of what we know about search demand for your business.",
  }));
}

function customerVoiceMilestoneEntries(
  customerVoice: CustomerVoiceIntelligence | null | undefined,
): BusinessTimelineEntry[] {
  if (!customerVoice || customerVoice.emptyState === "no_evidence") return [];
  return customerVoice.strengths.slice(0, 5).map((theme) => ({
    id: `customer_voice_${theme.key}`,
    type: BusinessTimelineEntryTypes.CUSTOMER_VOICE_MILESTONE,
    occurredAt: theme.lastUpdated,
    whatChanged: `Customers frequently mention "${theme.label}."`,
    whatDidAILearn: "This strengthens what we know your customers value.",
  }));
}

function learningMilestoneEntries(patterns: BusinessPattern[]): BusinessTimelineEntry[] {
  return patterns.map((pattern) => ({
    id: `learning_${pattern.id}`,
    type: BusinessTimelineEntryTypes.LEARNING_MILESTONE,
    occurredAt: pattern.firstObserved,
    whatChanged: "The Business Learning Engine identified a new pattern.",
    whatDidAILearn: pattern.statement,
  }));
}

/**
 * Opportunity Detection Engine milestones (Part 7) — detected, completed,
 * expired, and (for a completed opportunity whose completion was itself
 * defined by real Learning Engine reinforcement — see reconcile.ts's
 * hasCompletedViaLearning) learned-from. Every entry's timestamp is the
 * opportunity's own real lifecycle timestamp, never "now."
 */
function opportunityEntries(opportunities: DetectedOpportunity[]): BusinessTimelineEntry[] {
  const entries: BusinessTimelineEntry[] = [];

  for (const opportunity of opportunities) {
    const label = OPPORTUNITY_TYPE_LABELS[opportunity.type];

    entries.push({
      id: `opportunity_detected_${opportunity.id}`,
      type: BusinessTimelineEntryTypes.OPPORTUNITY_DETECTED,
      occurredAt: opportunity.firstDetectedAt,
      whatChanged: `We detected a ${label.toLowerCase()}: ${opportunity.statement}`,
      whatDidAILearn: null,
    });

    if (opportunity.status === "completed" && opportunity.retiredAt) {
      entries.push({
        id: `opportunity_completed_${opportunity.id}`,
        type: BusinessTimelineEntryTypes.OPPORTUNITY_COMPLETED,
        occurredAt: opportunity.retiredAt,
        whatChanged: `A ${label.toLowerCase()} was completed: ${opportunity.statement}`,
        whatDidAILearn: null,
      });

      if (opportunity.relatedActionType) {
        entries.push({
          id: `opportunity_learned_${opportunity.id}`,
          type: BusinessTimelineEntryTypes.OPPORTUNITY_LEARNED_FROM,
          occurredAt: opportunity.retiredAt,
          whatChanged: `We learned from acting on this ${label.toLowerCase()}.`,
          whatDidAILearn: "The Business Learning Engine observed real, reinforced success for this kind of action.",
        });
      }
    }

    if (opportunity.status === "expired" && opportunity.retiredAt) {
      entries.push({
        id: `opportunity_expired_${opportunity.id}`,
        type: BusinessTimelineEntryTypes.OPPORTUNITY_EXPIRED,
        occurredAt: opportunity.retiredAt,
        whatChanged: `A ${label.toLowerCase()} is no longer active: ${opportunity.statement}`,
        whatDidAILearn: null,
      });
    }
  }

  return entries;
}

const MAX_ENTRIES = 25;

export function buildBusinessTimeline(input: {
  recommendationOutcomeEvents: Array<{ event: RecommendationOutcomeEvent; actionType: string }>;
  campaigns: MarketingCampaign[];
  smartUploadDocuments: SmartUploadDocumentRecord[];
  externalIntelligence?: ExternalIntelligence | null;
  customerVoice?: CustomerVoiceIntelligence | null;
  learningPatterns: BusinessPattern[];
  opportunities?: DetectedOpportunity[];
}): BusinessTimelineEntry[] {
  const entries = [
    ...recommendationEntries(input.recommendationOutcomeEvents),
    ...campaignEntries(input.campaigns),
    ...uploadEntries(input.smartUploadDocuments),
    ...searchMilestoneEntries(input.externalIntelligence),
    ...customerVoiceMilestoneEntries(input.customerVoice),
    ...learningMilestoneEntries(input.learningPatterns),
    ...opportunityEntries(input.opportunities ?? []),
  ];

  return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, MAX_ENTRIES);
}
