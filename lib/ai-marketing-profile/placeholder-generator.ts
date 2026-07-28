import type {
  AiMarketingProfileGenerated,
  AiMarketingProfileGenerator,
  AiMarketingProfileSourceData,
} from "@/lib/ai-marketing-profile/types";
import { classifyIndustryFromText, GENERIC_INDUSTRY_FALLBACK, type IndustryCategoryId } from "@/lib/business-discovery/industryTaxonomy";
import { buildGrowthOpportunities } from "@/lib/business-discovery/growthOpportunityEngine";

function splitList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];

  return [...new Set(raw.split(/[\n,;|•]/).map((item) => item.trim()).filter(Boolean))];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildServices(source: AiMarketingProfileSourceData): string[] {
  const summary = source.websiteAnalysis?.raw_summary;
  const detected = source.websiteAnalysis?.services?.map((item) => item.name) ?? [];

  return uniqueStrings([
    ...splitList(source.businessProfile.primary_services),
    ...splitList(source.businessProfile.emergency_services),
    ...splitList(source.businessProfile.seasonal_services),
    ...splitList(source.businessProfile.specialty_services),
    ...(summary?.primaryServices ?? []),
    ...(summary?.secondaryServices ?? []),
    ...detected,
  ]).slice(0, 12);
}

function buildServiceAreas(source: AiMarketingProfileSourceData): string[] {
  const summary = source.websiteAnalysis?.raw_summary;

  return uniqueStrings([
    source.businessProfile.primary_service_area ?? "",
    source.businessProfile.city ?? "",
    source.businessProfile.state ?? "",
    ...splitList(source.businessProfile.nearby_cities),
    ...(summary?.serviceAreas ?? []),
    ...(summary?.citiesMentioned ?? []),
    ...(source.websiteAnalysis?.cities ?? []),
  ]).slice(0, 12);
}

function buildKeywords(source: AiMarketingProfileSourceData): string[] {
  const summary = source.websiteAnalysis?.raw_summary;

  return uniqueStrings([
    ...splitList(source.businessProfile.preferred_words?.replace(/,/g, "\n")),
    ...(source.websiteAnalysis?.keywords ?? []),
    ...(summary?.keywords ?? []),
  ]).slice(0, 16);
}

function buildCompetitors(source: AiMarketingProfileSourceData): string[] {
  return splitList(source.businessProfile.competitors).slice(0, 6);
}

function buildBusinessName(source: AiMarketingProfileSourceData): string {
  return (
    source.websiteAnalysis?.raw_summary?.businessName ??
    source.businessProfile.business_name ??
    "Your Business"
  );
}

/** Runs the shared industry classifier over whatever textual signal exists at this layer (no raw website text here — only already-extracted services/keywords/summary). */
function classifyIndustryFallback(source: AiMarketingProfileSourceData): ReturnType<typeof classifyIndustryFromText> {
  const summary = source.websiteAnalysis?.raw_summary;
  const textBlob = [
    summary?.industry,
    summary?.businessName,
    summary?.customerPersona,
    ...(summary?.primaryServices ?? []),
    ...(summary?.secondaryServices ?? []),
    ...(summary?.keywords ?? []),
    ...(source.websiteAnalysis?.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  return classifyIndustryFromText(textBlob);
}

function buildIndustry(source: AiMarketingProfileSourceData): string {
  const explicit = source.websiteAnalysis?.raw_summary?.industry ?? source.businessProfile.industry;
  if (explicit) return explicit;

  const classification = classifyIndustryFallback(source);
  return classification.label ?? GENERIC_INDUSTRY_FALLBACK;
}

function buildBrandVoice(source: AiMarketingProfileSourceData): string {
  return (
    source.websiteAnalysis?.brand_voice ??
    source.websiteAnalysis?.raw_summary?.brandVoice ??
    source.businessProfile.voice_notes ??
    `${buildBusinessName(source)} communicates in a clear, trustworthy, customer-focused voice.`
  );
}

function buildTone(source: AiMarketingProfileSourceData): string {
  return (
    source.websiteAnalysis?.tone ??
    source.websiteAnalysis?.raw_summary?.tone ??
    source.businessProfile.brand_voice_tone ??
    "Professional and helpful"
  );
}

function buildTargetAudience(source: AiMarketingProfileSourceData): string {
  return (
    source.websiteAnalysis?.raw_summary?.customerPersona ??
    "Business decision-makers and customers described on the website"
  );
}

function buildValueProposition(source: AiMarketingProfileSourceData): string {
  return (
    source.websiteAnalysis?.raw_summary?.valueProposition ??
    `${buildBusinessName(source)} helps customers with ${buildServices(source)[0] ?? "core services"}.`
  );
}

function buildBusinessSummary(source: AiMarketingProfileSourceData): string {
  const businessName = buildBusinessName(source);
  const industry = buildIndustry(source);
  const summary =
    source.websiteAnalysis?.raw_summary?.executiveSummary ??
    `${businessName} is a ${industry.toLowerCase()} business focused on clear service messaging, customer trust, and consistent marketing across search, content, and reviews.`;

  return summary;
}

function buildRecommendedCtas(source: AiMarketingProfileSourceData): string[] {
  const ctas = source.websiteAnalysis?.raw_summary?.callsToAction ?? [];
  if (ctas.length > 0) return ctas.slice(0, 5);

  return ["Contact us", "Learn more", "Schedule a consultation"];
}

function buildSeasonalOpportunities(source: AiMarketingProfileSourceData): string[] {
  const seasonal = splitList(source.businessProfile.seasonal_services);
  if (seasonal.length > 0) return seasonal;

  const classification = classifyIndustryFallback(source);
  const services = buildServices(source);
  const generated = buildGrowthOpportunities({
    industry: classification.category?.id ?? null,
    services,
    citiesMentioned: buildServiceAreas(source),
    seoIssues: source.websiteAnalysis?.raw_summary?.seoIssues ?? [],
    hasGoogleBusinessProfile: false,
    hasReviews: false,
  });

  if (generated.length > 0) return generated;

  return [
    "Quarterly service spotlight campaign",
    "Seasonal educational content series",
    "End-of-quarter customer reminder campaign",
  ];
}

const INDUSTRY_BRAND_TRAITS: Partial<Record<IndustryCategoryId, string[]>> = {
  hvac: ["Reliable", "Prompt", "Straightforward"],
  roofing: ["Sturdy", "Trustworthy", "No-nonsense"],
  dental: ["Reassuring", "Gentle", "Professional"],
  restaurant: ["Warm", "Inviting", "Authentic"],
  legal: ["Authoritative", "Precise", "Trustworthy"],
  insurance: ["Reassuring", "Straightforward", "Knowledgeable"],
  consulting: ["Analytical", "Confident", "Results-driven"],
  marketing_agency: ["Bold", "Data-driven", "Creative"],
  saas: ["Efficient", "Modern", "Clear"],
  ecommerce: ["Convenient", "Vibrant", "Customer-first"],
  coaching: ["Motivating", "Personal", "Disciplined"],
};

const INDUSTRY_OBJECTIONS: Partial<Record<IndustryCategoryId, string[]>> = {
  hvac: [
    "Homeowners aren't sure if the issue is a real emergency or can wait",
    "Customers worry a repair quote will turn into an expensive upsell",
    "Buyers want to know if same-day service is actually available",
  ],
  roofing: [
    "Homeowners are wary of high-pressure sales tactics common in this industry",
    "Buyers want to understand insurance claim help before committing",
    "Customers are unsure whether a repair or full replacement is really needed",
  ],
  dental: [
    "Patients worry about cost and whether insurance is accepted",
    "New patients are anxious about pain or discomfort during treatment",
    "Prospects want to know if appointments are available quickly",
  ],
  restaurant: [
    "Diners aren't sure if the menu fits their dietary needs",
    "Prospective guests want to confirm hours and availability before visiting",
    "Customers are deciding between dine-in, takeout, or delivery and want that made easy",
  ],
  legal: [
    "Prospects are unsure what a consultation will cost",
    "Clients worry about how long their case will take to resolve",
    "Buyers want proof of relevant experience with cases like theirs",
  ],
  insurance: [
    "Shoppers assume switching providers is complicated and time-consuming",
    "Buyers aren't sure they're comparing coverage apples-to-apples",
    "Prospects worry a lower quote means weaker coverage",
  ],
  consulting: [
    "Buyers want to see proof of results before committing budget",
    "Prospects are unsure how engagement scope and pricing actually work",
    "Decision-makers want to know why this firm over a larger, known one",
  ],
  marketing_agency: [
    "Buyers have been burned by agencies that overpromise on results",
    "Prospects want clear reporting, not just vague monthly summaries",
    "Decision-makers are comparing cost against clear, measurable ROI",
  ],
  saas: [
    "Buyers aren't sure the switching cost from their current tool is worth it",
    "Prospects want to try it before committing to a paid plan",
    "Teams worry about how much setup/onboarding effort is required",
  ],
  ecommerce: [
    "Shoppers are unsure about shipping cost and delivery time before checkout",
    "Buyers want a clear return policy before they'll purchase",
    "Prospects are comparison-shopping on price against competitors",
  ],
  coaching: [
    "Prospects are unsure if this coach's approach fits their specific goal",
    "Buyers want proof of real client results, not just credentials",
    "People are unsure what a first session actually involves",
  ],
};

function buildFaqs(source: AiMarketingProfileSourceData, services: string[]): Array<{ question: string; answer: string }> {
  const businessName = buildBusinessName(source);
  const topics = services.slice(0, 3);

  if (topics.length === 0) {
    return [
      {
        question: `What does ${businessName} help customers with?`,
        answer: `${businessName} helps customers understand available services, benefits, and next steps through clear, trustworthy communication.`,
      },
    ];
  }

  return topics.map((service) => ({
    question: `How can customers get started with ${service}?`,
    answer: `${businessName} guides customers through ${service} with clear information, helpful recommendations, and a straightforward next step.`,
  }));
}

function buildMonthlyThemes(services: string[]): Array<{ month: string; theme: string; focus: string }> {
  return [
    { month: "Month 1", theme: "Trust and clarity", focus: services[0] ?? "Core services" },
    { month: "Month 2", theme: "Education and value", focus: services[1] ?? "Customer education" },
    { month: "Month 3", theme: "Engagement and conversion", focus: services[2] ?? "Lead generation" },
  ];
}

function buildQuarterlyCampaigns(
  source: AiMarketingProfileSourceData,
  services: string[]
): Array<{ title: string; description: string }> {
  const businessName = buildBusinessName(source);
  const primaryService = services[0] ?? "core services";

  return [
    {
      title: `${primaryService} Awareness Campaign`,
      description: `Position ${businessName} as a trusted choice for ${primaryService} through educational content, FAQs, and consistent messaging.`,
    },
    {
      title: "Authority and Proof Campaign",
      description: `Use reviews, customer stories, and expert content to strengthen trust and improve conversion across search and social channels.`,
    },
  ];
}

export class PlaceholderAiMarketingProfileGenerator implements AiMarketingProfileGenerator {
  async generate(source: AiMarketingProfileSourceData): Promise<AiMarketingProfileGenerated> {
    const businessName = buildBusinessName(source);
    const services = buildServices(source);
    const serviceAreas = buildServiceAreas(source);
    const keywords = buildKeywords(source);
    const competitors = buildCompetitors(source);
    const targetAudience = buildTargetAudience(source);
    const brandVoice = buildBrandVoice(source);
    const tone = buildTone(source);
    const valueProposition = buildValueProposition(source);
    const goals = source.businessProfile.marketing_goals ?? [];
    const contentIdeas =
      source.websiteAnalysis?.raw_summary?.contentOpportunities?.map((item) => item.title) ?? [];
    const roiIdeas = source.websiteAnalysis?.raw_summary?.highestRoiImprovements ?? [];
    const classification = classifyIndustryFallback(source);
    const industryTraits = classification.category ? INDUSTRY_BRAND_TRAITS[classification.category.id] ?? [] : [];
    const industryObjections = classification.category ? INDUSTRY_OBJECTIONS[classification.category.id] : undefined;

    return {
      business_summary: buildBusinessSummary(source),
      target_audience: targetAudience,
      ideal_customer: targetAudience,
      services,
      service_areas: serviceAreas,
      industry: buildIndustry(source),
      brand_voice: brandVoice,
      tone,
      value_proposition: valueProposition,
      keywords,
      competitors,
      faqs: buildFaqs(source, services),
      seasonal_opportunities: buildSeasonalOpportunities(source),
      recommended_ctas: buildRecommendedCtas(source),
      common_objections:
        industryObjections ?? [
          "Customers need more clarity before taking action",
          "Prospects want proof of expertise and trust",
          "Buyers compare options and need a stronger reason to choose this business",
        ],
      brand_personality: uniqueStrings([
        tone,
        ...splitList(source.businessProfile.preferred_words?.replace(/,/g, "\n")),
        ...(industryTraits.length > 0 ? industryTraits : ["Trustworthy", "Helpful", "Clear"]),
      ]).slice(0, 6),
      writing_examples: [brandVoice],
      marketing_strategy: `Focus ${businessName} messaging on ${targetAudience.toLowerCase()} using ${services.slice(0, 3).join(", ") || "core services"}. Prioritize goals such as ${goals.slice(0, 3).join(", ") || "lead generation, trust building, and consistent visibility"}.`,
      seo_strategy: `Improve visibility around ${keywords.slice(0, 5).join(", ") || "priority keywords"} and strengthen pages tied to ${serviceAreas.slice(0, 3).join(", ") || "core service areas"}. Address site issues such as ${(source.websiteAnalysis?.raw_summary?.seoIssues ?? ["missing FAQs", "weak internal linking"]).slice(0, 2).join(" and ")}.`,
      content_strategy: `Create content for ${targetAudience.toLowerCase()} using themes like ${contentIdeas.slice(0, 3).join("; ") || "service education, customer FAQs, and proof-driven posts"}.`,
      review_strategy: `Encourage authentic reviews that highlight ${services[0] ?? "service quality"}, responsiveness, and trust. Respond with the brand's ${tone.toLowerCase()} voice.`,
      google_business_strategy: `Publish Google Business Profile posts around ${services.slice(0, 2).join(" and ") || "top services"}, local relevance, and clear CTAs such as ${buildRecommendedCtas(source)[0]}.`,
      monthly_themes: buildMonthlyThemes(services),
      quarterly_campaigns: buildQuarterlyCampaigns(source, services).map((campaign, index) =>
        index === 1 && roiIdeas[0]
          ? { ...campaign, description: `${campaign.description} Priority improvement: ${roiIdeas[0]}.` }
          : campaign
      ),
    };
  }
}
