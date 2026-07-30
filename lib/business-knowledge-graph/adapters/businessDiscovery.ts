/**
 * Business Discovery -> graph signals. Pure function — no I/O.
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import { GraphEntityTypes, type GraphSignalInput } from "@/lib/business-knowledge-graph/types";

const PROVIDER_ID = "business_discovery";
const PROVIDER_LABEL = "Business Discovery";

function confidenceFromTier(tier: string): "low" | "medium" | "high" {
  if (tier === "known") return "high";
  if (tier === "assumed") return "medium";
  return "low";
}

export function businessDiscoveryToGraphSignals(
  discovery: BusinessDiscoveryResult | null | undefined,
): GraphSignalInput[] {
  if (!discovery) return [];

  const signals: GraphSignalInput[] = [];
  const confidence = confidenceFromTier(discovery.primaryServices.confidenceTier);

  for (const service of discovery.primaryServices.value ?? []) {
    signals.push({
      sourceProviderId: PROVIDER_ID,
      sourceLabel: PROVIDER_LABEL,
      entityType: GraphEntityTypes.SERVICE,
      entityLabel: service,
      confidence,
      evidenceSummary: discovery.primaryServices.reason || `Identified as a core service: ${service}`,
      occurredAt: discovery.generatedAt,
    });
  }

  if (discovery.targetCustomers.value) {
    signals.push({
      sourceProviderId: PROVIDER_ID,
      sourceLabel: PROVIDER_LABEL,
      entityType: GraphEntityTypes.CUSTOMER_SEGMENT,
      entityLabel: discovery.targetCustomers.value,
      confidence: confidenceFromTier(discovery.targetCustomers.confidenceTier),
      evidenceSummary: discovery.targetCustomers.reason || `Target customers: ${discovery.targetCustomers.value}`,
      occurredAt: discovery.generatedAt,
    });
  }

  for (const strength of discovery.uniqueStrengths.value ?? []) {
    signals.push({
      sourceProviderId: PROVIDER_ID,
      sourceLabel: PROVIDER_LABEL,
      entityType: GraphEntityTypes.COMPETITIVE_STRENGTH,
      entityLabel: strength,
      confidence: confidenceFromTier(discovery.uniqueStrengths.confidenceTier),
      evidenceSummary: discovery.uniqueStrengths.reason || `Unique strength: ${strength}`,
      occurredAt: discovery.generatedAt,
    });
  }

  // Growth opportunities read as candidate services/expansion areas — related_to
  // the closest existing service rather than a new entity type of their own.
  for (const opportunity of discovery.growthOpportunities.value ?? []) {
    signals.push({
      sourceProviderId: PROVIDER_ID,
      sourceLabel: PROVIDER_LABEL,
      entityType: GraphEntityTypes.SERVICE,
      entityLabel: opportunity,
      confidence: confidenceFromTier(discovery.growthOpportunities.confidenceTier),
      evidenceSummary: discovery.growthOpportunities.reason || `Growth opportunity: ${opportunity}`,
      occurredAt: discovery.generatedAt,
    });
  }

  return signals;
}
