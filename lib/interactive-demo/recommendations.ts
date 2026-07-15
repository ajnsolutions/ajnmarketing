import { randomUUID } from "node:crypto";
import { buildMarketingRecommendationDrafts } from "@/lib/marketing-decisions/decisionEngine";
import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import {
  OpportunityCategories,
  OpportunitySeverities,
  OpportunityStatuses,
  type MarketingOpportunity,
  type OpportunityCategory,
} from "@/lib/marketing-opportunities/types";
import { getExpectedBenefit } from "@/lib/recommendation-presentation/expectedBenefit";
import { translateOpportunityCategoryReasons } from "@/lib/recommendation-presentation/reasonTranslation";
import type { DemoRecommendationCard } from "@/lib/interactive-demo/types";
import {
  DEMO_EPHEMERAL_PROFILE_ID,
  DEMO_EPHEMERAL_USER_ID,
} from "@/lib/interactive-demo/stubs";
import type { WebsiteExtractionResult } from "@/lib/website-analysis/types";

function makeOpportunity(partial: {
  category: OpportunityCategory;
  title: string;
  description: string;
  recommended_action: string;
  severity?: MarketingOpportunity["severity"];
  confidence?: number;
}): MarketingOpportunity {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    user_id: DEMO_EPHEMERAL_USER_ID,
    business_profile_id: DEMO_EPHEMERAL_PROFILE_ID,
    category: partial.category,
    severity: partial.severity ?? OpportunitySeverities.MEDIUM,
    confidence: partial.confidence ?? 72,
    title: partial.title,
    description: partial.description,
    evidence: { source: "interactive_demo_website_extraction" },
    recommended_action: partial.recommended_action,
    expires_at: null,
    status: OpportunityStatuses.OPEN,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Synthesize a small set of in-memory opportunities from live website extraction,
 * then reuse the real decision engine + PR #29 presentation helpers.
 * Does not invent GBP metrics we did not observe.
 */
export function buildDemoOpportunitiesFromExtraction(
  extraction: WebsiteExtractionResult,
): MarketingOpportunity[] {
  const opportunities: MarketingOpportunity[] = [];

  const infoGaps = [
    ...extraction.seoIssues.slice(0, 2),
    ...extraction.weaknesses.slice(0, 2),
  ].filter(Boolean);

  if (infoGaps.length > 0 || extraction.phoneNumbers.length === 0) {
    opportunities.push(
      makeOpportunity({
        category: OpportunityCategories.MISSING_BUSINESS_INFO,
        title: "Clarify key business details customers look for",
        description:
          infoGaps[0] ||
          "Your website could make contact details, services, or service areas easier to find.",
        recommended_action:
          "Update Google Business Profile and website contact/service details so customers can reach you quickly.",
        severity: OpportunitySeverities.HIGH,
        confidence: 78,
      }),
    );
  }

  if (
    extraction.highestRoiImprovements.some((item) =>
      /post|content|blog|publish|active/i.test(item),
    ) ||
    extraction.contentOpportunities.length > 0 ||
    extraction.weaknesses.some((item) => /content|post|blog/i.test(item))
  ) {
    opportunities.push(
      makeOpportunity({
        category: OpportunityCategories.MISSING_GBP_POSTS,
        title: "Stay visible with regular Google updates",
        description:
          extraction.contentOpportunities[0]?.title ||
          extraction.highestRoiImprovements.find((item) =>
            /post|content|blog/i.test(item),
          ) ||
          "Consistent local posts help nearby customers notice your business.",
        recommended_action:
          "Publish a Google Business Profile post highlighting a core service and a clear call to action.",
        severity: OpportunitySeverities.MEDIUM,
        confidence: 74,
      }),
    );
  }

  if (
    extraction.highestRoiImprovements.some((item) => /review/i.test(item)) ||
    extraction.weaknesses.some((item) => /review/i.test(item)) ||
    /review/i.test(extraction.nextRecommendedActions)
  ) {
    opportunities.push(
      makeOpportunity({
        category: OpportunityCategories.LOW_REVIEW_ACTIVITY,
        title: "Keep review momentum going",
        description:
          "Strong local businesses stay trustworthy by responding to reviews and encouraging happy customers to share feedback.",
        recommended_action:
          "Request recent customer reviews and reply promptly with on-brand responses.",
        severity: OpportunitySeverities.MEDIUM,
        confidence: 70,
      }),
    );
  }

  opportunities.push(
    makeOpportunity({
      category: OpportunityCategories.SEASONAL,
      title: "Use timely local messaging",
      description:
        `Highlight a timely ${extraction.industry || "local"} service that matches what customers need right now.`,
      recommended_action:
        "Create a seasonal or timely content piece tied to your top service and service area.",
      severity: OpportunitySeverities.LOW,
      confidence: 65,
    }),
  );

  if (
    extraction.highestRoiImprovements.some((item) =>
      /website|seo|page|meta/i.test(item),
    ) ||
    extraction.seoIssues.length > 0
  ) {
    opportunities.push(
      makeOpportunity({
        category: OpportunityCategories.STALE_WEBSITE_CONTENT,
        title: "Refresh website messaging for local searchers",
        description:
          extraction.seoIssues[0] ||
          extraction.highestRoiImprovements.find((item) =>
            /website|seo|page|meta/i.test(item),
          ) ||
          "Clearer website messaging helps customers understand what you offer.",
        recommended_action:
          "Refresh a key service page with clearer local language and a stronger call to action.",
        severity: OpportunitySeverities.MEDIUM,
        confidence: 68,
      }),
    );
  }

  return opportunities;
}

export function buildDemoRecommendations(
  extraction: WebsiteExtractionResult,
): DemoRecommendationCard[] {
  const opportunities = buildDemoOpportunitiesFromExtraction(extraction);
  const drafts = buildMarketingRecommendationDrafts(opportunities).slice(0, 3);

  return drafts.map((draft) => {
    const related = opportunities.filter((opportunity) =>
      draft.relatedOpportunityIds.includes(opportunity.id),
    );
    const categories = related.map((opportunity) => opportunity.category);
    const why = translateOpportunityCategoryReasons(categories).map(
      (reason) => reason.text,
    );
    const primary = related[0];

    return {
      kind: "recommendation" as const,
      title: formatRecommendedActionType(draft.recommendedActionType),
      why:
        why.length > 0
          ? why
          : [
              primary?.description ||
                "Based on what we noticed on your website, this is a strong first move.",
            ],
      expectedBenefit: getExpectedBenefit(draft.recommendedActionType),
      exampleAction:
        primary?.recommended_action ||
        "Take a focused marketing action this week and approve before anything publishes.",
      explanation: draft.reasoning,
      actionType: draft.recommendedActionType,
    };
  });
}
