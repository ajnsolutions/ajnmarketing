/**
 * Maps the authenticated-shaped BusinessDiscoveryResult (PR #73,
 * lib/business-discovery/buildResult.ts) onto the intentionally narrower
 * public contract (lib/business-discovery/public/types.ts).
 *
 * This is where "based on the Business Discovery abstractions from PR #73,
 * but intentionally limited" is enforced: Customer Perception (needs public
 * reviews — not available pre-auth) and Competitive Position (needs Market
 * Context — not available pre-auth) are dropped entirely rather than shown as
 * a permanent, confusing "Missing" placeholder for a section that was never
 * really in scope pre-auth.
 *
 * The Overall Confidence Tier is deliberately *recomputed* from only the
 * fields that actually appear in the public contract — reusing each
 * DiscoveryInsight's own `.confidenceScore`/`.confidenceTier` (no changes to
 * buildResult.ts required). Reusing the internal businessConfidence verbatim
 * would unfairly and permanently cap every public score, since two of its
 * ten inputs (customerPerception, competitivePosition) are structurally
 * always Missing pre-auth — that would misrepresent "we don't check this yet"
 * as "your business understanding is incomplete."
 */

import { businessConfidenceExplanation, businessConfidenceLabelText, resolveBusinessConfidenceLabel } from "@/lib/business-discovery/confidenceLabels";
import { DiscoveryConfidenceTiers, type BusinessDiscoveryResult, type DiscoveryConfidenceTier } from "@/lib/business-discovery/types";
import { PUBLIC_SNAPSHOT_CONTRACT_VERSION, type PublicBusinessDiscoveryResultV1, type PublicMissingInformationItem } from "@/lib/business-discovery/public/types";

const MISSING_FIELD_RENAME: Record<string, string> = {
  targetCustomers: "likelyTargetCustomers",
  uniqueStrengths: "visibleStrengths",
  growthOpportunities: "possibleGrowthOpportunities",
};

const FIELDS_EXCLUDED_FROM_PUBLIC_CONTRACT = new Set(["customerPerception", "competitivePosition"]);

function renamePublicField(field: string): string {
  return MISSING_FIELD_RENAME[field] ?? field;
}

export function mapToPublicBusinessDiscoveryResult(
  internal: BusinessDiscoveryResult,
  snapshotReference: string,
  visitorInput: { websiteUrl: string; businessName: string | null; city: string | null; stateOrRegion: string | null },
  degraded = false
): PublicBusinessDiscoveryResultV1 {
  const publicRelevantTiers: DiscoveryConfidenceTier[] = [
    internal.businessSummary.confidenceTier,
    internal.primaryServices.confidenceTier,
    internal.targetCustomers.confidenceTier,
    internal.brandPersonality.confidenceTier,
    internal.uniqueStrengths.confidenceTier,
    internal.onlinePresence.website.confidenceTier,
    internal.onlinePresence.googleBusinessProfile.confidenceTier,
    internal.growthOpportunities.confidenceTier,
  ];
  const publicRelevantScores = [
    internal.businessSummary.confidenceScore,
    internal.primaryServices.confidenceScore,
    internal.targetCustomers.confidenceScore,
    internal.brandPersonality.confidenceScore,
    internal.uniqueStrengths.confidenceScore,
    internal.onlinePresence.website.confidenceScore,
    internal.onlinePresence.googleBusinessProfile.confidenceScore,
    internal.growthOpportunities.confidenceScore,
  ];

  const averageScore = Math.round(
    publicRelevantScores.reduce((sum, score) => sum + score, 0) / publicRelevantScores.length
  );
  const label = resolveBusinessConfidenceLabel(averageScore);
  const tier = publicRelevantTiers.every((t) => t === DiscoveryConfidenceTiers.KNOWN)
    ? DiscoveryConfidenceTiers.KNOWN
    : publicRelevantTiers.every((t) => t === DiscoveryConfidenceTiers.MISSING)
      ? DiscoveryConfidenceTiers.MISSING
      : DiscoveryConfidenceTiers.ASSUMED;

  const missingOrUnclearInformation: PublicMissingInformationItem[] = internal.missingInformation
    .filter((item) => !FIELDS_EXCLUDED_FROM_PUBLIC_CONTRACT.has(item.field))
    .map((item) => ({
      field: renamePublicField(item.field),
      reason: item.reason,
      suggestedNextAction: item.suggestedNextAction,
    }));

  return {
    contractVersion: PUBLIC_SNAPSHOT_CONTRACT_VERSION,
    generatedAt: internal.generatedAt,
    snapshotReference,
    websiteUrl: visitorInput.websiteUrl,
    businessName: visitorInput.businessName,
    city: visitorInput.city,
    stateOrRegion: visitorInput.stateOrRegion,
    degraded,
    businessSummary: internal.businessSummary,
    primaryServices: internal.primaryServices,
    likelyTargetCustomers: internal.targetCustomers,
    brandPersonality: internal.brandPersonality,
    visibleStrengths: internal.uniqueStrengths,
    onlinePresence: internal.onlinePresence,
    possibleGrowthOpportunities: internal.growthOpportunities,
    missingOrUnclearInformation,
    overallConfidence: {
      tier,
      label: businessConfidenceLabelText(label),
      explanation: businessConfidenceExplanation(label),
    },
  };
}
