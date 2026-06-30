import "server-only";

import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import type { BusinessProfile } from "@/lib/business-profile";
import { getCurrentPlanPeriod } from "@/lib/marketing-planner/planner";
import {
  createMarketingPlanner,
  formatOpenAiMarketingPlannerError,
} from "@/lib/marketing-planner/openai-planner";
import {
  getLatestMarketingPlanForUser,
  getMarketingPlanForUserMonth,
  markMarketingPlanFailed,
  saveMarketingPlanResult,
  upsertMarketingPlanGenerating,
} from "@/lib/marketing-planner/persistence";
import type {
  MarketingPlan,
  MarketingPlanPageData,
  MarketingPlannerContext,
} from "@/lib/marketing-planner/types";
import { AuditActions, auditErrorMetadata, logAuditEvent } from "@/lib/audit-log-server";
import { buildMarketContextPromptSummary } from "@/lib/market-context/prompt-context";
import { getLatestMarketContextBriefForUser } from "@/lib/market-context/marketContextService";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { createClient } from "@/lib/supabase/server";

async function loadPlannerContext(userId: string): Promise<MarketingPlannerContext | null> {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) return null;

  const [aiMarketingProfile, websiteAnalysis, marketContextBrief] = await Promise.all([
    getAiMarketingProfileForUser(supabase, userId),
    getWebsiteAnalysisForUser(supabase, userId),
    getLatestMarketContextBriefForUser(userId),
  ]);

  const period = getCurrentPlanPeriod();

  return {
    businessProfile: profile as BusinessProfile,
    aiMarketingProfile,
    websiteAnalysis,
    marketContextSummary: buildMarketContextPromptSummary(marketContextBrief),
    month: period.month,
    year: period.year,
    monthName: period.monthName,
    season: period.season,
  };
}

export async function getMarketingPlanPageDataForCurrentUser(): Promise<MarketingPlanPageData> {
  const period = getCurrentPlanPeriod();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      plan: null,
      currentMonth: period.month,
      currentYear: period.year,
      monthName: period.monthName,
    };
  }

  const currentMonthPlan = await getMarketingPlanForUserMonth(
    supabase,
    user.id,
    period.month,
    period.year
  );

  const plan = currentMonthPlan ?? (await getLatestMarketingPlanForUser(supabase, user.id));

  return {
    plan,
    currentMonth: period.month,
    currentYear: period.year,
    monthName: period.monthName,
  };
}

export async function getLatestMarketingPlanForCurrentUser(): Promise<MarketingPlan | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const period = getCurrentPlanPeriod();
  const currentMonthPlan = await getMarketingPlanForUserMonth(
    supabase,
    user.id,
    period.month,
    period.year
  );

  return currentMonthPlan ?? (await getLatestMarketingPlanForUser(supabase, user.id));
}

export async function generateMarketingPlanForUser(userId: string): Promise<{
  plan: MarketingPlan | null;
  error?: string;
}> {
  const supabase = await createClient();

  const context = await loadPlannerContext(userId);
  if (!context) {
    return { plan: null, error: "Business profile not found. Complete onboarding first." };
  }

  await upsertMarketingPlanGenerating(supabase, {
    userId,
    businessProfileId: context.businessProfile.id,
    month: context.month,
    year: context.year,
  });

  try {
    const planner = createMarketingPlanner();
    const planJson = await planner.generate(context);

    const plan = await saveMarketingPlanResult(supabase, {
      userId,
      month: context.month,
      year: context.year,
      planJson,
    });

    if (!plan) {
      return { plan: null, error: "Unable to save marketing plan" };
    }

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: context.businessProfile.id,
      action: AuditActions.MARKETING_PLAN_GENERATED,
      entityType: "marketing_plan",
      entityId: plan.id,
      status: "success",
      metadata: {
        month: context.month,
        year: context.year,
        itemCount: plan.plan_json?.thirtyDayCalendar?.length ?? null,
      },
    });

    return { plan };
  } catch (error) {
    await markMarketingPlanFailed(supabase, userId, context.month, context.year);

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: context.businessProfile.id,
      action: AuditActions.MARKETING_PLAN_GENERATED,
      entityType: "marketing_plan",
      status: "failure",
      metadata: auditErrorMetadata(error, "Marketing plan generation failed"),
    });

    return { plan: null, error: formatOpenAiMarketingPlannerError(error) };
  }
}

export async function generateMarketingPlanForCurrentUser(): Promise<{
  plan: MarketingPlan | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { plan: null, error: "Unauthorized" };
  }

  return generateMarketingPlanForUser(user.id);
}
