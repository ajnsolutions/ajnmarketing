import "server-only";

import OpenAI from "openai";
import { buildContentGenerationPrompt } from "@/lib/content-generator/prompt-builder";
import type {
  ContentGenerationContext,
  ContentGenerationRequest,
  ContentGenerationResult,
  ContentGenerator,
  GeneratedContentVariation,
  VariationStyle,
} from "@/lib/content-generator/types";

/** Update this constant to change the OpenAI model used for content generation. */
export const OPENAI_CONTENT_GENERATOR_MODEL = "gpt-4.1-mini";

export const OPENAI_CONTENT_GENERATOR_TEMPERATURE = 0.8;

const VARIATION_STYLES: VariationStyle[] = [
  "Educational",
  "Trust / Authority",
  "Promotion / Engagement",
];

const CONTENT_GENERATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["variations"],
  properties: {
    variations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "style",
          "title",
          "content",
          "cta",
          "hashtags",
          "seoKeywords",
          "qualityScore",
          "voiceScore",
          "reasoning",
        ],
        properties: {
          style: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          cta: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          seoKeywords: { type: "array", items: { type: "string" } },
          qualityScore: { type: "integer" },
          voiceScore: { type: "integer" },
          reasoning: { type: "string" },
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

function readScore(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeStyle(value: string, index: number): VariationStyle {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("trust") || normalized.includes("authority")) {
    return "Trust / Authority";
  }
  if (normalized.includes("promotion") || normalized.includes("engagement")) {
    return "Promotion / Engagement";
  }
  if (normalized.includes("educational") || normalized.includes("education")) {
    return "Educational";
  }
  return VARIATION_STYLES[index] ?? "Educational";
}

function normalizeVariations(raw: unknown): GeneratedContentVariation[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid content generation response");
  }

  const variations = (raw as { variations?: unknown }).variations;
  if (!Array.isArray(variations) || variations.length === 0) {
    throw new Error("OpenAI returned no content variations");
  }

  return variations.slice(0, 3).map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid variation in content generation response");
    }

    const record = item as Record<string, unknown>;

    return {
      style: normalizeStyle(readString(record.style), index),
      title: readString(record.title, `Variation ${index + 1}`),
      content: readString(record.content),
      cta: readString(record.cta),
      hashtags: readStringArray(record.hashtags),
      seoKeywords: readStringArray(record.seoKeywords),
      qualityScore: readScore(record.qualityScore, 80),
      voiceScore: readScore(record.voiceScore, 85),
      reasoning: readString(record.reasoning, "Generated from business intelligence."),
    };
  });
}

export class OpenAIContentGenerator implements ContentGenerator {
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey?.trim()) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.client = new OpenAI({ apiKey });
  }

  async generate(
    context: ContentGenerationContext,
    request: ContentGenerationRequest
  ): Promise<ContentGenerationResult> {
    const { system, user } = buildContentGenerationPrompt(context, request);

    let response: OpenAI.Responses.Response;

    try {
      response = await this.client.responses.create({
        model: OPENAI_CONTENT_GENERATOR_MODEL,
        temperature: OPENAI_CONTENT_GENERATOR_TEMPERATURE,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "content_generation",
            schema: CONTENT_GENERATION_JSON_SCHEMA,
            strict: true,
          },
        },
      });
    } catch (error) {
      throw new Error(formatOpenAiContentError(error));
    }

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new Error("OpenAI returned an empty content generation response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new Error("OpenAI returned invalid JSON for content generation");
    }

    const variations = normalizeVariations(parsed);

    for (const variation of variations) {
      if (!variation.content) {
        throw new Error("OpenAI returned incomplete content for one or more variations");
      }
    }

    return { variations };
  }
}

export function formatOpenAiContentError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return "Content generation failed: OpenAI authentication error.";
    if (error.status === 429) return "Content generation failed: OpenAI rate limit reached. Try again shortly.";
    if (error.status === 503) return "Content generation failed: OpenAI is temporarily unavailable.";
    return error.message || "Content generation failed due to an OpenAI error.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Content generation failed due to an unexpected error.";
}

export function isOpenAiContentGeneratorConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
