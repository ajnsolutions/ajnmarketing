import "server-only";

/**
 * Head of Marketing Orchestrator — server entrypoints. Mirrors the exact
 * fetch/compose chain app/dashboard/page.tsx already uses (Business
 * Discovery, Goals, Customer Voice, External Intelligence, Smart Uploads,
 * Business Knowledge Graph, Business Learning Engine, Opportunity
 * Detection Engine, the Weekly Growth Plan, the Executive Brief) — no
 * provider is re-run, and no field here is computed a second way.
 */

import { createClient } from "@/lib/supabase/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getHeadOfMarketingBriefingForCurrentUser } from "@/lib/head-of-marketing/service";
import { runBusinessDiscoveryForCurrentUser } from "@/lib/business-discovery/service";
import { getBusinessGoalsForCurrentUser } from "@/lib/goals/service";
import { getCustomerVoiceIntelligence } from "@/lib/customer-voice/service";
import { getExternalIntelligence } from "@/lib/external-intelligence/service";
import { getActiveSmartUploadKnowledgeForUser } from "@/lib/smart-uploads/service";
import { listSmartUploadDocumentsForUser } from "@/lib/smart-uploads/persistence";
import { getActiveTestimonialKnowledgeForUser } from "@/lib/testimonials/persistence";
import { getBusinessReasoning } from "@/lib/business-knowledge-graph/service";
import {
  reconcileAndGetBusinessLearningPatterns,
  findPatternForActionType,
} from "@/lib/business-learning-engine/service";
import { reconcileAndGetOpportunities } from "@/lib/opportunity-engine/service";
import { getActiveOpportunitiesForUser } from "@/lib/opportunity-engine/persistence";
import { getWeeklyGrowthPlanForCurrentUser } from "@/lib/growth-planner/service";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { getTenantOperationalHealthPage } from "@/lib/ops-dashboard/tenantHealth";
import { buildExecutiveReview, presentExecutiveReview } from "@/lib/head-of-marketing-orchestrator/build";
import { buildAdminExecutiveOverview, type AdminExecutiveOverview } from "@/lib/head-of-marketing-orchestrator/adminOverview";
import { ExecutiveReviewCadences, type ExecutiveReview, type ExecutiveReviewCadence } from "@/lib/head-of-marketing-orchestrator/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";

type ExecutiveReviewCore = {
  review: ExecutiveReview;
  executiveBriefs: HeadOfMarketingBriefing["executiveBriefs"];
};

/**
 * One fetch/compose pass, reused by every cadence (Part 7) and by
 * `getExecutiveReviewForCurrentUser` below — Today / This Week / This Month
 * are just `presentExecutiveReview` applied to this same core with a
 * different cadence, never a second fetch.
 */
async function buildExecutiveReviewCoreForCurrentUser(): Promise<ExecutiveReviewCore | null> {
  const briefing = await getHeadOfMarketingBriefingForCurrentUser();
  if (!briefing) return null;

  const profile = await getBusinessProfileForUser().catch(() => null);
  if (!profile) return null;

  const businessDiscovery = await runBusinessDiscoveryForCurrentUser().catch(() => null);
  const goals = await getBusinessGoalsForCurrentUser().catch(() => []);

  const [customerVoice, externalIntelligence, smartUploadFacts, smartUploadDocuments, testimonialFacts] =
    await Promise.all([
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
      createClient()
        .then((supabase) => getActiveSmartUploadKnowledgeForUser(supabase, profile.user_id, profile.id))
        .catch(() => []),
      createClient()
        .then((supabase) => listSmartUploadDocumentsForUser(supabase, profile.user_id))
        .catch(() => []),
      createClient()
        .then((supabase) => getActiveTestimonialKnowledgeForUser(supabase, profile.user_id, profile.id))
        .catch(() => []),
    ]);

  const businessReasoning = getBusinessReasoning({
    businessDiscovery,
    goals,
    customerVoice,
    externalIntelligence,
    smartUploadFacts,
    testimonialFacts,
  });

  const reconciliation = await createClient()
    .then((supabase) =>
      reconcileAndGetBusinessLearningPatterns(supabase, {
        userId: profile.user_id,
        businessProfileId: profile.id,
        businessReasoning,
      }),
    )
    .catch(() => null);

  const opportunityReconciliation = await createClient()
    .then((supabase) =>
      reconcileAndGetOpportunities(supabase, {
        userId: profile.user_id,
        businessProfileId: profile.id,
        businessDiscovery,
        customerVoice,
        externalIntelligence,
        smartUploadFacts,
        smartUploadDocuments,
        businessReasoning,
        learningPatterns: reconciliation?.patterns ?? [],
      }),
    )
    .catch(() => null);

  const activeOpportunities = opportunityReconciliation?.opportunities ?? [];
  const topOpportunity = activeOpportunities[0] ?? null;

  const topActionType = briefing.topRecommendationDetail?.actionType ?? null;
  const businessLearningPattern =
    reconciliation && topActionType ? findPatternForActionType(reconciliation.patterns, topActionType) : null;

  const weeklyPlanBundle = await getWeeklyGrowthPlanForCurrentUser({
    briefing,
    businessDiscovery,
    goals,
    customerVoice,
    externalIntelligence,
    smartUploadFacts,
    businessReasoning,
    businessLearningPattern,
    topOpportunity,
  }).catch(() => null);
  if (!weeklyPlanBundle) return null;

  const review = buildExecutiveReview({
    businessName: profile.business_name?.trim() || "your business",
    plan: weeklyPlanBundle.plan,
    executiveBrief: briefing.executiveBrief,
    topOpportunity,
    activeOpportunities,
  });

  return { review, executiveBriefs: briefing.executiveBriefs };
}

export async function getExecutiveReviewForCurrentUser(
  cadence: ExecutiveReviewCadence = ExecutiveReviewCadences.TODAY,
): Promise<ExecutiveReview | null> {
  const core = await buildExecutiveReviewCoreForCurrentUser();
  if (!core) return null;
  return presentExecutiveReview(core.review, cadence, core.executiveBriefs);
}

/** All three cadences from the SAME underlying fetch/compose pass — lets
 * the page render tab-switching between Today / This Week / This Month
 * without a second round trip. */
export async function getExecutiveReviewAllCadencesForCurrentUser(): Promise<Record<
  ExecutiveReviewCadence,
  ExecutiveReview
> | null> {
  const core = await buildExecutiveReviewCoreForCurrentUser();
  if (!core) return null;

  return {
    today: presentExecutiveReview(core.review, ExecutiveReviewCadences.TODAY, core.executiveBriefs),
    this_week: presentExecutiveReview(core.review, ExecutiveReviewCadences.THIS_WEEK, core.executiveBriefs),
    this_month: presentExecutiveReview(core.review, ExecutiveReviewCadences.THIS_MONTH, core.executiveBriefs),
  };
}

export async function getAdminExecutiveOverviewForCurrentAdmin(): Promise<AdminExecutiveOverview | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminUserId(user.id) || !isSupabaseServiceRoleConfigured()) return null;

  const serviceClient = createServiceRoleClient();
  const tenantPage = await getTenantOperationalHealthPage(serviceClient, { pageSize: 50 });

  const opportunitiesByBusinessProfileId = new Map(
    await Promise.all(
      tenantPage.tenants.map(
        async (tenant) =>
          [
            tenant.businessProfileId,
            await getActiveOpportunitiesForUser(serviceClient, tenant.userId, tenant.businessProfileId).catch(
              () => [],
            ),
          ] as const,
      ),
    ),
  );

  return buildAdminExecutiveOverview({
    tenants: tenantPage.tenants,
    opportunitiesByBusinessProfileId,
  });
}
