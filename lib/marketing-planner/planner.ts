import { buildBusinessIntel } from "@/lib/content-generator/prompt-builder";
import type { ContentGenerationContext } from "@/lib/content-generator/types";
import type { MarketingPlannerContext } from "@/lib/marketing-planner/types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getCurrentPlanPeriod(referenceDate = new Date()): {
  month: number;
  year: number;
  monthName: string;
  season: string;
} {
  const month = referenceDate.getMonth() + 1;
  const year = referenceDate.getFullYear();

  return {
    month,
    year,
    monthName: MONTH_NAMES[month - 1] ?? "Current Month",
    season: getSeasonForMonth(month),
  };
}

export function getSeasonForMonth(month: number): string {
  if ([12, 1, 2].includes(month)) return "Winter";
  if ([3, 4, 5].includes(month)) return "Spring";
  if ([6, 7, 8].includes(month)) return "Summer";
  return "Fall";
}

export function buildMarketingPlannerPrompt(context: MarketingPlannerContext): {
  system: string;
  user: string;
} {
  const generationContext: ContentGenerationContext = {
    businessProfile: context.businessProfile,
    aiMarketingProfile: context.aiMarketingProfile,
    websiteAnalysis: context.websiteAnalysis,
  };

  const intel = buildBusinessIntel(generationContext);

  const system = [
    "You are AJN Marketing's AI Marketing Planner.",
    "Create a practical monthly marketing strategy using ONLY the supplied business intelligence.",
    "Never invent services, audiences, cities, industries, emergencies, repairs, homeowners, plumbing, HVAC, dental, or other details unless explicitly supported by the source data.",
    "Never use generic placeholder marketing copy.",
    "Tailor the plan to the current month, season, and business goals.",
    "Return complete structured JSON only.",
  ].join(" ");

  const user = [
    "PLANNING PERIOD",
    JSON.stringify(
      {
        month: context.monthName,
        monthNumber: context.month,
        year: context.year,
        season: context.season,
      },
      null,
      2
    ),
    "",
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
        aiMarketingProfile: context.aiMarketingProfile
          ? {
              businessSummary: context.aiMarketingProfile.business_summary,
              marketingStrategy: context.aiMarketingProfile.marketing_strategy,
              contentStrategy: context.aiMarketingProfile.content_strategy,
              seoStrategy: context.aiMarketingProfile.seo_strategy,
              monthlyThemes: context.aiMarketingProfile.monthly_themes,
              quarterlyCampaigns: context.aiMarketingProfile.quarterly_campaigns,
              seasonalOpportunities: context.aiMarketingProfile.seasonal_opportunities,
            }
          : null,
      },
      null,
      2
    ),
    "",
    "Create a full monthly marketing plan with executive summary, goals, themes, weekly focus, a 30-day calendar, posting schedule, content mix, GBP cadence, blog ideas, email ideas, seasonal campaigns, promotions, video ideas, social platform recommendations, and KPIs.",
  ].join("\n");

  return { system, user };
}
