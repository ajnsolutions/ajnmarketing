/**
 * Business Discovery collectors — pure functions that turn one already-fetched
 * existing source into BusinessDiscoveryObservation[]. No I/O here (see
 * gather.ts for fetching); this file only reshapes data that already exists.
 *
 * Extensibility rule: to add a new source, write one new `collectXObservations`
 * function and add it to `collectBusinessDiscoveryObservations`'s list at the
 * bottom. Existing collectors, UnifiedBusinessProfile, and BusinessDiscoveryResult
 * never need to change shape for that addition — this is what
 * docs/project-magic/CONNECTOR_FRAMEWORK.md means by "designed for unlimited
 * expansion."
 */

import { DiscoverySourceTypes, type BusinessDiscoveryObservation, type BusinessDiscoverySources } from "@/lib/business-discovery/types";

/** Splits a freeform, owner-entered field on common delimiters. Never substitutes a fallback list — an empty result here must read as Missing, not as a guessed default. */
function parseDelimitedList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function observation(
  source: BusinessDiscoveryObservation["source"],
  field: string,
  value: unknown,
  isVerifiedFact: boolean,
  evidenceDetail: string,
  collectedAt: string
): BusinessDiscoveryObservation {
  return { source, field, value, isVerifiedFact, evidenceDetail, collectedAt };
}

export function collectBusinessProfileObservations(
  businessProfile: BusinessDiscoverySources["businessProfile"]
): BusinessDiscoveryObservation[] {
  if (!businessProfile) return [];
  const source = DiscoverySourceTypes.BUSINESS_PROFILE;
  const at = businessProfile.updated_at;
  const observations: BusinessDiscoveryObservation[] = [];

  if (businessProfile.business_name?.trim()) {
    observations.push(observation(source, "businessName", businessProfile.business_name, true, "entered on your business profile", at));
  }
  if (businessProfile.industry?.trim()) {
    observations.push(observation(source, "industry", businessProfile.industry, true, "entered on your business profile", at));
  }
  if (businessProfile.website?.trim()) {
    observations.push(observation(source, "website", businessProfile.website, true, "entered on your business profile", at));
  }

  const primaryServices = parseDelimitedList(businessProfile.primary_services);
  if (primaryServices.length > 0) {
    observations.push(observation(source, "primaryServices", primaryServices, true, "services you listed on your business profile", at));
  }

  const serviceAreas = [
    ...parseDelimitedList(businessProfile.primary_service_area),
    ...parseDelimitedList(businessProfile.nearby_cities),
  ];
  if (serviceAreas.length > 0) {
    observations.push(observation(source, "serviceAreas", serviceAreas, true, "service areas you listed on your business profile", at));
  }

  if (businessProfile.brand_voice_tone?.trim()) {
    observations.push(observation(source, "tone", businessProfile.brand_voice_tone, true, "the tone you set for your brand voice", at));
  }

  const competitors = parseDelimitedList(businessProfile.competitors);
  if (competitors.length > 0) {
    observations.push(observation(source, "competitors", competitors, true, "competitors you listed on your business profile", at));
  }

  return observations;
}

export function collectWebsiteAnalysisObservations(
  websiteAnalysis: BusinessDiscoverySources["websiteAnalysis"]
): BusinessDiscoveryObservation[] {
  if (!websiteAnalysis || websiteAnalysis.analysis_status !== "completed") return [];
  const source = DiscoverySourceTypes.AI_WEBSITE_ANALYSIS;
  const at = websiteAnalysis.updated_at;
  const raw = websiteAnalysis.raw_summary;
  const observations: BusinessDiscoveryObservation[] = [
    observation(source, "websiteAnalyzed", true, true, "your website has a completed AI analysis", at),
  ];

  if (raw?.executiveSummary?.trim()) {
    observations.push(observation(source, "businessSummary", raw.executiveSummary, false, "the executive summary from your website analysis", at));
  }
  if (raw?.businessName?.trim()) {
    observations.push(observation(source, "businessName", raw.businessName, false, "read from your website", at));
  }
  if (raw?.industry?.trim()) {
    observations.push(observation(source, "industry", raw.industry, false, "inferred from your website content", at));
  }

  const services = [...(raw?.primaryServices ?? []), ...(raw?.secondaryServices ?? [])];
  if (services.length > 0) {
    observations.push(observation(source, "primaryServices", services, false, "services mentioned on your website", at));
  }

  const serviceAreas = [...(raw?.serviceAreas ?? []), ...(raw?.citiesMentioned ?? [])];
  if (serviceAreas.length > 0) {
    observations.push(observation(source, "serviceAreas", serviceAreas, false, "locations mentioned on your website", at));
  }

  const tone = websiteAnalysis.tone ?? raw?.tone;
  if (tone?.trim()) {
    observations.push(observation(source, "tone", tone, false, "the tone of your website's writing", at));
  }

  if (raw?.customerPersona?.trim()) {
    observations.push(observation(source, "targetAudience", raw.customerPersona, false, "who your website's language is written for", at));
  }

  if (raw?.strengths?.length) {
    observations.push(observation(source, "strengths", raw.strengths, false, "strengths identified in your website analysis", at));
  }

  const opportunities = [
    ...(raw?.highestRoiImprovements ?? []),
    ...(raw?.contentOpportunities?.map((item) => item.title) ?? []),
  ];
  if (opportunities.length > 0) {
    observations.push(observation(source, "growthOpportunities", opportunities, false, "opportunities identified in your website analysis", at));
  }

  return observations;
}

export function collectAiMarketingProfileObservations(
  aiMarketingProfile: BusinessDiscoverySources["aiMarketingProfile"]
): BusinessDiscoveryObservation[] {
  if (!aiMarketingProfile || aiMarketingProfile.profile_status !== "active") return [];
  const source = DiscoverySourceTypes.AI_MARKETING_PROFILE;
  const at = aiMarketingProfile.updated_at;
  const observations: BusinessDiscoveryObservation[] = [];

  if (aiMarketingProfile.business_summary?.trim()) {
    observations.push(observation(source, "businessSummary", aiMarketingProfile.business_summary, false, "your AI Marketing Profile's business summary", at));
  }

  const targetAudience = aiMarketingProfile.target_audience ?? aiMarketingProfile.ideal_customer;
  if (targetAudience?.trim()) {
    observations.push(observation(source, "targetAudience", targetAudience, false, "your AI Marketing Profile's audience description", at));
  }

  if (aiMarketingProfile.services?.length) {
    observations.push(observation(source, "primaryServices", aiMarketingProfile.services, false, "services in your AI Marketing Profile", at));
  }
  if (aiMarketingProfile.service_areas?.length) {
    observations.push(observation(source, "serviceAreas", aiMarketingProfile.service_areas, false, "service areas in your AI Marketing Profile", at));
  }
  if (aiMarketingProfile.tone?.trim()) {
    observations.push(observation(source, "tone", aiMarketingProfile.tone, false, "the tone set in your AI Marketing Profile", at));
  }
  if (aiMarketingProfile.brand_personality?.length) {
    observations.push(observation(source, "brandPersonality", aiMarketingProfile.brand_personality, false, "brand personality traits in your AI Marketing Profile", at));
  }
  if (aiMarketingProfile.competitors?.length) {
    observations.push(observation(source, "competitors", aiMarketingProfile.competitors, false, "competitors noted in your AI Marketing Profile", at));
  }
  if (aiMarketingProfile.seasonal_opportunities?.length) {
    observations.push(observation(source, "growthOpportunities", aiMarketingProfile.seasonal_opportunities, false, "seasonal opportunities in your AI Marketing Profile", at));
  }

  return observations;
}

export function collectGoogleBusinessProfileObservations(
  connection: BusinessDiscoverySources["googleBusinessConnection"]
): BusinessDiscoveryObservation[] {
  if (!connection) return [];
  const now = new Date().toISOString();
  return [
    observation(
      DiscoverySourceTypes.GOOGLE_BUSINESS_PROFILE,
      "googleBusinessProfileConnected",
      connection.connected,
      true,
      connection.connected ? "your Google Business Profile is connected" : "no Google Business Profile is connected",
      now
    ),
  ];
}

export function collectPublicReviewObservations(
  reviews: BusinessDiscoverySources["publicReviews"]
): BusinessDiscoveryObservation[] {
  if (!reviews || reviews.length === 0) return [];
  const ratedReviews = reviews.filter((review) => typeof review.rating === "number");
  if (ratedReviews.length === 0) return [];

  const averageRating =
    ratedReviews.reduce((sum, review) => sum + review.rating, 0) / ratedReviews.length;
  const mostRecent = reviews.reduce<string | null>((latest, review) => {
    if (!review.review_created_at) return latest;
    if (!latest || review.review_created_at > latest) return review.review_created_at;
    return latest;
  }, null);

  return [
    observation(
      DiscoverySourceTypes.PUBLIC_REVIEWS,
      "reviewSummary",
      { reviewCount: ratedReviews.length, averageRating: Math.round(averageRating * 10) / 10 },
      true,
      `${ratedReviews.length} public review${ratedReviews.length === 1 ? "" : "s"} averaging ${Math.round(averageRating * 10) / 10} stars`,
      mostRecent ?? new Date().toISOString()
    ),
  ];
}

export function collectMarketContextObservations(
  marketContext: BusinessDiscoverySources["marketContext"]
): BusinessDiscoveryObservation[] {
  if (!marketContext) return [];
  const competitorItems = marketContext.items.filter((item) => item.category === "competitor");
  if (competitorItems.length === 0) return [];

  const at = marketContext.brief.updated_at;
  const competitorNames = competitorItems.map((item) => item.title);
  return [
    observation(
      DiscoverySourceTypes.MARKET_CONTEXT,
      "competitors",
      competitorNames,
      false,
      `${competitorItems.length} competitor signal${competitorItems.length === 1 ? "" : "s"} tracked in Market Context`,
      at
    ),
  ];
}

/**
 * Collects observations from every source that currently exists. Sources with
 * no collector yet (SOCIAL_PRESENCE, FUTURE_CONNECTOR, SMART_UPLOAD) are
 * intentionally absent from this list — they contribute nothing today, which
 * downstream normalize.ts/buildResult.ts must read as Missing, never guessed.
 * Adding a real collector for one of them later is additive only.
 */
export function collectBusinessDiscoveryObservations(
  sources: BusinessDiscoverySources
): BusinessDiscoveryObservation[] {
  return [
    ...collectBusinessProfileObservations(sources.businessProfile),
    ...collectWebsiteAnalysisObservations(sources.websiteAnalysis),
    ...collectAiMarketingProfileObservations(sources.aiMarketingProfile),
    ...collectGoogleBusinessProfileObservations(sources.googleBusinessConnection),
    ...collectPublicReviewObservations(sources.publicReviews),
    ...collectMarketContextObservations(sources.marketContext),
  ];
}
