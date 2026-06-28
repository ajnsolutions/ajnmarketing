import "server-only";

import { getContentApprovalsForUser } from "@/lib/content-approval/persistence";
import { loadContentGenerationContextForUser } from "@/lib/content-generator/service";
import { getCurrentPlanPeriod } from "@/lib/marketing-planner/planner";
import { getMarketingPlanForUserMonth } from "@/lib/marketing-planner/persistence";
import { generateMarketingAgentTasks } from "@/lib/marketing-agent/planner";
import {
  buildTaskStats,
  dismissPendingTasksForDate,
  getMarketingTaskById,
  getMarketingTasksForUserOnDate,
  getTodayDateString,
  insertMarketingTasks,
  sortTasks,
  toTaskWithMeta,
  updateMarketingTaskStatus,
} from "@/lib/marketing-agent/persistence";
import type {
  MarketingAgentContext,
  MarketingAgentTaskPatchInput,
  MarketingAgentTasksPageData,
} from "@/lib/marketing-agent/types";
import { getPublishingQueueForUser } from "@/lib/publishing-queue/persistence";
import { createClient } from "@/lib/supabase/server";

async function buildMarketingAgentContext(userId: string): Promise<{
  context: MarketingAgentContext | null;
  marketingPlanId: string | null;
  businessProfileId: string | null;
}> {
  const supabase = await createClient();
  const generationContext = await loadContentGenerationContextForUser(userId);

  if (!generationContext) {
    return { context: null, marketingPlanId: null, businessProfileId: null };
  }

  const period = getCurrentPlanPeriod();
  const today = getTodayDateString();

  const [marketingPlan, approvals, publishingQueue] = await Promise.all([
    getMarketingPlanForUserMonth(supabase, userId, period.month, period.year),
    getContentApprovalsForUser(supabase, userId),
    getPublishingQueueForUser(supabase, userId),
  ]);

  const pendingApprovals = approvals
    .filter((item) => item.status === "pending")
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      title: item.title,
      content_type: item.content_type,
      source: item.source,
      created_at: item.created_at,
    }));

  const publishingSummary = publishingQueue
    .filter((item) => item.status === "ready" || item.status === "scheduled")
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      title: item.title,
      platform: item.platform,
      status: item.status,
      scheduled_for: item.scheduled_for,
    }));

  const planJson =
    marketingPlan?.status === "active" ? marketingPlan.plan_json : null;

  const todayCalendarItem = planJson?.thirtyDayCalendar?.find(
    (day) => day.day === new Date().getDate()
  );

  return {
    context: {
      currentDate: today,
      currentDateLabel: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      businessProfile: {
        business_name: generationContext.businessProfile.business_name,
        industry: generationContext.businessProfile.industry,
        marketing_goals: generationContext.businessProfile.marketing_goals,
        primary_services: generationContext.businessProfile.primary_services,
        city: generationContext.businessProfile.city,
        state: generationContext.businessProfile.state,
      },
      websiteAnalysis: generationContext.websiteAnalysis
        ? {
            analysis_status: generationContext.websiteAnalysis.analysis_status,
            brand_voice: generationContext.websiteAnalysis.brand_voice,
            tone: generationContext.websiteAnalysis.tone,
            keywords: generationContext.websiteAnalysis.keywords,
            raw_summary: generationContext.websiteAnalysis.raw_summary,
          }
        : null,
      aiMarketingProfile: generationContext.aiMarketingProfile
        ? {
            profile_status: generationContext.aiMarketingProfile.profile_status,
            business_summary: generationContext.aiMarketingProfile.business_summary,
            marketing_strategy: generationContext.aiMarketingProfile.marketing_strategy,
            content_strategy: generationContext.aiMarketingProfile.content_strategy,
            services: generationContext.aiMarketingProfile.services,
          }
        : null,
      marketingPlan: planJson
        ? {
            month: period.monthName,
            year: period.year,
            executiveSummary: planJson.executiveSummary,
            marketingThemes: planJson.marketingThemes,
            weeklyFocus: planJson.weeklyFocus,
            todayCalendarItem,
          }
        : null,
      pendingApprovals,
      publishingQueue: publishingSummary,
    },
    marketingPlanId: marketingPlan?.id ?? null,
    businessProfileId: generationContext.businessProfile.id,
  };
}

function buildPageData(tasks: Awaited<ReturnType<typeof getMarketingTasksForUserOnDate>>): MarketingAgentTasksPageData {
  const enriched = sortTasks(tasks.map(toTaskWithMeta));

  return {
    tasks: enriched,
    stats: buildTaskStats(enriched),
  };
}

export async function getMarketingAgentTasksForCurrentUser(): Promise<MarketingAgentTasksPageData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      tasks: [],
      stats: { dueToday: 0, completedToday: 0, highPriorityPending: 0, topPriority: null },
    };
  }

  const today = getTodayDateString();
  const tasks = await getMarketingTasksForUserOnDate(supabase, user.id, today);

  return buildPageData(tasks);
}

export async function regenerateMarketingAgentTasksForCurrentUser(): Promise<{
  data: MarketingAgentTasksPageData;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      data: {
        tasks: [],
        stats: { dueToday: 0, completedToday: 0, highPriorityPending: 0, topPriority: null },
      },
      error: "Unauthorized",
    };
  }

  const today = getTodayDateString();
  const generationContext = await loadContentGenerationContextForUser(user.id);

  if (!generationContext) {
    return {
      data: await getMarketingAgentTasksForCurrentUser(),
      error: "Business profile not found. Complete onboarding first.",
    };
  }

  const { context, marketingPlanId, businessProfileId } = await buildMarketingAgentContext(user.id);

  if (!context || !businessProfileId) {
    return {
      data: await getMarketingAgentTasksForCurrentUser(),
      error: "Unable to load marketing agent context.",
    };
  }

  try {
    const generatedTasks = await generateMarketingAgentTasks(context, generationContext);

    await dismissPendingTasksForDate(supabase, user.id, today);

    await insertMarketingTasks(supabase, {
      userId: user.id,
      businessProfileId,
      marketingPlanId,
      dueDate: today,
      tasks: generatedTasks,
    });

    const tasks = await getMarketingTasksForUserOnDate(supabase, user.id, today);
    return { data: buildPageData(tasks) };
  } catch (error) {
    return {
      data: await getMarketingAgentTasksForCurrentUser(),
      error: error instanceof Error ? error.message : "Unable to regenerate marketing tasks",
    };
  }
}

export async function patchMarketingAgentTaskForCurrentUser(
  input: MarketingAgentTaskPatchInput
): Promise<{ task: ReturnType<typeof toTaskWithMeta> | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { task: null, error: "Unauthorized" };
  }

  const existing = await getMarketingTaskById(supabase, user.id, input.id);
  if (!existing) {
    return { task: null, error: "Task not found" };
  }

  const status =
    input.action === "complete"
      ? "completed"
      : input.action === "dismiss"
        ? "dismissed"
        : "in_progress";

  const updated = await updateMarketingTaskStatus(supabase, user.id, input.id, status);
  return updated ? { task: toTaskWithMeta(updated) } : { task: null, error: "Unable to update task" };
}
