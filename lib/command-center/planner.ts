import "server-only";

import OpenAI from "openai";
import { buildBusinessIntel } from "@/lib/content-generator/prompt-builder";
import type { loadCommandCenterContext } from "@/lib/command-center/context";
import type {
  CommandCenterBusinessHealth,
  CommandCenterGeneratedInsights,
  CommandCenterRecommendedAction,
} from "@/lib/command-center/types";

/** Update this constant to change the OpenAI model used for the command center. */
export const OPENAI_COMMAND_CENTER_MODEL = "gpt-4.1-mini";

const COMMAND_CENTER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "businessHealthExplanation",
    "momentum",
    "recommendations",
  ],
  properties: {
    executiveSummary: { type: "string" },
    businessHealthExplanation: { type: "string" },
    momentum: {
      type: "object",
      additionalProperties: false,
      required: ["trend", "reasons"],
      properties: {
        trend: { type: "string" },
        reasons: { type: "array", items: { type: "string" } },
      },
    },
    recommendations: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "priority", "reason", "estimatedImpact", "recommendedAction"],
        properties: {
          title: { type: "string" },
          priority: { type: "string" },
          reason: { type: "string" },
          estimatedImpact: { type: "string" },
          recommendedAction: { type: "string" },
        },
      },
    },
  },
} as const;

const ALLOWED_ACTIONS: CommandCenterRecommendedAction[] = [
  "generate_content",
  "open_approval",
  "open_publishing",
  "open_marketing_plan",
  "open_website_analysis",
  "refresh_marketing_plan",
  "refresh_website_analysis",
  "sync_google_business",
  "open_tasks",
  "open_google_business",
];

function normalizePriority(value: string): "high" | "medium" | "low" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function normalizeTrend(value: string): "up" | "stable" | "down" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "up" || normalized === "stable" || normalized === "down") {
    return normalized;
  }
  return "stable";
}

function normalizeAction(value: string): CommandCenterRecommendedAction {
  const normalized = value.trim().toLowerCase() as CommandCenterRecommendedAction;
  if (ALLOWED_ACTIONS.includes(normalized)) return normalized;
  return "open_tasks";
}

export function buildCommandCenterPrompt(input: {
  context: NonNullable<Awaited<ReturnType<typeof loadCommandCenterContext>>>;
  businessHealth: CommandCenterBusinessHealth;
}): { system: string; user: string } {
  const { context, businessHealth } = input;
  const businessIntel = context.generationContext
    ? buildBusinessIntel(context.generationContext)
    : null;

  const system = [
    "You are AJN Marketing's AI Chief Marketing Officer.",
    "Produce an executive command center briefing using ONLY supplied business data.",
    "Never invent services, cities, industries, competitors, metrics, or emergencies.",
    "Never recommend automatic publishing or automatic approval.",
    "Return structured JSON only.",
  ].join(" ");

  const user = [
    "BUSINESS PROFILE",
    JSON.stringify(
      context.generationContext?.businessProfile ?? null,
      null,
      2
    ),
    "",
    "WEBSITE ANALYSIS",
    JSON.stringify(
      {
        status: context.analysisMeta,
        analysis: context.analysis,
      },
      null,
      2
    ),
    "",
    "AI MARKETING PROFILE",
    JSON.stringify(context.generationContext?.aiMarketingProfile ?? null, null, 2),
    "",
    "MARKETING PLAN",
    JSON.stringify(
      {
        month: context.planData.monthName,
        status: context.planData.plan?.status ?? "missing",
        executiveSummary: context.planData.plan?.plan_json?.executiveSummary ?? null,
        todayTasks: context.taskData.stats,
      },
      null,
      2
    ),
    "",
    "TODAY'S TASKS",
    JSON.stringify(context.taskData.tasks.slice(0, 10), null, 2),
    "",
    "GOOGLE BUSINESS INSIGHTS",
    JSON.stringify(
      {
        connected: context.gbpData.connected,
        reviewSummary: context.gbpData.reviewSummary,
        insights: context.gbpData.insights,
        recentReviews: context.gbpData.recentReviews.slice(0, 5),
      },
      null,
      2
    ),
    "",
    "PUBLISHING QUEUE",
    JSON.stringify(
      {
        stats: context.publishingStats,
        items: context.publishingItems,
      },
      null,
      2
    ),
    "",
    "APPROVAL QUEUE",
    JSON.stringify(
      {
        stats: context.approvalStats,
        items: context.approvals,
      },
      null,
      2
    ),
    "",
    "BUSINESS HEALTH SCORES",
    JSON.stringify(businessHealth, null, 2),
    "",
    "BRAND INTELLIGENCE",
    JSON.stringify(businessIntel, null, 2),
    "",
    "Generate an executive summary, business health explanation, marketing momentum assessment, and 3 to 6 recommendations.",
    "Use recommendedAction values: generate_content, open_approval, open_publishing, open_marketing_plan, open_website_analysis, refresh_marketing_plan, refresh_website_analysis, sync_google_business, open_tasks, open_google_business.",
  ].join("\n");

  return { system, user };
}

export function buildFallbackInsights(input: {
  context: NonNullable<Awaited<ReturnType<typeof loadCommandCenterContext>>>;
  businessHealth: CommandCenterBusinessHealth;
}): CommandCenterGeneratedInsights {
  const { context, businessHealth } = input;
  const businessName =
    context.generationContext?.businessProfile.business_name ?? "your business";

  const recommendations: CommandCenterGeneratedInsights["recommendations"] = [];

  if (context.approvalStats.pending > 0) {
    recommendations.push({
      title: "Review pending approvals",
      priority: "high",
      reason: `${context.approvalStats.pending} content item(s) are waiting for approval.`,
      estimatedImpact: "Keeps publishing pipeline moving",
      recommendedAction: "open_approval",
    });
  }

  if (context.taskData.stats.highPriorityPending > 0) {
    recommendations.push({
      title: "Complete today's high-priority tasks",
      priority: "high",
      reason: `${context.taskData.stats.highPriorityPending} high-priority marketing task(s) are due today.`,
      estimatedImpact: "Maintains daily marketing momentum",
      recommendedAction: "open_tasks",
    });
  }

  if (!context.gbpData.connected) {
    recommendations.push({
      title: "Connect Google Business Profile",
      priority: "medium",
      reason: "Google Business data is not connected yet.",
      estimatedImpact: "Unlocks reviews, insights, and local visibility tracking",
      recommendedAction: "open_google_business",
    });
  } else if (!context.gbpData.lastSyncedAt) {
    recommendations.push({
      title: "Sync Google Business data",
      priority: "medium",
      reason: "Google Business Profile is connected but has not been synced yet.",
      estimatedImpact: "Brings live reviews and performance metrics into the dashboard",
      recommendedAction: "sync_google_business",
    });
  }

  if (context.planData.plan?.status !== "active") {
    recommendations.push({
      title: "Refresh marketing plan",
      priority: "medium",
      reason: "No active monthly marketing plan is available.",
      estimatedImpact: "Aligns daily work with a structured marketing strategy",
      recommendedAction: "refresh_marketing_plan",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Generate today's content",
      priority: "medium",
      reason: "Your core marketing systems are active. Focus on creating the next approved content asset.",
      estimatedImpact: "Sustains visibility and engagement",
      recommendedAction: "generate_content",
    });
  }

  return {
    executiveSummary: `${businessName} has an overall marketing health score of ${businessHealth.overall}/100. Focus today on approvals, scheduled publishing, and the highest-priority tasks already identified by the AI Marketing Agent.`,
    businessHealthExplanation: `Health scores are based on synced website analysis, Google Business data, review response status, content pipeline activity, and task consistency. SEO is ${businessHealth.seo}/100, Google is ${businessHealth.google}/100, reviews are ${businessHealth.reviews}/100, content is ${businessHealth.content}/100, and consistency is ${businessHealth.consistency}/100.`,
    momentum: {
      trend:
        context.taskData.stats.completedToday > 0 ||
        context.approvalStats.approvedThisMonth > 0
          ? "up"
          : "stable",
      reasons: [
        `${context.taskData.stats.completedToday} task(s) completed today`,
        `${context.approvalStats.pending} approval item(s) pending`,
        context.gbpData.connected
          ? `${context.gbpData.reviewSummary.newReviewsThisMonth} new review(s) this month`
          : "Google Business Profile not connected",
      ],
    },
    recommendations: recommendations.slice(0, 6),
  };
}

export async function generateCommandCenterInsights(input: {
  context: NonNullable<Awaited<ReturnType<typeof loadCommandCenterContext>>>;
  businessHealth: CommandCenterBusinessHealth;
}): Promise<CommandCenterGeneratedInsights> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return buildFallbackInsights(input);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { system, user } = buildCommandCenterPrompt(input);

  try {
    const response = await client.responses.create({
      model: OPENAI_COMMAND_CENTER_MODEL,
      temperature: 0.6,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "command_center_insights",
          schema: COMMAND_CENTER_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      return buildFallbackInsights(input);
    }

    const parsed = JSON.parse(outputText) as CommandCenterGeneratedInsights & {
      momentum: { trend: string; reasons: string[] };
      recommendations: Array<{ recommendedAction: string; priority: string }>;
    };

    return {
      executiveSummary: parsed.executiveSummary,
      businessHealthExplanation: parsed.businessHealthExplanation,
      momentum: {
        trend: normalizeTrend(parsed.momentum.trend),
        reasons: parsed.momentum.reasons.slice(0, 5),
      },
      recommendations: parsed.recommendations.slice(0, 6).map((item) => ({
        title: item.title,
        priority: normalizePriority(item.priority),
        reason: item.reason,
        estimatedImpact: item.estimatedImpact,
        recommendedAction: normalizeAction(item.recommendedAction),
      })),
    };
  } catch {
    return buildFallbackInsights(input);
  }
}
