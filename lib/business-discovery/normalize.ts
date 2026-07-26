/**
 * Business Discovery normalization — merges the raw, per-source
 * BusinessDiscoveryObservation[] into one deduplicated UnifiedBusinessProfile.
 *
 * Merge rules (deliberately simple and deterministic — no AI judgment here):
 * - Scalar fields (name, industry, tone, ...): a verified-fact observation
 *   always wins over an AI-inferred one; if several verified-fact
 *   observations exist, the first collected wins (collectors.ts runs
 *   business-profile before AI sources, so an owner-entered value is always
 *   collected first).
 * - List fields (services, competitors, ...): every source's items are
 *   unioned and case-insensitively deduplicated, keeping the first-seen
 *   casing.
 * - A field with zero contributing observations stays genuinely empty here —
 *   buildResult.ts is what turns that into an honest "Missing" insight, never
 *   this module.
 */

import type {
  BusinessDiscoveryObservation,
  DiscoverySourceType,
  MergedField,
  ReviewSummary,
  UnifiedBusinessProfile,
} from "@/lib/business-discovery/types";

function emptyMergedField<T>(): MergedField<T> {
  return { value: null, contributingSources: [], hasVerifiedFactSource: false, evidenceRefs: [] };
}

function observationsForField(
  observations: BusinessDiscoveryObservation[],
  field: string
): BusinessDiscoveryObservation[] {
  return observations.filter((entry) => entry.field === field);
}

function dedupeSources(sources: DiscoverySourceType[]): DiscoverySourceType[] {
  return Array.from(new Set(sources));
}

function evidenceRefsFor(matches: BusinessDiscoveryObservation[]) {
  return matches.map((entry) => ({ source: entry.source, detail: entry.evidenceDetail }));
}

function mergeScalarField<T>(
  observations: BusinessDiscoveryObservation[],
  field: string
): MergedField<T> {
  const matches = observationsForField(observations, field);
  if (matches.length === 0) return emptyMergedField<T>();

  const chosen = matches.find((entry) => entry.isVerifiedFact) ?? matches[0];
  return {
    value: chosen.value as T,
    contributingSources: dedupeSources(matches.map((entry) => entry.source)),
    hasVerifiedFactSource: matches.some((entry) => entry.isVerifiedFact),
    evidenceRefs: evidenceRefsFor(matches),
  };
}

function mergeArrayField(
  observations: BusinessDiscoveryObservation[],
  field: string
): MergedField<string[]> {
  const matches = observationsForField(observations, field);
  if (matches.length === 0) return emptyMergedField<string[]>();

  const seen = new Map<string, string>();
  for (const match of matches) {
    const items = (match.value as string[]) ?? [];
    for (const item of items) {
      const trimmed = item.trim();
      const key = trimmed.toLowerCase();
      if (trimmed && !seen.has(key)) seen.set(key, trimmed);
    }
  }

  return {
    value: Array.from(seen.values()),
    contributingSources: dedupeSources(matches.map((entry) => entry.source)),
    hasVerifiedFactSource: matches.some((entry) => entry.isVerifiedFact),
    evidenceRefs: evidenceRefsFor(matches),
  };
}

export function normalizeBusinessDiscoveryObservations(
  businessProfileId: string,
  observations: BusinessDiscoveryObservation[]
): UnifiedBusinessProfile {
  return {
    businessProfileId,
    businessName: mergeScalarField<string>(observations, "businessName"),
    businessSummary: mergeScalarField<string>(observations, "businessSummary"),
    industry: mergeScalarField<string>(observations, "industry"),
    website: mergeScalarField<string>(observations, "website"),
    primaryServices: mergeArrayField(observations, "primaryServices"),
    serviceAreas: mergeArrayField(observations, "serviceAreas"),
    tone: mergeScalarField<string>(observations, "tone"),
    brandPersonality: mergeArrayField(observations, "brandPersonality"),
    targetAudience: mergeScalarField<string>(observations, "targetAudience"),
    competitors: mergeArrayField(observations, "competitors"),
    strengths: mergeArrayField(observations, "strengths"),
    growthOpportunities: mergeArrayField(observations, "growthOpportunities"),
    reviewSummary: mergeScalarField<ReviewSummary>(observations, "reviewSummary"),
    googleBusinessProfileConnected: mergeScalarField<boolean>(observations, "googleBusinessProfileConnected"),
    websiteAnalyzed: mergeScalarField<boolean>(observations, "websiteAnalyzed"),
  };
}
