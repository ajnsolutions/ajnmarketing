import "server-only";

import OpenAI from "openai";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";
import {
  TestimonialKnowledgeCategories,
  TestimonialKnowledgeConfidenceLevels,
  type ExtractedTestimonialKnowledgeItem,
  type TestimonialExtractionResult,
  type TestimonialKnowledgeCategory,
  type TestimonialKnowledgeConfidenceLevel,
} from "@/lib/testimonials/types";

/** Update this constant to change the OpenAI model used for testimonial extraction. */
export const OPENAI_TESTIMONIAL_EXTRACTION_MODEL = "gpt-4.1-mini";

const TESTIMONIAL_CATEGORY_VALUES = Object.values(TestimonialKnowledgeCategories);

const TESTIMONIAL_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "fact", "sourceExcerpt", "confidence"],
        properties: {
          category: { type: "string", enum: TESTIMONIAL_CATEGORY_VALUES },
          fact: { type: "string" },
          sourceExcerpt: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
} as const;

function truncateText(text: string, maxLength = 4000): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Content truncated for analysis]`;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function isTestimonialCategory(value: unknown): value is TestimonialKnowledgeCategory {
  return typeof value === "string" && (TESTIMONIAL_CATEGORY_VALUES as string[]).includes(value);
}

function isConfidenceLevel(value: unknown): value is TestimonialKnowledgeConfidenceLevel {
  return (
    value === TestimonialKnowledgeConfidenceLevels.LOW ||
    value === TestimonialKnowledgeConfidenceLevels.MEDIUM ||
    value === TestimonialKnowledgeConfidenceLevels.HIGH
  );
}

/**
 * Defensively coerces raw model output into extraction items — drops any
 * item missing a real fact statement or a recognized category rather than
 * passing through malformed/hallucinated shapes to persistence. Mirrors
 * lib/smart-uploads/openai-extractor.ts's normalizeKnowledgeExtraction().
 */
export function normalizeTestimonialExtraction(raw: Record<string, unknown>): TestimonialExtractionResult {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  const items: ExtractedTestimonialKnowledgeItem[] = rawItems
    .map((rawItem): ExtractedTestimonialKnowledgeItem | null => {
      if (typeof rawItem !== "object" || rawItem === null) return null;
      const item = rawItem as Record<string, unknown>;

      const fact = typeof item.fact === "string" ? item.fact.trim() : "";
      if (!fact || !isTestimonialCategory(item.category)) return null;

      return {
        category: item.category,
        fact: fact.slice(0, 400),
        sourceExcerpt: readNullableString(item.sourceExcerpt)?.slice(0, 400) ?? null,
        confidence: isConfidenceLevel(item.confidence) ? item.confidence : TestimonialKnowledgeConfidenceLevels.MEDIUM,
      };
    })
    .filter((item): item is ExtractedTestimonialKnowledgeItem => item !== null)
    .slice(0, 20);

  return { items };
}

function buildExtractionPrompt(quote: string): string {
  return [
    "Extract reusable business knowledge from the customer testimonial below.",
    "Do NOT summarize the testimonial. Extract discrete, reusable facts a marketing team",
    "could reuse across content, recommendations, and customer communication.",
    "",
    "Rules:",
    "- Only extract facts actually stated or clearly implied in the testimonial text.",
    "- Never invent claims, outcomes, or details not present in the text.",
    "- Never invent or alter a quote — sourceExcerpt must be an exact, verbatim substring of the testimonial below, or null.",
    "- Each item must be one specific, reusable fact — not a paragraph summary.",
    "- confidence should be \"high\" for explicit statements, \"medium\" for reasonable inferences, \"low\" for weak or ambiguous signals.",
    "- Categories to consider (use only when supported by the text):",
    "  customer_benefit (a concrete benefit the customer received),",
    "  business_strength (a strength of the business the customer praises),",
    "  recurring_outcome (a result/outcome that sounds like it happens consistently),",
    "  objection_overcome (a hesitation or doubt the customer had that was resolved),",
    "  industry_terminology (domain-specific vocabulary the customer used naturally),",
    "  emotional_language (language expressing how the customer felt, in their own words),",
    "  trust_indicator (a signal that builds trust — credentials, reliability, safety, guarantees mentioned),",
    "  differentiator (something that sets this business apart from alternatives),",
    "  customer_segment (who this customer is — their situation, role, or type of need).",
    "- It is fine to return zero items for a category the testimonial doesn't cover.",
    "",
    "Testimonial text:",
    truncateText(quote),
  ].join("\n");
}

export class OpenAITestimonialExtractor {
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey?.trim()) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.client = new OpenAI({ apiKey });
  }

  async extract(quote: string): Promise<TestimonialExtractionResult> {
    const prompt = buildExtractionPrompt(quote);

    let response: OpenAI.Responses.Response;

    try {
      response = await this.client.responses.create({
        model: OPENAI_TESTIMONIAL_EXTRACTION_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are a meticulous business analyst extracting reusable marketing knowledge from a customer's own testimonials for AJN Marketing. Extract only facts supported by the provided text — never fabricate a claim or a quote.",
          },
          { role: "user", content: prompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "testimonial_knowledge_extraction",
            schema: TESTIMONIAL_EXTRACTION_JSON_SCHEMA,
            strict: true,
          },
        },
      });
    } catch (error) {
      console.error("[Testimonials] OpenAI extraction failed:", formatTestimonialOpenAiError(error));
      throw new Error(formatTestimonialOpenAiError(error));
    }

    const outputText = response.output_text?.trim();
    if (!outputText) {
      console.error("[Testimonials] OpenAI extraction failed: empty response");
      throw new Error("OpenAI returned an empty extraction response");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(outputText) as Record<string, unknown>;
    } catch {
      console.error("[Testimonials] OpenAI extraction failed: invalid JSON response");
      throw new Error("OpenAI returned invalid JSON for testimonial extraction");
    }

    return normalizeTestimonialExtraction(parsed);
  }
}

export function formatTestimonialOpenAiError(error: unknown): string {
  const fallback = "Testimonial extraction is temporarily unavailable. Please try again later.";

  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return fallback;
    if (error.status === 429) return "Testimonial extraction is busy right now. Try again shortly.";
    if (error.status === 503) return fallback;
    return toSafeUserErrorMessage(error, fallback);
  }

  return toSafeUserErrorMessage(error, fallback);
}

export function isTestimonialOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
