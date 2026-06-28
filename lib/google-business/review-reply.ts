import "server-only";

import OpenAI from "openai";
import { buildBusinessIntel } from "@/lib/content-generator/prompt-builder";
import { loadContentGenerationContextForUser } from "@/lib/content-generator/service";
import { getCurrentPlanPeriod } from "@/lib/marketing-planner/planner";
import { getMarketingPlanForUserMonth } from "@/lib/marketing-planner/persistence";
import type { GoogleBusinessReview } from "@/lib/google-business/types";
import { createClient } from "@/lib/supabase/server";

/** Update this constant to change the OpenAI model used for Google review reply drafts. */
export const OPENAI_GBP_REVIEW_REPLY_MODEL = "gpt-4.1-mini";

const REVIEW_REPLY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply"],
  properties: {
    reply: { type: "string" },
  },
} as const;

export async function generateGoogleReviewReplyDraft(input: {
  userId: string;
  review: GoogleBusinessReview;
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("Review reply drafting requires OPENAI_API_KEY.");
  }

  const generationContext = await loadContentGenerationContextForUser(input.userId);
  if (!generationContext) {
    throw new Error("Business profile not found.");
  }

  const supabase = await createClient();
  const period = getCurrentPlanPeriod();
  const marketingPlan = await getMarketingPlanForUserMonth(
    supabase,
    input.userId,
    period.month,
    period.year
  );

  const businessIntel = buildBusinessIntel(generationContext);
  const { businessProfile, websiteAnalysis, aiMarketingProfile } = generationContext;
  const planJson =
    marketingPlan?.status === "active" ? marketingPlan.plan_json : null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = [
    "You draft professional Google Business Profile review replies.",
    "Use the supplied business profile, website analysis, brand voice, AI marketing profile, and marketing plan only.",
    "Never invent services, locations, or promises not supported by the source data.",
    "Never auto-post or imply the reply was already published.",
    "Keep replies concise, warm, and professional.",
    "Return structured JSON only.",
  ].join(" ");

  const user = [
    "BUSINESS PROFILE",
    JSON.stringify(
      {
        businessName: businessProfile.business_name,
        industry: businessProfile.industry,
        marketingGoals: businessProfile.marketing_goals,
        primaryServices: businessProfile.primary_services,
        city: businessProfile.city,
        state: businessProfile.state,
        brandVoiceTone: businessProfile.brand_voice_tone,
      },
      null,
      2
    ),
    "",
    "WEBSITE ANALYSIS",
    JSON.stringify(
      websiteAnalysis
        ? {
            brandVoice: websiteAnalysis.brand_voice,
            tone: websiteAnalysis.tone,
            keywords: websiteAnalysis.keywords,
            rawSummary: websiteAnalysis.raw_summary,
          }
        : null,
      null,
      2
    ),
    "",
    "AI MARKETING PROFILE",
    JSON.stringify(
      aiMarketingProfile
        ? {
            businessSummary: aiMarketingProfile.business_summary,
            marketingStrategy: aiMarketingProfile.marketing_strategy,
            contentStrategy: aiMarketingProfile.content_strategy,
            tone: aiMarketingProfile.tone,
          }
        : null,
      null,
      2
    ),
    "",
    "MARKETING PLAN",
    JSON.stringify(
      planJson
        ? {
            month: period.monthName,
            executiveSummary: planJson.executiveSummary,
            marketingThemes: planJson.marketingThemes,
          }
        : null,
      null,
      2
    ),
    "",
    "BRAND INTELLIGENCE",
    JSON.stringify(
      {
        businessName: businessIntel.businessName,
        industry: businessIntel.industry,
        brandVoice: businessIntel.brandVoice,
        brandPersonality: businessIntel.brandPersonality,
        valueProposition: businessIntel.valueProposition,
        marketingGoals: businessIntel.marketingGoals,
      },
      null,
      2
    ),
    "",
    "REVIEW",
    JSON.stringify(
      {
        reviewerName: input.review.reviewer_name,
        rating: input.review.rating,
        comment: input.review.comment,
      },
      null,
      2
    ),
    "",
    "Draft a reply the business owner can review in Approval Center and manually post on Google.",
  ].join("\n");

  const response = await client.responses.create({
    model: OPENAI_GBP_REVIEW_REPLY_MODEL,
    temperature: 0.7,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "google_review_reply",
        schema: REVIEW_REPLY_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("OpenAI returned an empty review reply draft.");
  }

  const parsed = JSON.parse(outputText) as { reply?: string };
  const reply = parsed.reply?.trim();

  if (!reply) {
    throw new Error("OpenAI returned an invalid review reply draft.");
  }

  return reply;
}
