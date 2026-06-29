import "server-only";

import OpenAI from "openai";
import { buildMarketingPlannerPrompt } from "@/lib/marketing-planner/planner";
import type {
  MarketingPlanJson,
  MarketingPlanner,
  MarketingPlannerContext,
} from "@/lib/marketing-planner/types";

/** Update this constant to change the OpenAI model used for marketing plan generation. */
export const OPENAI_MARKETING_PLANNER_MODEL = "gpt-4.1-mini";

const stringArraySchema = { type: "array", items: { type: "string" } } as const;

const MARKETING_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "businessGoals",
    "marketingThemes",
    "weeklyFocus",
    "thirtyDayCalendar",
    "recommendedPostingSchedule",
    "contentMix",
    "googleBusinessProfilePostingCadence",
    "blogRecommendations",
    "emailCampaignIdeas",
    "seasonalCampaigns",
    "suggestedPromotions",
    "videoIdeas",
    "socialPlatformRecommendations",
    "kpisToMonitor",
  ],
  properties: {
    executiveSummary: { type: "string" },
    businessGoals: stringArraySchema,
    marketingThemes: stringArraySchema,
    weeklyFocus: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["week", "title", "focus", "actions"],
        properties: {
          week: { type: "integer" },
          title: { type: "string" },
          focus: { type: "string" },
          actions: stringArraySchema,
        },
      },
    },
    thirtyDayCalendar: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "title", "channel", "contentType", "note"],
        properties: {
          day: { type: "integer" },
          title: { type: "string" },
          channel: { type: "string" },
          contentType: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    recommendedPostingSchedule: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "cadence", "bestTimes", "notes"],
        properties: {
          platform: { type: "string" },
          cadence: { type: "string" },
          bestTimes: stringArraySchema,
          notes: { type: "string" },
        },
      },
    },
    contentMix: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "percentage", "description"],
        properties: {
          type: { type: "string" },
          percentage: { type: "integer" },
          description: { type: "string" },
        },
      },
    },
    googleBusinessProfilePostingCadence: {
      type: "object",
      additionalProperties: false,
      required: ["cadence", "postTypes", "notes"],
      properties: {
        cadence: { type: "string" },
        postTypes: stringArraySchema,
        notes: { type: "string" },
      },
    },
    blogRecommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "angle", "keywords"],
        properties: {
          title: { type: "string" },
          angle: { type: "string" },
          keywords: stringArraySchema,
        },
      },
    },
    emailCampaignIdeas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "audience", "goal", "subjectLine"],
        properties: {
          title: { type: "string" },
          audience: { type: "string" },
          goal: { type: "string" },
          subjectLine: { type: "string" },
        },
      },
    },
    seasonalCampaigns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "timing", "description"],
        properties: {
          title: { type: "string" },
          timing: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    suggestedPromotions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "offer", "channel", "goal"],
        properties: {
          title: { type: "string" },
          offer: { type: "string" },
          channel: { type: "string" },
          goal: { type: "string" },
        },
      },
    },
    videoIdeas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "format", "hook"],
        properties: {
          title: { type: "string" },
          format: { type: "string" },
          hook: { type: "string" },
        },
      },
    },
    socialPlatformRecommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "priority", "rationale", "contentFocus"],
        properties: {
          platform: { type: "string" },
          priority: { type: "string" },
          rationale: { type: "string" },
          contentFocus: stringArraySchema,
        },
      },
    },
    kpisToMonitor: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["metric", "target", "why"],
        properties: {
          metric: { type: "string" },
          target: { type: "string" },
          why: { type: "string" },
        },
      },
    },
  },
} as const;

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePlan(raw: unknown): MarketingPlanJson {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid marketing plan response");
  }

  const record = raw as Record<string, unknown>;
  const gbpRaw = record.googleBusinessProfilePostingCadence;

  if (!gbpRaw || typeof gbpRaw !== "object") {
    throw new Error("Invalid Google Business Profile cadence in marketing plan");
  }

  const gbp = gbpRaw as Record<string, unknown>;

  return {
    executiveSummary: readString(
      record.executiveSummary,
      "Monthly marketing plan generated from your business intelligence."
    ),
    businessGoals: readStringArray(record.businessGoals),
    marketingThemes: readStringArray(record.marketingThemes),
    weeklyFocus: Array.isArray(record.weeklyFocus)
      ? record.weeklyFocus
          .map((item, index) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              week: readNumber(row.week, index + 1),
              title: readString(row.title, `Week ${index + 1}`),
              focus: readString(row.focus),
              actions: readStringArray(row.actions),
            };
          })
          .filter((item): item is MarketingPlanJson["weeklyFocus"][number] => Boolean(item?.title))
      : [],
    thirtyDayCalendar: Array.isArray(record.thirtyDayCalendar)
      ? record.thirtyDayCalendar
          .map((item, index) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              day: readNumber(row.day, index + 1),
              title: readString(row.title, `Day ${index + 1}`),
              channel: readString(row.channel),
              contentType: readString(row.contentType),
              note: readString(row.note),
            };
          })
          .filter((item): item is MarketingPlanJson["thirtyDayCalendar"][number] => Boolean(item?.title))
      : [],
    recommendedPostingSchedule: Array.isArray(record.recommendedPostingSchedule)
      ? record.recommendedPostingSchedule
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              platform: readString(row.platform),
              cadence: readString(row.cadence),
              bestTimes: readStringArray(row.bestTimes),
              notes: readString(row.notes),
            };
          })
          .filter(
            (item): item is MarketingPlanJson["recommendedPostingSchedule"][number] =>
              Boolean(item?.platform)
          )
      : [],
    contentMix: Array.isArray(record.contentMix)
      ? record.contentMix
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              type: readString(row.type),
              percentage: readNumber(row.percentage, 0),
              description: readString(row.description),
            };
          })
          .filter((item): item is MarketingPlanJson["contentMix"][number] => Boolean(item?.type))
      : [],
    googleBusinessProfilePostingCadence: {
      cadence: readString(gbp.cadence, "2-3 posts per week"),
      postTypes: readStringArray(gbp.postTypes),
      notes: readString(gbp.notes),
    },
    blogRecommendations: Array.isArray(record.blogRecommendations)
      ? record.blogRecommendations
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              title: readString(row.title),
              angle: readString(row.angle),
              keywords: readStringArray(row.keywords),
            };
          })
          .filter(
            (item): item is MarketingPlanJson["blogRecommendations"][number] => Boolean(item?.title)
          )
      : [],
    emailCampaignIdeas: Array.isArray(record.emailCampaignIdeas)
      ? record.emailCampaignIdeas
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              title: readString(row.title),
              audience: readString(row.audience),
              goal: readString(row.goal),
              subjectLine: readString(row.subjectLine),
            };
          })
          .filter(
            (item): item is MarketingPlanJson["emailCampaignIdeas"][number] => Boolean(item?.title)
          )
      : [],
    seasonalCampaigns: Array.isArray(record.seasonalCampaigns)
      ? record.seasonalCampaigns
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              title: readString(row.title),
              timing: readString(row.timing),
              description: readString(row.description),
            };
          })
          .filter(
            (item): item is MarketingPlanJson["seasonalCampaigns"][number] => Boolean(item?.title)
          )
      : [],
    suggestedPromotions: Array.isArray(record.suggestedPromotions)
      ? record.suggestedPromotions
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              title: readString(row.title),
              offer: readString(row.offer),
              channel: readString(row.channel),
              goal: readString(row.goal),
            };
          })
          .filter(
            (item): item is MarketingPlanJson["suggestedPromotions"][number] => Boolean(item?.title)
          )
      : [],
    videoIdeas: Array.isArray(record.videoIdeas)
      ? record.videoIdeas
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              title: readString(row.title),
              format: readString(row.format),
              hook: readString(row.hook),
            };
          })
          .filter((item): item is MarketingPlanJson["videoIdeas"][number] => Boolean(item?.title))
      : [],
    socialPlatformRecommendations: Array.isArray(record.socialPlatformRecommendations)
      ? record.socialPlatformRecommendations
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              platform: readString(row.platform),
              priority: readString(row.priority),
              rationale: readString(row.rationale),
              contentFocus: readStringArray(row.contentFocus),
            };
          })
          .filter(
            (item): item is MarketingPlanJson["socialPlatformRecommendations"][number] =>
              Boolean(item?.platform)
          )
      : [],
    kpisToMonitor: Array.isArray(record.kpisToMonitor)
      ? record.kpisToMonitor
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            return {
              metric: readString(row.metric),
              target: readString(row.target),
              why: readString(row.why),
            };
          })
          .filter((item): item is MarketingPlanJson["kpisToMonitor"][number] => Boolean(item?.metric))
      : [],
  };
}

export class OpenAiMarketingPlanner implements MarketingPlanner {
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey?.trim()) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.client = new OpenAI({ apiKey });
  }

  async generate(context: MarketingPlannerContext): Promise<MarketingPlanJson> {
    const { system, user } = buildMarketingPlannerPrompt(context);

    const response = await this.client.responses.create({
      model: OPENAI_MARKETING_PLANNER_MODEL,
      temperature: 0.7,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "marketing_plan",
          schema: MARKETING_PLAN_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new Error("OpenAI returned an empty marketing plan response");
    }

    const parsed = JSON.parse(outputText) as unknown;
    return normalizePlan(parsed);
  }
}

export function createMarketingPlanner(): MarketingPlanner {
  if (!isOpenAiMarketingPlannerConfigured()) {
    throw new Error(
      "Marketing plan generation is temporarily unavailable. Please try again later."
    );
  }

  return new OpenAiMarketingPlanner();
}

export function isOpenAiMarketingPlannerConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function formatOpenAiMarketingPlannerError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return "Marketing plan generation failed: OpenAI authentication error.";
    if (error.status === 429) return "Marketing plan generation failed: OpenAI rate limit reached. Try again shortly.";
    if (error.status === 503) return "Marketing plan generation failed: OpenAI is temporarily unavailable.";
    return error.message || "Marketing plan generation failed due to an OpenAI error.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Marketing plan generation failed due to an unexpected error.";
}
