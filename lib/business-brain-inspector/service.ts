import "server-only";

/**
 * Business Brain Inspector — single entrypoint for the customer-facing page.
 * Fetches the same Business Brain packages the dashboard already assembles,
 * reasons across them the same way, and composes the result into the
 * knowledge-card model. No second fetch of raw provider data, no new AI call.
 */

import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { runBusinessDiscoveryForCurrentUser } from "@/lib/business-discovery/service";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { getCustomerVoiceIntelligence } from "@/lib/customer-voice/service";
import { getExternalIntelligence } from "@/lib/external-intelligence/service";
import { getBusinessGoalsForCurrentUser } from "@/lib/goals/service";
import { getActiveSmartUploadKnowledgeForUser } from "@/lib/smart-uploads/service";
import { getActiveTestimonialKnowledgeForUser } from "@/lib/testimonials/persistence";
import { getBusinessReasoning, getBusinessKnowledgeHealth } from "@/lib/business-knowledge-graph/service";
import { reconcileAndGetBusinessLearningPatterns } from "@/lib/business-learning-engine/service";
import { reconcileAndGetOpportunities } from "@/lib/opportunity-engine/service";
import { buildBusinessBrainSnapshot } from "@/lib/business-brain-inspector/build";
import type { BusinessBrainSnapshot } from "@/lib/business-brain-inspector/types";

export async function getBusinessBrainSnapshotForCurrentUser(): Promise<BusinessBrainSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getBusinessProfileForUser().catch(() => null);
  if (!profile) return null;

  const [businessDiscovery, websiteAnalysis, goals] = await Promise.all([
    runBusinessDiscoveryForCurrentUser().catch(() => null),
    getWebsiteAnalysisForUser(supabase, user.id).catch(() => null),
    getBusinessGoalsForCurrentUser().catch(() => []),
  ]);

  const [customerVoice, externalIntelligence, smartUploadFacts, testimonialFacts] = await Promise.all([
    getCustomerVoiceIntelligence({
      userId: profile.user_id,
      businessProfileId: profile.id,
      knownServices: businessDiscovery?.primaryServices?.value ?? undefined,
    }).catch(() => null),
    getExternalIntelligence({
      userId: profile.user_id,
      businessProfileId: profile.id,
      knownGoalKeys: goals.map((g) => g.key),
    }).catch(() => null),
    getActiveSmartUploadKnowledgeForUser(supabase, profile.user_id, profile.id).catch(() => []),
    getActiveTestimonialKnowledgeForUser(supabase, profile.user_id, profile.id).catch(() => []),
  ]);

  const businessReasoning = getBusinessReasoning({
    businessDiscovery,
    goals,
    customerVoice,
    externalIntelligence,
    smartUploadFacts,
    testimonialFacts,
  });

  const reconciliation = await reconcileAndGetBusinessLearningPatterns(supabase, {
    userId: profile.user_id,
    businessProfileId: profile.id,
    businessReasoning,
  }).catch(() => null);

  const opportunityReconciliation = await reconcileAndGetOpportunities(supabase, {
    userId: profile.user_id,
    businessProfileId: profile.id,
    businessDiscovery,
    customerVoice,
    externalIntelligence,
    smartUploadFacts,
    businessReasoning,
    learningPatterns: reconciliation?.patterns ?? [],
  }).catch(() => null);

  const businessKnowledgeHealth = getBusinessKnowledgeHealth({
    businessDiscovery,
    goals,
    customerVoice,
    externalIntelligence,
    smartUploadFacts,
    testimonialFacts,
    activeOpportunityCount: opportunityReconciliation?.opportunities.length ?? 0,
    expiredOpportunityCount: opportunityReconciliation?.justExpired.length ?? 0,
  });

  return buildBusinessBrainSnapshot({
    businessDiscovery,
    businessProfile: { city: profile.city ?? null, state: profile.state ?? null },
    websiteAnalysis,
    customerVoice,
    externalIntelligence,
    goals,
    learningPatterns: reconciliation?.patterns ?? [],
    opportunities: opportunityReconciliation?.opportunities ?? [],
    businessKnowledgeHealth,
  });
}
