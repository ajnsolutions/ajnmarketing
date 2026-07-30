import { redirect } from "next/navigation";
import { FirstDaysHome } from "@/components/dashboard/first-days-home";
import { GrowthAdvisorPage } from "@/components/dashboard/growth-advisor/growth-advisor-page";
import { SetupHomReadinessPanel } from "@/components/dashboard/setup-hom-readiness";
import { getFirstDaysHomeForCurrentUser } from "@/lib/dashboard/first-days-home-server";
import { getCustomerSetupSnapshotForCurrentUser } from "@/lib/customer-setup/service";
import { getHeadOfMarketingBriefingForCurrentUser } from "@/lib/head-of-marketing/service";
import { runBusinessDiscoveryForCurrentUser } from "@/lib/business-discovery/service";
import { buildGrowthAdvisorBriefing } from "@/lib/growth-advisor/buildGrowthAdvisorBriefing";
import { getBusinessGoalsForCurrentUser } from "@/lib/goals/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getCustomerVoiceIntelligence } from "@/lib/customer-voice/service";
import { getExternalIntelligence } from "@/lib/external-intelligence/service";
import { getWeeklyGrowthPlanForCurrentUser } from "@/lib/growth-planner/service";
import { getGuidedSetupExperienceForCurrentUser } from "@/lib/guided-setup/service";
import { getActiveSmartUploadKnowledgeForUser } from "@/lib/smart-uploads/service";
import { listSmartUploadDocumentsForUser } from "@/lib/smart-uploads/persistence";
import { createClient } from "@/lib/supabase/server";
import { getBusinessReasoning, getBusinessKnowledgeHealth } from "@/lib/business-knowledge-graph/service";
import { reconcileAndGetBusinessLearningPatterns, findPatternForActionType } from "@/lib/business-learning-engine/service";
import { computeLearningMaturity, summarizeOutcomeBreakdown } from "@/lib/business-learning-engine/learningMaturity";

export default async function DashboardPage() {
  const [briefing, firstDays, setup, goals, guidedSetup] = await Promise.all([
    getHeadOfMarketingBriefingForCurrentUser(),
    getFirstDaysHomeForCurrentUser(),
    getCustomerSetupSnapshotForCurrentUser(),
    getBusinessGoalsForCurrentUser(),
    getGuidedSetupExperienceForCurrentUser().catch(() => null),
  ]);

  // Brand-new setups keep the First Five Minutes calm path until foundations exist.
  if (firstDays?.isEarlyCustomer && firstDays.primaryAction.kind === "connect_google") {
    return <FirstDaysHome model={firstDays} />;
  }

  if (briefing) {
    // Business Brain enrichment is presentation-only — never blocks the page,
    // never re-ranks Marketing Director's single recommendation.
    const [businessDiscovery, profile] = await Promise.all([
      runBusinessDiscoveryForCurrentUser().catch(() => null),
      getBusinessProfileForUser().catch(() => null),
    ]);

    const [customerVoice, externalIntelligence, smartUploadFacts, smartUploadDocuments] = profile
      ? await Promise.all([
          getCustomerVoiceIntelligence({
            userId: profile.user_id,
            businessProfileId: profile.id,
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
        ])
      : [null, null, [], []];

    // The Business Knowledge Graph reasons across the same already-fetched
    // Business Brain packages above — no second fetch, no new data store.
    const businessReasoning = getBusinessReasoning({
      businessDiscovery,
      goals,
      customerVoice,
      externalIntelligence,
      smartUploadFacts,
    });

    const businessKnowledgeHealth = getBusinessKnowledgeHealth({
      businessDiscovery,
      goals,
      customerVoice,
      externalIntelligence,
      smartUploadFacts,
    });

    // The Business Learning Engine reconciles/reinforces patterns from real
    // recommendation outcomes, Marketing Memory learnings, and this same
    // Business Knowledge Graph reasoning — on-demand, never a cron.
    const reconciliation = profile
      ? await createClient()
          .then((supabase) =>
            reconcileAndGetBusinessLearningPatterns(supabase, {
              userId: profile.user_id,
              businessProfileId: profile.id,
              businessReasoning,
            }),
          )
          .catch(() => null)
      : null;

    const topActionType = briefing.topRecommendationDetail?.actionType ?? null;
    const businessLearningPattern =
      reconciliation && topActionType
        ? findPatternForActionType(reconciliation.patterns, topActionType)
        : null;

    const learningMaturity = reconciliation
      ? computeLearningMaturity({
          patterns: reconciliation.patterns,
          ...summarizeOutcomeBreakdown(reconciliation.outcomeBreakdown),
          totalRecommendations: reconciliation.totalRecommendations,
          feedbackCount: reconciliation.feedbackEventCount,
        })
      : null;

    const advisor = buildGrowthAdvisorBriefing(briefing, businessDiscovery, {
      goals,
      customerVoice,
      externalIntelligence,
      guidedSetup,
      smartUploadFacts,
      smartUploadDocuments,
      businessReasoning,
      businessKnowledgeHealth,
      businessLearningPattern,
      learningMaturity,
    });

    const weeklyPlan = await getWeeklyGrowthPlanForCurrentUser({
      briefing,
      businessDiscovery,
      goals,
      customerVoice,
      externalIntelligence,
      smartUploadFacts,
      businessReasoning,
      businessLearningPattern,
    }).catch(() => null);

    return (
      <GrowthAdvisorPage
        advisor={advisor}
        briefing={briefing}
        weeklyPlan={weeklyPlan}
        guidedSetup={guidedSetup}
      />
    );
  }

  // Honest readiness gate — never invent strategy when setup is insufficient.
  if (setup && !setup.headOfMarketingReady && guidedSetup) {
    return <SetupHomReadinessPanel experience={guidedSetup} />;
  }

  if (firstDays) {
    return <FirstDaysHome model={firstDays} />;
  }

  redirect("/dashboard/command-center");
}
