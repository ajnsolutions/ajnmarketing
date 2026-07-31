import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getExternalIntelligence } from "@/lib/external-intelligence/service";
import { getCustomerVoiceIntelligence } from "@/lib/customer-voice/service";
import { reconcileAndGetBusinessLearningPatterns } from "@/lib/business-learning-engine/service";
import { computeLearningMaturity, summarizeOutcomeBreakdown } from "@/lib/business-learning-engine/learningMaturity";
import type { LearningMaturity } from "@/lib/business-learning-engine/learningMaturity";
import { getBusinessReasoning } from "@/lib/business-knowledge-graph/service";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import { runBusinessDiscoveryForCurrentUser } from "@/lib/business-discovery/service";
import { getBusinessGoalsForCurrentUser } from "@/lib/goals/service";
import { getActiveSmartUploadKnowledgeForUser } from "@/lib/smart-uploads/service";
import { getActiveTestimonialKnowledgeForUser } from "@/lib/testimonials/persistence";
import { getOutcomeEventsForBusiness, getRecommendationsForBusiness } from "@/lib/recommendation-outcomes/persistence";
import { listMarketingCampaignsForBusiness } from "@/lib/campaign-intelligence/campaign-persistence";
import { listSmartUploadDocumentsForUser } from "@/lib/smart-uploads/persistence";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import { getActiveOpportunitiesForUser, getRetiredOpportunitiesForUser } from "@/lib/opportunity-engine/persistence";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import { buildBusinessTimeline } from "@/lib/business-timeline/build";
import type { BusinessTimelineEntry } from "@/lib/business-timeline/types";

/**
 * Gathers the already-existing sources a Business Timeline needs and
 * composes it — no second decision engine, no new persisted event log.
 * Callers that already have some of these packages (e.g. the dashboard page
 * already fetched externalIntelligence/customerVoice this request) should
 * pass them through rather than triggering a second fetch.
 */
export async function getBusinessTimeline(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    externalIntelligence?: ExternalIntelligence | null;
    customerVoice?: CustomerVoiceIntelligence | null;
    learningPatterns: BusinessPattern[];
    /** Callers that already reconciled opportunities this request (e.g. the
     * dashboard page) should pass both lists through rather than re-querying. */
    activeOpportunities?: DetectedOpportunity[];
    retiredOpportunities?: DetectedOpportunity[];
    businessReasoning?: BusinessReasoningResult | null;
    learningMaturity?: LearningMaturity | null;
  },
): Promise<BusinessTimelineEntry[]> {
  const [outcomeEvents, recommendations, campaigns, smartUploadDocuments, activeOpportunities, retiredOpportunities] =
    await Promise.all([
      getOutcomeEventsForBusiness(supabase, input.userId, input.businessProfileId),
      getRecommendationsForBusiness(supabase, input.userId, input.businessProfileId),
      listMarketingCampaignsForBusiness(supabase, input.userId, input.businessProfileId),
      listSmartUploadDocumentsForUser(supabase, input.userId),
      input.activeOpportunities ?? getActiveOpportunitiesForUser(supabase, input.userId, input.businessProfileId),
      input.retiredOpportunities ?? getRetiredOpportunitiesForUser(supabase, input.userId, input.businessProfileId),
    ]);

  const actionTypeById = new Map(
    recommendations.map((rec) => [String(rec.id), String(rec.recommended_action_type)]),
  );

  const recommendationOutcomeEvents = outcomeEvents
    .map((event) => ({ event, actionType: actionTypeById.get(event.recommendation_id) }))
    .filter((item): item is { event: (typeof outcomeEvents)[number]; actionType: string } =>
      Boolean(item.actionType),
    );

  return buildBusinessTimeline({
    recommendationOutcomeEvents,
    campaigns,
    smartUploadDocuments,
    externalIntelligence: input.externalIntelligence,
    customerVoice: input.customerVoice,
    learningPatterns: input.learningPatterns,
    opportunities: [...activeOpportunities, ...retiredOpportunities],
    businessReasoning: input.businessReasoning,
    learningMaturity: input.learningMaturity,
  });
}

/**
 * Convenience entrypoint for the Business Timeline page — fetches every
 * source itself (own route, own fetch — unlike the dashboard page, which
 * already has these packages in hand and should call getBusinessTimeline
 * directly to avoid a second fetch).
 */
export async function getBusinessTimelineForCurrentUser(): Promise<
  ReturnType<typeof buildBusinessTimeline> | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getBusinessProfileForUser();
  if (!profile) return null;

  const [businessDiscovery, goals] = await Promise.all([
    runBusinessDiscoveryForCurrentUser().catch(() => null),
    getBusinessGoalsForCurrentUser().catch(() => []),
  ]);

  const [externalIntelligence, customerVoice, smartUploadFacts, testimonialFacts] = await Promise.all([
    getExternalIntelligence({
      userId: user.id,
      businessProfileId: profile.id,
      knownGoalKeys: goals.map((g) => g.key),
    }).catch(() => null),
    getCustomerVoiceIntelligence({
      userId: user.id,
      businessProfileId: profile.id,
      knownServices: businessDiscovery?.primaryServices?.value ?? undefined,
    }).catch(() => null),
    getActiveSmartUploadKnowledgeForUser(supabase, user.id, profile.id).catch(() => []),
    getActiveTestimonialKnowledgeForUser(supabase, user.id, profile.id).catch(() => []),
  ]);

  // The Business Knowledge Graph reasons across the same already-fetched
  // Business Brain packages above — no second fetch, no new data store.
  const businessReasoning = getBusinessReasoning({
    businessDiscovery,
    goals,
    customerVoice,
    externalIntelligence,
    smartUploadFacts,
    testimonialFacts,
  });

  const reconciliation = await reconcileAndGetBusinessLearningPatterns(supabase, {
    userId: user.id,
    businessProfileId: profile.id,
    businessReasoning,
  }).catch(() => null);

  const learningMaturity = reconciliation
    ? computeLearningMaturity({
        patterns: reconciliation.patterns,
        ...summarizeOutcomeBreakdown(reconciliation.outcomeBreakdown),
        totalRecommendations: reconciliation.totalRecommendations,
        feedbackCount: reconciliation.feedbackEventCount,
      })
    : null;

  return getBusinessTimeline(supabase, {
    userId: user.id,
    businessProfileId: profile.id,
    externalIntelligence,
    customerVoice,
    learningPatterns: reconciliation?.patterns ?? [],
    businessReasoning,
    learningMaturity,
  });
}
