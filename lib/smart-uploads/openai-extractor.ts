import "server-only";

import OpenAI from "openai";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";
import {
  KnowledgeCategories,
  KnowledgeConfidenceLevels,
  type DocumentExtractionResult,
  type ExtractedKnowledgeItem,
  type KnowledgeCategory,
  type KnowledgeConfidenceLevel,
} from "@/lib/smart-uploads/types";

/** Update this constant to change the OpenAI model used for Smart Upload extraction. */
export const OPENAI_SMART_UPLOAD_EXTRACTION_MODEL = "gpt-4.1-mini";

const KNOWLEDGE_CATEGORY_VALUES = Object.values(KnowledgeCategories);

const KNOWLEDGE_EXTRACTION_JSON_SCHEMA = {
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
          category: { type: "string", enum: KNOWLEDGE_CATEGORY_VALUES },
          fact: { type: "string" },
          sourceExcerpt: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
} as const;

function truncateText(text: string, maxLength = 20000): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Content truncated for analysis]`;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function isKnowledgeCategory(value: unknown): value is KnowledgeCategory {
  return typeof value === "string" && (KNOWLEDGE_CATEGORY_VALUES as string[]).includes(value);
}

function isConfidenceLevel(value: unknown): value is KnowledgeConfidenceLevel {
  return value === KnowledgeConfidenceLevels.LOW || value === KnowledgeConfidenceLevels.MEDIUM || value === KnowledgeConfidenceLevels.HIGH;
}

/**
 * Defensively coerces raw model output into extraction items — drops any item
 * missing a real fact statement or a recognized category rather than passing
 * through malformed/hallucinated shapes to persistence.
 */
export function normalizeKnowledgeExtraction(raw: Record<string, unknown>): DocumentExtractionResult {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  const items: ExtractedKnowledgeItem[] = rawItems
    .map((rawItem): ExtractedKnowledgeItem | null => {
      if (typeof rawItem !== "object" || rawItem === null) return null;
      const item = rawItem as Record<string, unknown>;

      const fact = typeof item.fact === "string" ? item.fact.trim() : "";
      if (!fact || !isKnowledgeCategory(item.category)) return null;

      return {
        category: item.category,
        fact: fact.slice(0, 600),
        sourceExcerpt: readNullableString(item.sourceExcerpt)?.slice(0, 400) ?? null,
        confidence: isConfidenceLevel(item.confidence) ? item.confidence : KnowledgeConfidenceLevels.MEDIUM,
      };
    })
    .filter((item): item is ExtractedKnowledgeItem => item !== null)
    .slice(0, 100);

  return { items };
}

function buildExtractionPrompt(input: { fileName: string; documentText: string }): string {
  return [
    "Extract reusable business knowledge from the uploaded document below.",
    "Do NOT summarize the document. Extract discrete, reusable facts a marketing team",
    "could reuse across content, recommendations, and customer communication.",
    "",
    "Rules:",
    "- Only extract facts actually stated or clearly implied in the document text.",
    "- Never invent products, services, prices, locations, or claims not present in the text.",
    "- Each item must be one specific, reusable fact — not a paragraph summary.",
    "- sourceExcerpt should be the short exact quote (or close paraphrase) this fact came from, or null if there isn't one specific sentence.",
    "- confidence should be \"high\" for explicit statements, \"medium\" for reasonable inferences, \"low\" for weak or ambiguous signals.",
    "- Categories to consider (use only when supported by the text): product, service, pricing,",
    "  target_customer, geographic_market, unique_selling_point, competitive_advantage,",
    "  seasonal_offering, faq, terminology, guarantee, certification, industry_served,",
    "  call_to_action, brand_voice, important_date.",
    "- It is fine to return zero items for a category the document doesn't cover.",
    "",
    `Document: ${input.fileName}`,
    "",
    "Document text:",
    truncateText(input.documentText),
  ].join("\n");
}

export class OpenAIKnowledgeExtractor {
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey?.trim()) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.client = new OpenAI({ apiKey });
  }

  async extract(input: { fileName: string; documentText: string }): Promise<DocumentExtractionResult> {
    const prompt = buildExtractionPrompt(input);

    let response: OpenAI.Responses.Response;

    try {
      response = await this.client.responses.create({
        model: OPENAI_SMART_UPLOAD_EXTRACTION_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are a meticulous business analyst extracting reusable marketing knowledge from a customer's own documents for AJN Marketing. Extract only facts supported by the provided text — never fabricate.",
          },
          { role: "user", content: prompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "smart_upload_knowledge_extraction",
            schema: KNOWLEDGE_EXTRACTION_JSON_SCHEMA,
            strict: true,
          },
        },
      });
    } catch (error) {
      console.error("[SmartUploads] OpenAI extraction failed:", formatSmartUploadOpenAiError(error));
      throw new Error(formatSmartUploadOpenAiError(error));
    }

    const outputText = response.output_text?.trim();
    if (!outputText) {
      console.error("[SmartUploads] OpenAI extraction failed: empty response");
      throw new Error("OpenAI returned an empty extraction response");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(outputText) as Record<string, unknown>;
    } catch {
      console.error("[SmartUploads] OpenAI extraction failed: invalid JSON response");
      throw new Error("OpenAI returned invalid JSON for document extraction");
    }

    return normalizeKnowledgeExtraction(parsed);
  }
}

export function formatSmartUploadOpenAiError(error: unknown): string {
  const fallback = "Document extraction is temporarily unavailable. Please try again later.";

  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return fallback;
    if (error.status === 429) return "Document extraction is busy right now. Try again shortly.";
    if (error.status === 503) return fallback;
    return toSafeUserErrorMessage(error, fallback);
  }

  return toSafeUserErrorMessage(error, fallback);
}

export function isSmartUploadOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
