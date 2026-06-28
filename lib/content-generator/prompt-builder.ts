import { resolveContentOpportunities } from "@/lib/website-analysis/content-opportunities";
import type {
  ContentGenerationBusinessIntel,
  ContentGenerationContext,
  ContentGenerationRequest,
} from "@/lib/content-generator/types";

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function splitList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return uniqueStrings(raw.split(/[\n,;|•]/));
}

export function buildBusinessIntel(context: ContentGenerationContext): ContentGenerationBusinessIntel {
  const { businessProfile, aiMarketingProfile, websiteAnalysis } = context;
  const summary = websiteAnalysis?.raw_summary;

  const services = uniqueStrings([
    ...(aiMarketingProfile?.services ?? []),
    ...(summary?.primaryServices ?? []),
    ...(summary?.secondaryServices ?? []),
    ...(websiteAnalysis?.services?.map((item) => item.name) ?? []),
    ...splitList(businessProfile.primary_services),
    ...splitList(businessProfile.emergency_services),
    ...splitList(businessProfile.seasonal_services),
    ...splitList(businessProfile.specialty_services),
  ]);

  const serviceAreas = uniqueStrings([
    ...(aiMarketingProfile?.service_areas ?? []),
    ...(summary?.serviceAreas ?? []),
    ...(summary?.citiesMentioned ?? []),
    ...(websiteAnalysis?.cities ?? []),
    businessProfile.primary_service_area,
    businessProfile.city,
    businessProfile.state,
    ...splitList(businessProfile.nearby_cities),
  ]);

  const keywords = uniqueStrings([
    ...(aiMarketingProfile?.keywords ?? []),
    ...(websiteAnalysis?.keywords ?? []),
    ...(summary?.keywords ?? []),
    ...splitList(businessProfile.preferred_words?.replace(/,/g, "\n")),
  ]);

  const contentOpportunities = summary
    ? resolveContentOpportunities(summary).map((item) => item.title)
    : [];

  return {
    businessName:
      summary?.businessName ??
      businessProfile.business_name ??
      "Business",
    industry:
      aiMarketingProfile?.industry ??
      summary?.industry ??
      businessProfile.industry ??
      "Not specified",
    services,
    serviceAreas,
    idealCustomer:
      aiMarketingProfile?.ideal_customer ??
      summary?.customerPersona ??
      "Customers described in the business profile",
    targetAudience:
      aiMarketingProfile?.target_audience ??
      summary?.customerPersona ??
      "Target audience from business profile",
    brandPersonality: uniqueStrings([
      ...(aiMarketingProfile?.brand_personality ?? []),
      aiMarketingProfile?.tone,
      summary?.tone,
      businessProfile.brand_voice_tone,
    ]),
    writingTone:
      aiMarketingProfile?.tone ??
      websiteAnalysis?.tone ??
      summary?.tone ??
      businessProfile.brand_voice_tone ??
      "Professional and helpful",
    brandVoice:
      aiMarketingProfile?.brand_voice ??
      websiteAnalysis?.brand_voice ??
      summary?.brandVoice ??
      businessProfile.voice_notes ??
      "Clear, trustworthy, and customer-focused",
    valueProposition:
      aiMarketingProfile?.value_proposition ??
      summary?.valueProposition ??
      "Value proposition from business profile",
    keywords,
    preferredCtas: uniqueStrings([
      ...(aiMarketingProfile?.recommended_ctas ?? []),
      ...(summary?.callsToAction ?? []),
    ]),
    commonObjections: aiMarketingProfile?.common_objections ?? [],
    seoStrategy: aiMarketingProfile?.seo_strategy ?? "Use supported keywords and audience terms only.",
    contentStrategy: aiMarketingProfile?.content_strategy ?? "Create useful, audience-specific content.",
    reviewStrategy: aiMarketingProfile?.review_strategy ?? "Respond authentically in brand voice.",
    websiteSummary:
      aiMarketingProfile?.business_summary ??
      summary?.executiveSummary ??
      "No website summary available yet.",
    contentOpportunities,
    customerPersona: summary?.customerPersona ?? aiMarketingProfile?.target_audience ?? "",
    googleBusinessStrategy:
      aiMarketingProfile?.google_business_strategy ?? "Not available",
    avoidWords: splitList(businessProfile.avoid_words?.replace(/,/g, "\n")),
    marketingGoals: businessProfile.marketing_goals ?? [],
  };
}

export function buildContentGenerationPrompt(
  context: ContentGenerationContext,
  request: ContentGenerationRequest
): { system: string; user: string } {
  const intel = buildBusinessIntel(context);

  const system = [
    "You are AJN Marketing's AI content engine.",
    "Generate marketing content that is unique to the customer's business using ONLY the supplied business intelligence.",
    "Never invent services, audiences, cities, industries, emergencies, repairs, homeowners, plumbing, HVAC, dental, or other details unless explicitly supported by the source data.",
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
    "CONTENT REQUEST",
    JSON.stringify(
      {
        contentType: request.contentType,
        topic: request.topic ?? intel.services[0] ?? "",
        targetArea: request.targetArea ?? intel.serviceAreas[0] ?? "",
        length: request.length,
        tone: request.tone,
        goals: request.goals ?? [],
        specialOffer: request.specialOffer ?? "",
        instructions: request.instructions ?? "",
        voice: "Use business brand voice exactly.",
      },
      null,
      2
    ),
    "",
    "Generate exactly 3 genuinely different variations:",
    "1. Educational",
    "2. Trust / Authority",
    "3. Promotion / Engagement",
    "",
    "Each variation must include title, content, cta, hashtags, seoKeywords, qualityScore, voiceScore, and reasoning.",
  ].join("\n");

  return { system, user };
}
