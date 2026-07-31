/**
 * Business Discovery adapter — Business Identity, Products & Services,
 * Ideal Customers, Differentiators, Brand Voice, and Geographic Service
 * Area. Business Discovery already tracks confidence tier, reason, and
 * evidence refs per insight (lib/business-discovery/types.ts's
 * DiscoveryInsight) — this adapter only reshapes that into the shared
 * KnowledgeCard contract, never re-deriving or re-scoring anything.
 */

import type { BusinessDiscoveryResult, DiscoveryInsight, DiscoverySourceType } from "@/lib/business-discovery/types";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import { fromDiscoveryConfidenceTier } from "@/lib/business-brain-inspector/confidence";
import { BrainSections, type BrainCorrectionAction, type BrainEvidenceRef, type KnowledgeCard } from "@/lib/business-brain-inspector/types";

const SOURCE_LABELS: Record<DiscoverySourceType, string> = {
  business_profile: "Business Discovery",
  website: "Website",
  ai_website_analysis: "Website Analysis",
  ai_marketing_profile: "AI Marketing Profile",
  google_business_profile: "Google Business Profile",
  public_reviews: "Customer Voice",
  social_presence: "Social Presence",
  market_context: "External Intelligence",
  future_connector: "Business Connections",
  smart_upload: "Smart Uploads",
};

const SOURCE_CORRECTIONS: Record<DiscoverySourceType, BrainCorrectionAction> = {
  business_profile: { label: "Update this in Business Setup", href: "/dashboard/setup/business" },
  website: { label: "Review your website analysis", href: "/dashboard/website-analysis" },
  ai_website_analysis: { label: "Review your website analysis", href: "/dashboard/website-analysis" },
  ai_marketing_profile: { label: "Update your AI Marketing Profile", href: "/dashboard/ai-profile" },
  google_business_profile: { label: "Review your Google Business Profile", href: "/dashboard/google-business-profile" },
  public_reviews: { label: "Open Customer Voice", href: "/dashboard/customer-voice" },
  social_presence: { label: "Review Business Connections", href: "/dashboard/business-connections" },
  market_context: { label: "Review External Intelligence", href: "/dashboard/market-context" },
  future_connector: { label: "Review Business Connections", href: "/dashboard/business-connections" },
  smart_upload: { label: "Add more documents", href: "/dashboard/smart-uploads" },
};

function evidenceRefsFrom(insight: DiscoveryInsight<unknown>): BrainEvidenceRef[] {
  return insight.evidenceRefs.map((ref) => ({
    sourceProviderId: ref.source,
    sourceLabel: SOURCE_LABELS[ref.source],
    summary: ref.detail,
  }));
}

function correctionFor(insight: DiscoveryInsight<unknown>): BrainCorrectionAction | null {
  const primarySource = insight.sources[0];
  if (!primarySource) return { label: "Add this in Business Setup", href: "/dashboard/setup/business" };
  return SOURCE_CORRECTIONS[primarySource];
}

function cardFrom(
  section: KnowledgeCard["section"],
  id: string,
  title: string,
  statement: string,
  insight: DiscoveryInsight<unknown>,
): KnowledgeCard | null {
  const confidence = fromDiscoveryConfidenceTier(insight.confidenceTier);
  if (!confidence || !statement) return null;

  return {
    id,
    section,
    title,
    statement,
    confidence,
    confidenceReason: insight.reason,
    evidenceCount: insight.evidenceRefs.length,
    evidence: evidenceRefsFrom(insight),
    correction: correctionFor(insight),
  };
}

function geographicServiceAreaCard(
  profile: { city: string | null; state: string | null } | null | undefined,
  websiteAnalysis: WebsiteAnalysis | null | undefined,
): KnowledgeCard | null {
  const knownLocation = [profile?.city, profile?.state].filter(Boolean).join(", ");
  const mentionedCities = websiteAnalysis?.cities?.filter(Boolean) ?? [];

  if (knownLocation) {
    return {
      id: "business_discovery_geographic_service_area",
      section: BrainSections.GEOGRAPHIC_SERVICE_AREA,
      title: "Where you serve customers",
      statement:
        mentionedCities.length > 0
          ? `Based in ${knownLocation}, with your website also mentioning ${mentionedCities.slice(0, 3).join(", ")}.`
          : `Based in ${knownLocation}.`,
      confidence: "high",
      confidenceReason: "You told us this directly in Business Setup.",
      evidenceCount: 1,
      evidence: [{ sourceProviderId: "business_profile", sourceLabel: "Business Discovery", summary: `City/state on file: ${knownLocation}.` }],
      correction: { label: "Update this in Business Setup", href: "/dashboard/setup/business" },
    };
  }

  if (mentionedCities.length > 0) {
    return {
      id: "business_discovery_geographic_service_area",
      section: BrainSections.GEOGRAPHIC_SERVICE_AREA,
      title: "Where you serve customers",
      statement: `Your website mentions serving ${mentionedCities.slice(0, 3).join(", ")}.`,
      confidence: "medium",
      confidenceReason: "Inferred from your website copy — not yet confirmed directly.",
      evidenceCount: mentionedCities.length,
      evidence: [{ sourceProviderId: "ai_website_analysis", sourceLabel: "Website Analysis", summary: `Cities mentioned: ${mentionedCities.join(", ")}.` }],
      correction: { label: "Confirm this in Business Setup", href: "/dashboard/setup/business" },
    };
  }

  return null;
}

export function businessDiscoveryKnowledgeCards(input: {
  businessDiscovery?: BusinessDiscoveryResult | null;
  businessProfile?: { city: string | null; state: string | null } | null;
  websiteAnalysis?: WebsiteAnalysis | null;
}): KnowledgeCard[] {
  const discovery = input.businessDiscovery;
  if (!discovery) return [];

  const cards = [
    cardFrom(BrainSections.BUSINESS_IDENTITY, "business_discovery_identity", "What your business does", discovery.businessSummary.value ?? "", discovery.businessSummary),
    cardFrom(
      BrainSections.PRODUCTS_SERVICES,
      "business_discovery_services",
      "Primary services",
      discovery.primaryServices.value?.join(", ") ?? "",
      discovery.primaryServices,
    ),
    cardFrom(BrainSections.IDEAL_CUSTOMERS, "business_discovery_customers", "Who you serve", discovery.targetCustomers.value ?? "", discovery.targetCustomers),
    cardFrom(
      BrainSections.DIFFERENTIATORS,
      "business_discovery_strengths",
      "What sets you apart",
      discovery.uniqueStrengths.value?.join(", ") ?? "",
      discovery.uniqueStrengths,
    ),
    cardFrom(
      BrainSections.BRAND_VOICE,
      "business_discovery_brand_voice",
      "How you come across",
      discovery.brandPersonality.value?.join(", ") ?? "",
      discovery.brandPersonality,
    ),
    geographicServiceAreaCard(input.businessProfile, input.websiteAnalysis),
  ];

  return cards.filter((card): card is KnowledgeCard => card !== null);
}
