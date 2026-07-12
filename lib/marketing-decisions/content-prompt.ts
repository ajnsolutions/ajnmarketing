import { buildBusinessIntel } from "@/lib/content-generator/prompt-builder";
import { formatAnalyticsFeedbackForPrompt } from "@/lib/analytics/feedbackLoop";
import { formatMarketContextPromptSummary } from "@/lib/market-context/prompt-context";
import type { ContentGenerationContext } from "@/lib/content-generator/types";
import type { MarketingOpportunity } from "@/lib/marketing-opportunities/types";
import type { MarketingRecommendation } from "@/lib/marketing-decisions/types";
import type { RecommendationContentTarget } from "@/lib/marketing-decisions/actionTypeContentMapping";

export type RecommendationContentRequest = {
  recommendation: MarketingRecommendation;
  opportunities: MarketingOpportunity[];
  target: RecommendationContentTarget;
};

export function buildRecommendationContentPrompt(
  context: ContentGenerationContext,
  request: RecommendationContentRequest
): { system: string; user: string } {
  const intel = buildBusinessIntel(context);
  const marketContextBlock = formatMarketContextPromptSummary(context.marketContextSummary);
  const analyticsFeedbackBlock = formatAnalyticsFeedbackForPrompt(context.analyticsFeedback);
  const { recommendation, opportunities, target } = request;

  const earliestExpiry = opportunities
    .map((o) => o.expires_at)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;

  const system = [
    "You are AJN Marketing's AI content engine.",
    "Generate one polished, approval-ready marketing draft grounded in the supplied recommendation, opportunity evidence, business intelligence, brand voice, and market context.",
    "Never invent services, audiences, cities, industries, or offers unless explicitly supported by the source data.",
    "Never use generic placeholder copy or template filler.",
    "Use the business brand voice exactly.",
    "Return structured JSON only.",
  ].join(" ");

  const user = [
    "BUSINESS INTELLIGENCE",
    JSON.stringify(
      {
        businessName: intel.businessName,
        industry: intel.industry,
        services: intel.services,
        serviceAreas: intel.serviceAreas,
        idealCustomer: intel.idealCustomer,
        targetAudience: intel.targetAudience,
        customerPersona: intel.customerPersona,
        brandPersonality: intel.brandPersonality,
        writingTone: intel.writingTone,
        brandVoice: intel.brandVoice,
        valueProposition: intel.valueProposition,
        keywords: intel.keywords,
        preferredCtas: intel.preferredCtas,
        commonObjections: intel.commonObjections,
        seoStrategy: intel.seoStrategy,
        contentStrategy: intel.contentStrategy,
        reviewStrategy: intel.reviewStrategy,
        googleBusinessStrategy: intel.googleBusinessStrategy,
        websiteSummary: intel.websiteSummary,
        contentOpportunities: intel.contentOpportunities,
        marketingGoals: intel.marketingGoals,
        avoidWords: intel.avoidWords,
      },
      null,
      2
    ),
    "",
    ...(marketContextBlock ? ["MARKET CONTEXT", marketContextBlock, ""] : []),
    ...(analyticsFeedbackBlock ? ["ANALYTICS FEEDBACK", analyticsFeedbackBlock, ""] : []),
    "MARKETING RECOMMENDATION",
    JSON.stringify(
      {
        actionType: recommendation.recommended_action_type,
        reasoning: recommendation.reasoning,
        urgency: recommendation.urgency,
        businessImpact: recommendation.business_impact,
        estimatedEffort: recommendation.estimated_effort,
        confidence: recommendation.confidence,
        priorityScore: recommendation.priority_score,
        relatedOpportunityIds: recommendation.related_opportunity_ids,
      },
      null,
      2
    ),
    "",
    "RELATED OPPORTUNITIES AND EVIDENCE",
    JSON.stringify(
      opportunities.map((opportunity) => ({
        id: opportunity.id,
        category: opportunity.category,
        title: opportunity.title,
        description: opportunity.description,
        severity: opportunity.severity,
        confidence: opportunity.confidence,
        recommendedAction: opportunity.recommended_action,
        expiresAt: opportunity.expires_at,
        evidence: opportunity.evidence,
      })),
      null,
      2
    ),
    "",
    "DRAFT TARGET",
    JSON.stringify(
      {
        contentType: target.contentType,
        targetPlatform: target.targetPlatform,
        length: target.length,
        tone: target.tone,
        urgency: recommendation.urgency,
        expiration: earliestExpiry,
      },
      null,
      2
    ),
    "",
    "Generate exactly one polished draft with title, content, cta, hashtags, seoKeywords, qualityScore, voiceScore, and reasoning.",
    "The draft must clearly reflect the recommendation reasoning and supporting opportunity evidence — avoid generic marketing copy.",
  ].join("\n");

  return { system, user };
}
