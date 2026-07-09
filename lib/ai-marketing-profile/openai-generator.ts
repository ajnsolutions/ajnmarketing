import "server-only";

import OpenAI from "openai";
import type {
  AiMarketingProfileGenerated,
  AiMarketingProfileGenerator,
  AiMarketingProfileSourceData,
} from "@/lib/ai-marketing-profile/types";
import { AiMarketingProfileGenerationError, buildOpenAiFailureDetails } from "@/lib/ai-marketing-profile/errors";

/** Update this constant to change the OpenAI model used for AI marketing profile generation. */
export const OPENAI_MARKETING_PROFILE_MODEL = "gpt-4.1-mini";

const MARKETING_PROFILE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "business_summary",
    "target_audience",
    "ideal_customer",
    "services",
    "service_areas",
    "industry",
    "brand_voice",
    "tone",
    "value_proposition",
    "keywords",
    "competitors",
    "faqs",
    "seasonal_opportunities",
    "recommended_ctas",
    "common_objections",
    "brand_personality",
    "writing_examples",
    "marketing_strategy",
    "seo_strategy",
    "content_strategy",
    "review_strategy",
    "google_business_strategy",
    "monthly_themes",
    "quarterly_campaigns",
  ],
  properties: {
    business_summary: { type: "string" },
    target_audience: { type: "string" },
    ideal_customer: { type: "string" },
    services: { type: "array", items: { type: "string" } },
    service_areas: { type: "array", items: { type: "string" } },
    industry: { type: "string" },
    brand_voice: { type: "string" },
    tone: { type: "string" },
    value_proposition: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    competitors: { type: "array", items: { type: "string" } },
    faqs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
    seasonal_opportunities: { type: "array", items: { type: "string" } },
    recommended_ctas: { type: "array", items: { type: "string" } },
    common_objections: { type: "array", items: { type: "string" } },
    brand_personality: { type: "array", items: { type: "string" } },
    writing_examples: { type: "array", items: { type: "string" } },
    marketing_strategy: { type: "string" },
    seo_strategy: { type: "string" },
    content_strategy: { type: "string" },
    review_strategy: { type: "string" },
    google_business_strategy: { type: "string" },
    monthly_themes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["month", "theme", "focus"],
        properties: {
          month: { type: "string" },
          theme: { type: "string" },
          focus: { type: "string" },
        },
      },
    },
    quarterly_campaigns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
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

function normalizeGenerated(raw: Record<string, unknown>): AiMarketingProfileGenerated {
  return {
    business_summary: readString(raw.business_summary, "Marketing profile generated from available business data."),
    target_audience: readString(raw.target_audience, "Target audience based on website and onboarding data."),
    ideal_customer: readString(raw.ideal_customer, "Ideal customer based on website and onboarding data."),
    services: readStringArray(raw.services),
    service_areas: readStringArray(raw.service_areas),
    industry: readString(raw.industry, "Business"),
    brand_voice: readString(raw.brand_voice, "Professional, clear, and customer-focused."),
    tone: readString(raw.tone, "Professional and helpful"),
    value_proposition: readString(raw.value_proposition, "Trusted provider focused on customer outcomes."),
    keywords: readStringArray(raw.keywords),
    competitors: readStringArray(raw.competitors),
    faqs: Array.isArray(raw.faqs)
      ? raw.faqs
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const question = readString(record.question);
            const answer = readString(record.answer);
            return question && answer ? { question, answer } : null;
          })
          .filter((item): item is { question: string; answer: string } => item !== null)
      : [],
    seasonal_opportunities: readStringArray(raw.seasonal_opportunities),
    recommended_ctas: readStringArray(raw.recommended_ctas),
    common_objections: readStringArray(raw.common_objections),
    brand_personality: readStringArray(raw.brand_personality),
    writing_examples: readStringArray(raw.writing_examples),
    marketing_strategy: readString(raw.marketing_strategy, "Build consistent messaging across search, content, and reviews."),
    seo_strategy: readString(raw.seo_strategy, "Improve visibility around priority services and audience terms."),
    content_strategy: readString(raw.content_strategy, "Publish educational and conversion-focused content aligned to services."),
    review_strategy: readString(raw.review_strategy, "Collect and respond to reviews in the brand voice."),
    google_business_strategy: readString(
      raw.google_business_strategy,
      "Use Google Business Profile posts to reinforce services, trust, and local relevance."
    ),
    monthly_themes: Array.isArray(raw.monthly_themes)
      ? raw.monthly_themes
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const month = readString(record.month);
            const theme = readString(record.theme);
            const focus = readString(record.focus);
            return month && theme && focus ? { month, theme, focus } : null;
          })
          .filter((item): item is { month: string; theme: string; focus: string } => item !== null)
      : [],
    quarterly_campaigns: Array.isArray(raw.quarterly_campaigns)
      ? raw.quarterly_campaigns
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            const title = readString(record.title);
            const description = readString(record.description);
            return title && description ? { title, description } : null;
          })
          .filter((item): item is { title: string; description: string } => item !== null)
      : [],
  };
}

function buildPrompt(source: AiMarketingProfileSourceData): string {
  return [
    "Create a centralized AI marketing profile for AJN Marketing using the business profile and website analysis below.",
    "",
    "Rules:",
    "- Combine onboarding preferences, website analysis, brand voice, services, cities, keywords, persona, value proposition, and content opportunities.",
    "- Do not invent homeowners, plumbers, or local service audiences unless supported by the source data.",
    "- Keep strategies practical and aligned to the actual business model.",
    "- Return complete structured JSON only.",
    "",
    "Business profile:",
    JSON.stringify(source.businessProfile, null, 2),
    "",
    "Website analysis:",
    JSON.stringify(source.websiteAnalysis, null, 2),
  ].join("\n");
}

export class OpenAiMarketingProfileGenerator implements AiMarketingProfileGenerator {
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey?.trim()) {
      throw new AiMarketingProfileGenerationError({
        provider: "openai",
        model: OPENAI_MARKETING_PROFILE_MODEL,
        message: "OPENAI_API_KEY is not configured",
      });
    }

    this.client = new OpenAI({ apiKey });
  }

  async generate(source: AiMarketingProfileSourceData): Promise<AiMarketingProfileGenerated> {
    let outputText: string | undefined;

    try {
      const response = await this.client.responses.create({
        model: OPENAI_MARKETING_PROFILE_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are an expert marketing strategist building a reusable AI marketing brain for a customer account. Use only supported source data.",
          },
          {
            role: "user",
            content: buildPrompt(source),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ai_marketing_profile",
            schema: MARKETING_PROFILE_JSON_SCHEMA,
            strict: true,
          },
        },
      });

      outputText = response.output_text?.trim();
    } catch (error) {
      // Never swallow this and fall back to fake content — surface a structured error so the
      // caller can log it, store it for troubleshooting, and show a real failure state.
      throw new AiMarketingProfileGenerationError(
        buildOpenAiFailureDetails(error, OPENAI_MARKETING_PROFILE_MODEL),
        { cause: error }
      );
    }

    if (!outputText) {
      throw new AiMarketingProfileGenerationError({
        provider: "openai",
        model: OPENAI_MARKETING_PROFILE_MODEL,
        message: "OpenAI returned an empty marketing profile response",
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(outputText) as Record<string, unknown>;
    } catch (error) {
      throw new AiMarketingProfileGenerationError(
        {
          provider: "openai",
          model: OPENAI_MARKETING_PROFILE_MODEL,
          message: "OpenAI returned a marketing profile response that was not valid JSON",
        },
        { cause: error }
      );
    }

    return normalizeGenerated(parsed);
  }
}

export function isOpenAiMarketingProfileConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
