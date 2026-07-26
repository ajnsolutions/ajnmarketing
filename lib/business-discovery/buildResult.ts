/**
 * Business Discovery result builder — turns a UnifiedBusinessProfile into the
 * customer-facing-shaped BusinessDiscoveryResult: business understanding, not
 * marketing metrics, with every insight carrying Source + Confidence + Reason
 * (see docs/project-magic/FREE_MARKETING_SNAPSHOT.md's explainability
 * requirement).
 *
 * Confidence scoring here is intentionally simple and fully deterministic — no
 * AI judgment, no opaque weighting. A field is:
 * - Known: at least one contributing source is a verified fact
 * - Assumed: a value exists, but only from AI-inferred sources
 * - Missing: no contributing source at all
 *
 * This file has no I/O and does not know about Supabase, OpenAI, or any
 * connector — it is pure transformation, which is what makes it unit-testable
 * without mocking a database.
 */

import { businessConfidenceExplanation, businessConfidenceLabelText, resolveBusinessConfidenceLabel } from "@/lib/business-discovery/confidenceLabels";
import {
  DiscoveryConfidenceTiers,
  type BusinessConfidenceSummary,
  type BusinessDiscoveryResult,
  type DiscoveryConfidenceTier,
  type DiscoveryEvidenceRef,
  type DiscoveryInsight,
  type MergedField,
  type MissingInformationItem,
  type OnlinePresenceInsight,
  type UnifiedBusinessProfile,
} from "@/lib/business-discovery/types";

const KNOWN_SCORE = 90;
const ASSUMED_SCORE = 55;
const MISSING_SCORE = 0;

function tierFor(hasValue: boolean, hasVerifiedFactSource: boolean): DiscoveryConfidenceTier {
  if (!hasValue) return DiscoveryConfidenceTiers.MISSING;
  return hasVerifiedFactSource ? DiscoveryConfidenceTiers.KNOWN : DiscoveryConfidenceTiers.ASSUMED;
}

function scoreFor(tier: DiscoveryConfidenceTier): number {
  if (tier === DiscoveryConfidenceTiers.KNOWN) return KNOWN_SCORE;
  if (tier === DiscoveryConfidenceTiers.ASSUMED) return ASSUMED_SCORE;
  return MISSING_SCORE;
}

/** Joins up to two evidence details into the "because X and Y" clause of a reason sentence. */
function evidencePhrase(evidenceRefs: DiscoveryEvidenceRef[]): string {
  const details = evidenceRefs.map((ref) => ref.detail).slice(0, 2);
  return details.join(" and ");
}

function hasArrayValue(value: string[] | null): value is string[] {
  return Array.isArray(value) && value.length > 0;
}

function hasScalarValue<T>(value: T | null): value is T {
  return value !== null && value !== undefined && value !== "";
}

function buildInsight<T>(
  merged: MergedField<T>,
  hasValue: (value: T | null) => boolean,
  reasonFor: (tier: DiscoveryConfidenceTier, value: T | null, evidence: string) => string
): DiscoveryInsight<T> {
  const tier = tierFor(hasValue(merged.value), merged.hasVerifiedFactSource);
  return {
    value: merged.value,
    confidenceTier: tier,
    confidenceScore: scoreFor(tier),
    sources: merged.contributingSources,
    reason: reasonFor(tier, merged.value, evidencePhrase(merged.evidenceRefs)),
    evidenceRefs: merged.evidenceRefs,
  };
}

function buildBusinessSummary(unified: UnifiedBusinessProfile): DiscoveryInsight<string> {
  return buildInsight(unified.businessSummary, hasScalarValue, (tier, _value, evidence) => {
    if (tier === DiscoveryConfidenceTiers.KNOWN) return `Summarized from ${evidence}.`;
    if (tier === DiscoveryConfidenceTiers.ASSUMED) return `We put this together from ${evidence} — it hasn't been confirmed yet.`;
    return "We don't have enough information yet to summarize this business — connecting a website or Google Business Profile will help.";
  });
}

function buildPrimaryServices(unified: UnifiedBusinessProfile): DiscoveryInsight<string[]> {
  return buildInsight(unified.primaryServices, hasArrayValue, (tier, value, evidence) => {
    const list = value?.join(", ") ?? "";
    if (tier === DiscoveryConfidenceTiers.KNOWN) return `You told us your primary services are ${list}.`;
    if (tier === DiscoveryConfidenceTiers.ASSUMED) return `We believe your primary services are ${list} because ${evidence}.`;
    return "We haven't found any information about your primary services yet.";
  });
}

function buildTargetCustomers(unified: UnifiedBusinessProfile): DiscoveryInsight<string> {
  return buildInsight(unified.targetAudience, hasScalarValue, (tier, value, evidence) => {
    if (tier === DiscoveryConfidenceTiers.KNOWN) return `You told us your target customers are ${value}.`;
    if (tier === DiscoveryConfidenceTiers.ASSUMED) return `We believe your primary audience is ${value} because ${evidence}.`;
    return "We don't yet know who your target customers are — a website analysis or a quick note usually answers this.";
  });
}

function buildBrandPersonality(unified: UnifiedBusinessProfile): DiscoveryInsight<string[]> {
  return buildInsight(unified.brandPersonality, hasArrayValue, (tier, value, evidence) => {
    const list = value?.join(", ") ?? "";
    if (tier === DiscoveryConfidenceTiers.KNOWN) return `Your brand personality is set to ${list}.`;
    if (tier === DiscoveryConfidenceTiers.ASSUMED) return `We believe your brand personality leans ${list} based on ${evidence}.`;
    return "We don't have a read on your brand personality yet.";
  });
}

function buildUniqueStrengths(unified: UnifiedBusinessProfile): DiscoveryInsight<string[]> {
  return buildInsight(unified.strengths, hasArrayValue, (tier, value, evidence) => {
    const list = value?.join(", ") ?? "";
    if (tier === DiscoveryConfidenceTiers.KNOWN) return `Your listed strengths are ${list}.`;
    if (tier === DiscoveryConfidenceTiers.ASSUMED) return `We noticed ${list} as likely strengths, based on ${evidence}.`;
    return "We haven't identified any unique strengths yet — a website analysis usually surfaces a few.";
  });
}

function buildCustomerPerception(unified: UnifiedBusinessProfile): DiscoveryInsight<string> {
  const merged = unified.reviewSummary;
  const tier = tierFor(hasScalarValue(merged.value), merged.hasVerifiedFactSource);
  const summarySentence = merged.value
    ? `Averaging ${merged.value.averageRating} stars across ${merged.value.reviewCount} public review${merged.value.reviewCount === 1 ? "" : "s"}.`
    : null;

  return {
    value: summarySentence,
    confidenceTier: tier,
    confidenceScore: scoreFor(tier),
    sources: merged.contributingSources,
    reason:
      tier === DiscoveryConfidenceTiers.KNOWN
        ? `Based on ${evidencePhrase(merged.evidenceRefs)}. A deeper read of what customers actually say is coming in a future update.`
        : "We don't have any public reviews yet, so we can't say how customers currently perceive this business.",
    evidenceRefs: merged.evidenceRefs,
  };
}

function buildCompetitivePosition(unified: UnifiedBusinessProfile): DiscoveryInsight<string[]> {
  return buildInsight(unified.competitors, hasArrayValue, (tier, value, evidence) => {
    const list = value?.join(", ") ?? "";
    if (tier === DiscoveryConfidenceTiers.KNOWN) return `You told us you compete with ${list}.`;
    if (tier === DiscoveryConfidenceTiers.ASSUMED) return `We found ${list} as likely competitors, based on ${evidence}.`;
    return "We don't know who this business's competitors are yet.";
  });
}

function buildOnlinePresence(unified: UnifiedBusinessProfile): OnlinePresenceInsight {
  const websiteTier = tierFor(hasScalarValue(unified.website.value), unified.website.hasVerifiedFactSource);
  const analyzed = unified.websiteAnalyzed.value === true;

  const website: DiscoveryInsight<{ connected: boolean; analyzed: boolean }> = {
    value: { connected: websiteTier !== DiscoveryConfidenceTiers.MISSING, analyzed },
    confidenceTier: websiteTier,
    confidenceScore: scoreFor(websiteTier),
    sources: unified.website.contributingSources,
    reason:
      websiteTier === DiscoveryConfidenceTiers.MISSING
        ? "No website is on file yet."
        : analyzed
          ? "Your website is on file and has a completed AI analysis."
          : "Your website is on file but hasn't been analyzed yet.",
    evidenceRefs: unified.website.evidenceRefs,
  };

  const gbpConnected = unified.googleBusinessProfileConnected.value === true;
  const gbpTier = tierFor(unified.googleBusinessProfileConnected.value !== null, unified.googleBusinessProfileConnected.hasVerifiedFactSource);

  const googleBusinessProfile: DiscoveryInsight<{ connected: boolean }> = {
    value: { connected: gbpConnected },
    confidenceTier: gbpTier,
    confidenceScore: scoreFor(gbpTier),
    sources: unified.googleBusinessProfileConnected.contributingSources,
    reason: gbpConnected
      ? "Your Google Business Profile is connected."
      : "Your Google Business Profile isn't connected yet — this is one of the fastest ways to improve local visibility.",
    evidenceRefs: unified.googleBusinessProfileConnected.evidenceRefs,
  };

  const socialPresence: DiscoveryInsight<null> = {
    value: null,
    confidenceTier: DiscoveryConfidenceTiers.MISSING,
    confidenceScore: MISSING_SCORE,
    sources: [],
    reason: "Social presence discovery isn't connected yet — this is planned for a future Connector Framework wave.",
    evidenceRefs: [],
  };

  return { website, googleBusinessProfile, socialPresence };
}

function buildGrowthOpportunities(unified: UnifiedBusinessProfile): DiscoveryInsight<string[]> {
  return buildInsight(unified.growthOpportunities, hasArrayValue, (tier, value, evidence) => {
    const list = value?.join(", ") ?? "";
    if (tier === DiscoveryConfidenceTiers.KNOWN) return `Growth opportunities on file: ${list}.`;
    if (tier === DiscoveryConfidenceTiers.ASSUMED) return `We noticed potential opportunities (${list}) based on ${evidence}.`;
    return "We haven't identified any growth opportunities yet.";
  });
}

type CoreFieldSummary = { key: string; label: string; tier: DiscoveryConfidenceTier; suggestedNextAction: string };

function collectMissingInformation(fields: CoreFieldSummary[]): MissingInformationItem[] {
  return fields
    .filter((field) => field.tier === DiscoveryConfidenceTiers.MISSING)
    .map((field) => ({
      field: field.key,
      reason: `We don't have any information about ${field.label.toLowerCase()} yet.`,
      suggestedNextAction: field.suggestedNextAction,
    }));
}

function buildBusinessConfidence(fields: CoreFieldSummary[]): BusinessConfidenceSummary {
  const knownFieldCount = fields.filter((field) => field.tier === DiscoveryConfidenceTiers.KNOWN).length;
  const assumedFieldCount = fields.filter((field) => field.tier === DiscoveryConfidenceTiers.ASSUMED).length;
  const missingFieldCount = fields.filter((field) => field.tier === DiscoveryConfidenceTiers.MISSING).length;

  const total = fields.length || 1;
  const score = Math.round(
    (knownFieldCount * KNOWN_SCORE + assumedFieldCount * ASSUMED_SCORE + missingFieldCount * MISSING_SCORE) / total
  );
  const label = resolveBusinessConfidenceLabel(score);

  return {
    score,
    label,
    explanation: `${businessConfidenceLabelText(label)}. ${businessConfidenceExplanation(label)}`,
    knownFieldCount,
    assumedFieldCount,
    missingFieldCount,
  };
}

export function buildBusinessDiscoveryResult(unified: UnifiedBusinessProfile): BusinessDiscoveryResult {
  const businessSummary = buildBusinessSummary(unified);
  const primaryServices = buildPrimaryServices(unified);
  const targetCustomers = buildTargetCustomers(unified);
  const brandPersonality = buildBrandPersonality(unified);
  const uniqueStrengths = buildUniqueStrengths(unified);
  const customerPerception = buildCustomerPerception(unified);
  const competitivePosition = buildCompetitivePosition(unified);
  const onlinePresence = buildOnlinePresence(unified);
  const growthOpportunities = buildGrowthOpportunities(unified);

  const coreFields: CoreFieldSummary[] = [
    { key: "businessSummary", label: "Business Summary", tier: businessSummary.confidenceTier, suggestedNextAction: "Connect a website so we can build a real summary." },
    { key: "primaryServices", label: "Primary Services", tier: primaryServices.confidenceTier, suggestedNextAction: "Add your primary services to your business profile." },
    { key: "targetCustomers", label: "Target Customers", tier: targetCustomers.confidenceTier, suggestedNextAction: "Run a website analysis or tell us who you serve." },
    { key: "brandPersonality", label: "Brand Personality", tier: brandPersonality.confidenceTier, suggestedNextAction: "Set your brand voice and tone in Brand Voice settings." },
    { key: "uniqueStrengths", label: "Unique Strengths", tier: uniqueStrengths.confidenceTier, suggestedNextAction: "Run a website analysis to surface your strengths." },
    { key: "customerPerception", label: "Customer Perception", tier: customerPerception.confidenceTier, suggestedNextAction: "Connect your Google Business Profile so we can read your public reviews." },
    { key: "competitivePosition", label: "Competitive Position", tier: competitivePosition.confidenceTier, suggestedNextAction: "Tell us who your competitors are." },
    { key: "onlinePresence.website", label: "Website Presence", tier: onlinePresence.website.confidenceTier, suggestedNextAction: "Add and analyze your website." },
    { key: "onlinePresence.googleBusinessProfile", label: "Google Business Profile Presence", tier: onlinePresence.googleBusinessProfile.confidenceTier, suggestedNextAction: "Connect your Google Business Profile." },
    { key: "growthOpportunities", label: "Growth Opportunities", tier: growthOpportunities.confidenceTier, suggestedNextAction: "Run a website analysis to surface growth opportunities." },
  ];

  return {
    businessProfileId: unified.businessProfileId,
    generatedAt: new Date().toISOString(),
    businessSummary,
    primaryServices,
    targetCustomers,
    brandPersonality,
    uniqueStrengths,
    customerPerception,
    competitivePosition,
    onlinePresence,
    growthOpportunities,
    missingInformation: collectMissingInformation(coreFields),
    businessConfidence: buildBusinessConfidence(coreFields),
  };
}
