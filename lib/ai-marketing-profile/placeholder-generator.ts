import type {
  AiMarketingProfileGenerated,
  AiMarketingProfileGenerator,
  AiMarketingProfileSourceData,
} from "@/lib/ai-marketing-profile/types";

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

function buildIndustry(source: AiMarketingProfileSourceData): string {
  return (
    source.websiteAnalysis?.raw_summary?.industry ??
    source.businessProfile.industry ??
    "Local Business"
  );
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

  return [
    "Quarterly service spotlight campaign",
    "Seasonal educational content series",
    "End-of-quarter customer reminder campaign",
  ];
}

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
      common_objections: [
        "Customers need more clarity before taking action",
        "Prospects want proof of expertise and trust",
        "Buyers compare options and need a stronger reason to choose this business",
      ],
      brand_personality: uniqueStrings([
        tone,
        ...splitList(source.businessProfile.preferred_words?.replace(/,/g, "\n")),
        "Trustworthy",
        "Helpful",
        "Clear",
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
