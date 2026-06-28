import "server-only";

import OpenAI from "openai";
import { buildBusinessIntel } from "@/lib/content-generator/prompt-builder";
import type { ContentGenerationContext } from "@/lib/content-generator/types";
import {
  normalizePriority,
  normalizeRecommendedAction,
} from "@/lib/marketing-agent/persistence";
import type {
  GeneratedMarketingTask,
  MarketingAgentContext,
  MarketingAgentGeneratedTasks,
  MarketingTaskRecommendedAction,
} from "@/lib/marketing-agent/types";

/** Update this constant to change the OpenAI model used for marketing agent task planning. */
export const OPENAI_MARKETING_AGENT_MODEL = "gpt-4.1-mini";

const MARKETING_AGENT_TASKS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "task_type",
          "title",
          "description",
          "priority",
          "reason",
          "recommended_action",
          "estimated_minutes",
          "related_plan_item",
        ],
        properties: {
          task_type: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string" },
          reason: { type: "string" },
          recommended_action: { type: "string" },
          estimated_minutes: { type: "integer" },
          related_plan_item: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 15;
  return Math.max(5, Math.min(180, Math.round(parsed)));
}

function normalizeRecommendedActionValue(value: string): MarketingTaskRecommendedAction {
  const normalized = value.trim().toLowerCase();

  const allowed: MarketingTaskRecommendedAction[] = [
    "generate_content",
    "open_approval",
    "open_publishing",
    "open_marketing_plan",
    "open_website_analysis",
    "refresh_marketing_plan",
    "review_content",
  ];

  if (allowed.includes(normalized as MarketingTaskRecommendedAction)) {
    return normalized as MarketingTaskRecommendedAction;
  }

  return normalizeRecommendedAction(value);
}

export function buildMarketingAgentPrompt(
  context: MarketingAgentContext,
  businessIntel: ReturnType<typeof buildBusinessIntel>
): { system: string; user: string } {
  const system = [
    "You are AJN Marketing's AI Marketing Agent.",
    "Determine the highest-priority marketing work the customer should focus on today.",
    "Use ONLY the supplied business intelligence, marketing plan, approval queue, and publishing queue.",
    "Never invent services, audiences, cities, industries, emergencies, repairs, homeowners, plumbing, HVAC, dental, or other details unless explicitly supported by the source data.",
    "Never recommend automatic publishing or automatic approval.",
    "Return structured JSON only.",
  ].join(" ");

  const user = [
    "CURRENT DATE",
    JSON.stringify(
      {
        isoDate: context.currentDate,
        label: context.currentDateLabel,
      },
      null,
      2
    ),
    "",
    "BUSINESS INTELLIGENCE",
    JSON.stringify(
      {
        businessName: businessIntel.businessName,
        industry: businessIntel.industry,
        services: businessIntel.services,
        serviceAreas: businessIntel.serviceAreas,
        brandVoice: businessIntel.brandVoice,
        valueProposition: businessIntel.valueProposition,
        keywords: businessIntel.keywords,
        marketingGoals: businessIntel.marketingGoals,
        contentOpportunities: businessIntel.contentOpportunities,
        websiteSummary: businessIntel.websiteSummary,
      },
      null,
      2
    ),
    "",
    "WEBSITE ANALYSIS",
    JSON.stringify(context.websiteAnalysis, null, 2),
    "",
    "AI MARKETING PROFILE",
    JSON.stringify(context.aiMarketingProfile, null, 2),
    "",
    "CURRENT MARKETING PLAN",
    JSON.stringify(context.marketingPlan, null, 2),
    "",
    "PENDING APPROVAL ITEMS",
    JSON.stringify(context.pendingApprovals, null, 2),
    "",
    "PUBLISHING QUEUE",
    JSON.stringify(context.publishingQueue, null, 2),
    "",
    "Generate 3 to 8 actionable tasks for today.",
    "Prioritize work that aligns with today's marketing plan calendar, pending approvals, scheduled publishing, and business goals.",
    "Each task must include task_type, title, description, priority, reason, recommended_action, estimated_minutes, and related_plan_item.",
    "Set related_plan_item to the linked marketing plan item title when applicable, otherwise null.",
    "Use recommended_action values: generate_content, open_approval, open_publishing, open_marketing_plan, open_website_analysis, refresh_marketing_plan, review_content.",
  ].join("\n");

  return { system, user };
}

export function normalizeGeneratedTasks(raw: unknown): GeneratedMarketingTask[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid marketing agent task response");
  }

  const tasks = (raw as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("OpenAI returned no marketing tasks");
  }

  return tasks.slice(0, 8).map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid task in marketing agent response");
    }

    const record = item as Record<string, unknown>;

    return {
      task_type: readString(record.task_type, "marketing_task"),
      title: readString(record.title, "Marketing task"),
      description: readString(record.description),
      priority: normalizePriority(readString(record.priority, "medium")),
      reason: readString(record.reason, "Recommended based on today's marketing priorities."),
      recommended_action: normalizeRecommendedActionValue(
        readString(record.recommended_action, "generate_content")
      ),
      estimated_minutes: readMinutes(record.estimated_minutes),
      related_plan_item:
        record.related_plan_item === null
          ? undefined
          : readString(record.related_plan_item) || undefined,
    };
  });
}

export async function generateMarketingAgentTasks(
  context: MarketingAgentContext,
  generationContext: ContentGenerationContext
): Promise<GeneratedMarketingTask[]> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("Marketing agent requires OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const businessIntel = buildBusinessIntel(generationContext);
  const { system, user } = buildMarketingAgentPrompt(context, businessIntel);

  let response: OpenAI.Responses.Response;

  try {
    response = await client.responses.create({
      model: OPENAI_MARKETING_AGENT_MODEL,
      temperature: 0.6,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "marketing_agent_tasks",
          schema: MARKETING_AGENT_TASKS_JSON_SCHEMA,
          strict: true,
        },
      },
    });
  } catch (error) {
    throw new Error(formatMarketingAgentError(error));
  }

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("OpenAI returned an empty marketing agent response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText) as MarketingAgentGeneratedTasks;
  } catch {
    throw new Error("OpenAI returned invalid JSON for marketing agent tasks");
  }

  const tasks = normalizeGeneratedTasks(parsed);

  for (const task of tasks) {
    if (!task.title || !task.description) {
      throw new Error("OpenAI returned incomplete marketing tasks");
    }
  }

  return tasks;
}

export function formatMarketingAgentError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return "Marketing agent failed: OpenAI authentication error.";
    if (error.status === 429) return "Marketing agent failed: OpenAI rate limit reached. Try again shortly.";
    if (error.status === 503) return "Marketing agent failed: OpenAI is temporarily unavailable.";
    return error.message || "Marketing agent failed due to an OpenAI error.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Marketing agent failed due to an unexpected error.";
}
