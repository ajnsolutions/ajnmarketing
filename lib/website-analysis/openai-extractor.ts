import "server-only";

import OpenAI from "openai";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";
import type { WebsiteExtractor, WebsiteExtractionResult } from "@/lib/website-analysis/types";
import { normalizeCustomerPersona } from "@/lib/website-analysis/customer-persona";
import {
  inferContentOpportunitiesFromSource,
  normalizeContentOpportunities,
  readContentOpportunities,
} from "@/lib/website-analysis/content-opportunities";

/** Update this constant to change the OpenAI model used for website analysis. */
export const OPENAI_WEBSITE_ANALYSIS_MODEL = "gpt-4.1-mini";

const WEBSITE_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessName",
    "industry",
    "primaryServices",
    "secondaryServices",
    "serviceAreas",
    "citiesMentioned",
    "phoneNumbers",
    "emailAddresses",
    "businessHours",
    "callsToAction",
    "keywords",
    "brandVoice",
    "readingLevel",
    "tone",
    "customerPersona",
    "valueProposition",
    "metaTitle",
    "metaDescription",
    "h1Headings",
    "seoIssues",
    "internalLinks",
    "pageCountEstimate",
    "strengths",
    "weaknesses",
    "highestRoiImprovements",
    "nextRecommendedActions",
    "executiveSummary",
    "contentOpportunities",
  ],
  properties: {
    businessName: { type: "string" },
    industry: { type: "string" },
    primaryServices: { type: "array", items: { type: "string" } },
    secondaryServices: { type: "array", items: { type: "string" } },
    serviceAreas: { type: "array", items: { type: "string" } },
    citiesMentioned: { type: "array", items: { type: "string" } },
    phoneNumbers: { type: "array", items: { type: "string" } },
    emailAddresses: { type: "array", items: { type: "string" } },
    businessHours: { type: "array", items: { type: "string" } },
    callsToAction: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    brandVoice: { type: "string" },
    readingLevel: { type: "string" },
    tone: { type: "string" },
    customerPersona: { type: "string" },
    valueProposition: { type: "string" },
    metaTitle: { type: ["string", "null"] },
    metaDescription: { type: ["string", "null"] },
    h1Headings: { type: "array", items: { type: "string" } },
    seoIssues: { type: "array", items: { type: "string" } },
    internalLinks: { type: "integer" },
    pageCountEstimate: { type: "integer" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    highestRoiImprovements: { type: "array", items: { type: "string" } },
    nextRecommendedActions: { type: "string" },
    executiveSummary: { type: "string" },
    contentOpportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "seoScore", "competition"],
        properties: {
          title: { type: "string" },
          seoScore: { type: "integer" },
          competition: { type: "string", enum: ["Low", "Medium", "High"] },
        },
      },
    },
  },
} as const;

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = readString(value);
  return trimmed || null;
}

function readInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function truncateText(text: string, maxLength = 14000): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Content truncated for analysis]`;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function extractMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function extractHeadings(html: string, tag: "h1" | "h2"): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "gi");
  return [...html.matchAll(pattern)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 12);
}

function countInternalLinks(html: string, host: string): number {
  let count = 0;

  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (href.startsWith("/") || href.includes(host)) count += 1;
  }

  return count;
}

function buildProfileHints(profile: Parameters<WebsiteExtractor["extract"]>[0]["profile"]): string {
  const hints = [
    profile.business_name ? `Business name hint: ${profile.business_name}` : null,
    profile.industry ? `Industry hint: ${profile.industry}` : null,
    profile.city ? `City hint: ${profile.city}` : null,
    profile.state ? `State hint: ${profile.state}` : null,
    profile.primary_service_area ? `Service area hint: ${profile.primary_service_area}` : null,
    profile.primary_services ? `Services hint: ${profile.primary_services}` : null,
  ].filter(Boolean);

  return hints.length > 0
    ? hints.join("\n")
    : "No onboarding hints available. Rely on website content only.";
}

function normalizeExtraction(
  raw: Record<string, unknown>,
  input: Parameters<WebsiteExtractor["extract"]>[0]
): WebsiteExtractionResult {
  const extraction: WebsiteExtractionResult = {
    businessName: readString(raw.businessName, "Unknown Business"),
    industry: readString(raw.industry, "Local Service Business"),
    primaryServices: uniqueStrings(raw.primaryServices),
    secondaryServices: uniqueStrings(raw.secondaryServices),
    serviceAreas: uniqueStrings(raw.serviceAreas),
    citiesMentioned: uniqueStrings(raw.citiesMentioned),
    phoneNumbers: uniqueStrings(raw.phoneNumbers),
    emailAddresses: uniqueStrings(raw.emailAddresses),
    businessHours: uniqueStrings(raw.businessHours),
    callsToAction: uniqueStrings(raw.callsToAction),
    keywords: uniqueStrings(raw.keywords).slice(0, 20),
    brandVoice: readString(
      raw.brandVoice,
      "Professional, clear, and customer-focused communication."
    ),
    readingLevel: readString(raw.readingLevel, "Clear and accessible"),
    tone: readString(raw.tone, "Professional and helpful"),
    customerPersona: normalizeCustomerPersona(readString(raw.customerPersona), input),
    valueProposition: readString(raw.valueProposition, "Trusted local service provider"),
    metaTitle: readNullableString(raw.metaTitle),
    metaDescription: readNullableString(raw.metaDescription),
    h1Headings: uniqueStrings(raw.h1Headings),
    seoIssues: uniqueStrings(raw.seoIssues),
    internalLinks: readInteger(raw.internalLinks),
    pageCountEstimate: Math.max(1, readInteger(raw.pageCountEstimate, 1)),
    strengths: uniqueStrings(raw.strengths),
    weaknesses: uniqueStrings(raw.weaknesses),
    highestRoiImprovements: uniqueStrings(raw.highestRoiImprovements),
    nextRecommendedActions: readString(
      raw.nextRecommendedActions,
      "Review extracted insights and approve AI-generated content aligned with top services."
    ),
    executiveSummary: readString(
      raw.executiveSummary,
      "Website analysis completed from available page content."
    ),
    contentOpportunities: [],
  };

  extraction.contentOpportunities = normalizeContentOpportunities(
    readContentOpportunities(raw.contentOpportunities),
    input,
    extraction
  );

  return extraction;
}

function buildAnalysisPrompt(input: Parameters<WebsiteExtractor["extract"]>[0]): string {
  const host = (() => {
    try {
      return new URL(input.website.finalUrl).hostname;
    } catch {
      return input.website.finalUrl;
    }
  })();

  const htmlSignals = {
    title: extractTitle(input.website.html),
    metaDescription: extractMetaDescription(input.website.html),
    h1Headings: extractHeadings(input.website.html, "h1"),
    h2Headings: extractHeadings(input.website.html, "h2"),
    internalLinks: countInternalLinks(input.website.html, host),
  };

  return [
    "Analyze the business website content below and return structured marketing intelligence.",
    "",
    "Rules:",
    "- Base conclusions only on the website content and HTML signals provided.",
    "- Do not invent services, industries, personas, or locations that are not supported by the text.",
    "- Avoid generic assumptions such as plumbing, homeowners, property managers, local service customers, or emergency services unless clearly present.",
    "- customerPersona must describe the audience explicitly mentioned or clearly implied by the website content and onboarding profile only.",
    "- Do NOT assume homeowners, property managers, plumbers, residential customers, or local homeowners unless those terms appear in the source data.",
    "- For B2B, benefits, healthcare, Section 125, HR, or employer-focused websites, prefer personas such as employers, employees, business owners, HR decision-makers, benefits administrators, or organizations seeking employee savings or benefit solutions.",
    "- If the target audience is unclear, set customerPersona to exactly: Business decision-makers and customers described on the website",
    "- contentOpportunities must contain 3-4 article title ideas aligned with the website audience, services, keywords, industry, and customerPersona.",
    "- Do NOT use generic templates such as '[service] Guide for Local Homeowners' or assume homeowners, property managers, local service customers, or home service audiences unless explicitly supported by the source data.",
    "- For B2B, Section 125, employee benefits, HR, or employer-focused websites, use titles aimed at employers, employees, business owners, HR decision-makers, or benefits administrators.",
    "- If audience-specific titles are unclear, use neutral patterns such as 'A Practical Guide to [topic]', 'What Customers Should Know About [topic]', or 'How [business type] Helps [target audience]'.",
    "- Use onboarding hints only to disambiguate when the website is unclear.",
    "- Prefer exact business names, services, cities, and CTAs found on the site.",
    "- Estimate internalLinks and pageCountEstimate from the HTML signals when possible.",
    "",
    `Website URL: ${input.website.finalUrl}`,
    "",
    "HTML signals:",
    JSON.stringify(htmlSignals, null, 2),
    "",
    "Onboarding hints (secondary only):",
    buildProfileHints(input.profile),
    "",
    "Cleaned website text:",
    truncateText(input.website.textContent || "No readable text was extracted from the website."),
  ].join("\n");
}

export class OpenAIWebsiteExtractor implements WebsiteExtractor {
  private client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey?.trim()) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.client = new OpenAI({ apiKey });
  }

  async extract(input: Parameters<WebsiteExtractor["extract"]>[0]): Promise<WebsiteExtractionResult> {
    const prompt = buildAnalysisPrompt(input);

    let response: OpenAI.Responses.Response;

    try {
      response = await this.client.responses.create({
        model: OPENAI_WEBSITE_ANALYSIS_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are an expert local business marketing analyst. Extract accurate website intelligence for AJN Marketing. Return only facts supported by the provided website content.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "website_extraction",
            schema: WEBSITE_EXTRACTION_JSON_SCHEMA,
            strict: true,
          },
        },
      });
    } catch (error) {
      console.error("[WebsiteAnalysis] OpenAI extraction failed:", formatOpenAiError(error));
      throw new Error(formatOpenAiError(error));
    }

    const outputText = response.output_text?.trim();
    if (!outputText) {
      console.error("[WebsiteAnalysis] OpenAI extraction failed: empty response");
      throw new Error("OpenAI returned an empty analysis response");
    }

    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(outputText) as Record<string, unknown>;
    } catch {
      console.error("[WebsiteAnalysis] OpenAI extraction failed: invalid JSON response");
      throw new Error("OpenAI returned invalid JSON for website analysis");
    }

    const extraction = normalizeExtraction(parsed, input);

    if (!extraction.businessName || extraction.businessName === "Unknown Business") {
      if (input.profile.business_name) {
        extraction.businessName = input.profile.business_name;
      }
    }

    if (!extraction.metaTitle) {
      extraction.metaTitle = extractTitle(input.website.html);
    }

    if (!extraction.metaDescription) {
      extraction.metaDescription = extractMetaDescription(input.website.html);
    }

    if (extraction.h1Headings.length === 0) {
      extraction.h1Headings = extractHeadings(input.website.html, "h1");
    }

    if (extraction.internalLinks === 0 && input.website.html) {
      try {
        extraction.internalLinks = countInternalLinks(
          input.website.html,
          new URL(input.website.finalUrl).hostname
        );
      } catch {
        // Keep model estimate when host parsing fails.
      }
    }

    return extraction;
  }
}

export function formatOpenAiError(error: unknown): string {
  const fallback = "Website analysis is temporarily unavailable. Please try again later.";

  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return fallback;
    if (error.status === 429) return "Website analysis is busy right now. Try again shortly.";
    if (error.status === 503) return fallback;
    return toSafeUserErrorMessage(error, fallback);
  }

  return toSafeUserErrorMessage(error, fallback);
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
