import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getExternalIntelligence } from "@/lib/external-intelligence/service";
import { getCustomerVoiceIntelligence } from "@/lib/customer-voice/service";
import { reconcileAndGetBusinessLearningPatterns } from "@/lib/business-learning-engine/service";
import { getOutcomeEventsForBusiness, getRecommendationsForBusiness } from "@/lib/recommendation-outcomes/persistence";
import { listMarketingCampaignsForBusiness } from "@/lib/campaign-intelligence/campaign-persistence";
import { listSmartUploadDocumentsForUser } from "@/lib/smart-uploads/persistence";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
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
  },
): Promise<BusinessTimelineEntry[]> {
  const [outcomeEvents, recommendations, campaigns, smartUploadDocuments] = await Promise.all([
    getOutcomeEventsForBusiness(supabase, input.userId, input.businessProfileId),
    getRecommendationsForBusiness(supabase, input.userId, input.businessProfileId),
    listMarketingCampaignsForBusiness(supabase, input.userId, input.businessProfileId),
    listSmartUploadDocumentsForUser(supabase, input.userId),
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

  const [externalIntelligence, customerVoice] = await Promise.all([
    getExternalIntelligence({ userId: user.id, businessProfileId: profile.id }).catch(() => null),
    getCustomerVoiceIntelligence({ userId: user.id, businessProfileId: profile.id }).catch(() => null),
  ]);

  const reconciliation = await reconcileAndGetBusinessLearningPatterns(supabase, {
    userId: user.id,
    businessProfileId: profile.id,
  }).catch(() => null);

  return getBusinessTimeline(supabase, {
    userId: user.id,
    businessProfileId: profile.id,
    externalIntelligence,
    customerVoice,
    learningPatterns: reconciliation?.patterns ?? [],
  });
}
