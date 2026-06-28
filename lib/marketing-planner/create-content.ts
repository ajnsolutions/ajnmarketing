import "server-only";

import { submitContentForApproval } from "@/lib/content-approval/service";
import {
  generateContentFromMarketingPlanItem,
  loadContentGenerationContextForUser,
  resolveMarketingPlanContentType,
} from "@/lib/content-generator/service";
import type { MarketingPlanContentRequest, MarketingPlanItemType } from "@/lib/content-generator/types";
import { getCurrentPlanPeriod } from "@/lib/marketing-planner/planner";
import { getMarketingPlanForUserMonth } from "@/lib/marketing-planner/persistence";
import type {
  MarketingPlanCreateContentInput,
  MarketingPlanCreateContentResult,
} from "@/lib/marketing-planner/types";
import { createClient } from "@/lib/supabase/server";

function toPlanItemType(value: string): MarketingPlanItemType | null {
  switch (value) {
    case "calendar":
    case "campaign":
    case "blog":
    case "email":
    case "video":
    case "social":
      return value;
    default:
      return null;
  }
}

function buildScheduledDate(scheduledDate?: string): string | undefined {
  if (scheduledDate?.trim()) return scheduledDate;
  return undefined;
}

export async function createContentFromMarketingPlanItemForCurrentUser(
  input: MarketingPlanCreateContentInput
): Promise<{ result: MarketingPlanCreateContentResult | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { result: null, error: "Unauthorized" };
  }

  const planItemType = toPlanItemType(input.plan_item_type);
  if (!planItemType) {
    return { result: null, error: "Invalid plan item type" };
  }

  if (!input.plan_item_title?.trim() || !input.plan_item_description?.trim()) {
    return { result: null, error: "Plan item title and description are required" };
  }

  const context = await loadContentGenerationContextForUser(user.id);
  if (!context) {
    return { result: null, error: "Business profile not found. Complete onboarding first." };
  }

  const period = getCurrentPlanPeriod();
  const marketingPlan = await getMarketingPlanForUserMonth(
    supabase,
    user.id,
    period.month,
    period.year
  );

  const planJson =
    marketingPlan?.status === "active" ? marketingPlan.plan_json : null;

  const contentRequest: MarketingPlanContentRequest = {
    planItemType,
    planItemTitle: input.plan_item_title.trim(),
    planItemDescription: input.plan_item_description.trim(),
    recommendedChannel: input.recommended_channel?.trim(),
    scheduledDate: buildScheduledDate(input.scheduled_date),
    marketingPlanSummary: planJson?.executiveSummary,
    marketingThemes: planJson?.marketingThemes,
  };

  const { draft, error: generationError } = await generateContentFromMarketingPlanItem(
    context,
    contentRequest
  );

  if (generationError || !draft) {
    return { result: null, error: generationError ?? "Content generation failed" };
  }

  const contentType = resolveMarketingPlanContentType(contentRequest);

  const approval = await submitContentForApproval(user.id, context.businessProfile, {
    content_type: contentType,
    title: draft.title,
    content: draft.content,
    source: "marketing_plan",
    ai_score: draft.voiceScore,
    notes: `Created from marketing plan: ${input.plan_item_title}`,
  });

  if (!approval) {
    return { result: null, error: "Unable to save content to Approval Center" };
  }

  return {
    result: {
      content_approval_id: approval.id,
      title: approval.title,
      status: "pending",
    },
  };
}
