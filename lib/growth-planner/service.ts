import "server-only";

/**
 * Persist / load weekly growth plan history for the signed-in user.
 * Recommendations only — never executes marketing actions.
 */

import { createClient } from "@/lib/supabase/server";
import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { BusinessGoal } from "@/lib/goals/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import type { SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import { buildWeeklyGrowthPlan } from "@/lib/growth-planner/buildWeeklyGrowthPlan";
import {
  applyWeeklyGrowthPlansToMarketingGoals,
  compareWeeklyPlans,
  decodeWeeklyGrowthPlansFromMarketingGoals,
  latestPlanAndPrevious,
  upsertWeeklyPlanHistory,
} from "@/lib/growth-planner/history";
import type { WeeklyGrowthPlanBundle } from "@/lib/growth-planner/types";

export type { WeeklyGrowthPlanBundle };

/**
 * Build this week's plan and upsert history for the current user.
 * Falls back to in-memory-only when the profile cannot be updated.
 */
export async function getWeeklyGrowthPlanForCurrentUser(input: {
  briefing: HeadOfMarketingBriefing;
  businessDiscovery?: BusinessDiscoveryResult | null;
  goals?: BusinessGoal[];
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  smartUploadFacts?: SmartUploadKnowledgeFactRecord[];
  businessReasoning?: BusinessReasoningResult | null;
  businessLearningPattern?: BusinessPattern | null;
  now?: Date;
}): Promise<WeeklyGrowthPlanBundle | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id, marketing_goals")
    .eq("user_id", user.id)
    .maybeSingle();

  const marketingGoals =
    (profile as { marketing_goals: string[] | null } | null)?.marketing_goals ?? [];
  const history = decodeWeeklyGrowthPlansFromMarketingGoals(marketingGoals);

  const now = input.now ?? new Date();
  const draft = buildWeeklyGrowthPlan({
    briefing: input.briefing,
    businessDiscovery: input.businessDiscovery,
    goals: input.goals,
    customerVoice: input.customerVoice,
    externalIntelligence: input.externalIntelligence,
    smartUploadFacts: input.smartUploadFacts,
    businessReasoning: input.businessReasoning,
    businessLearningPattern: input.businessLearningPattern,
    now,
  });

  // Reuse same-week id/status/outcome when regenerating within the week.
  const sameWeek = history.find((entry) => entry.weekKey === draft.weekKey);
  const plan = sameWeek
    ? buildWeeklyGrowthPlan({
        briefing: input.briefing,
        businessDiscovery: input.businessDiscovery,
        goals: input.goals,
        customerVoice: input.customerVoice,
        externalIntelligence: input.externalIntelligence,
        smartUploadFacts: input.smartUploadFacts,
        businessReasoning: input.businessReasoning,
        now,
        planId: sameWeek.id,
        status: sameWeek.status,
        outcome: sameWeek.outcome,
      })
    : draft;

  const nextHistory = upsertWeeklyPlanHistory(history, plan);
  const { current, previous } = latestPlanAndPrevious(nextHistory);
  const comparison = current
    ? compareWeeklyPlans(current, previous)
    : compareWeeklyPlans(
        {
          id: plan.id,
          weekKey: plan.weekKey,
          generatedAt: plan.generatedAt,
          objectiveKey: plan.primaryObjective.key,
          objectiveLabel: plan.primaryObjective.label,
          status: plan.status,
          outcome: plan.outcome,
          plan,
        },
        null,
      );

  let persisted = false;
  if (profile) {
    const nextGoals = applyWeeklyGrowthPlansToMarketingGoals(marketingGoals, nextHistory);
    const { error } = await supabase
      .from("business_profiles")
      .update({ marketing_goals: nextGoals })
      .eq("user_id", user.id);
    persisted = !error;
  }

  return {
    plan,
    history: nextHistory,
    comparison,
    persisted,
  };
}
