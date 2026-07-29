/**
 * Evidence normalization — every provider maps into NormalizedCustomerEvidence.
 * Downstream never needs provider-specific fields.
 */

import { extractThemesFromText, sentimentFromTextAndRating } from "@/lib/customer-voice/themes";
import type {
  ConfidenceLevel,
  CustomerVoiceProviderId,
  NormalizedCustomerEvidence,
  ProviderEvidenceInput,
} from "@/lib/customer-voice/types";
import { ConfidenceLevels } from "@/lib/customer-voice/types";

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
}

function evidenceWeight(input: ProviderEvidenceInput, now: Date): number {
  const textLen = input.text.trim().length;
  const richness = Math.min(1, textLen / 180);
  const ageDays = daysAgo(input.occurredAt, now);
  let recency = 0.55;
  if (ageDays != null) {
    if (ageDays <= 30) recency = 1;
    else if (ageDays <= 90) recency = 0.85;
    else if (ageDays <= 180) recency = 0.7;
    else if (ageDays <= 365) recency = 0.5;
    else recency = 0.35;
  }
  return Math.round((0.45 * richness + 0.55 * recency) * 1000) / 1000;
}

function evidenceConfidence(input: ProviderEvidenceInput, now: Date): ConfidenceLevel {
  const weight = evidenceWeight(input, now);
  const hasText = input.text.trim().length >= 24;
  if (hasText && weight >= 0.75) return ConfidenceLevels.HIGH;
  if (hasText && weight >= 0.5) return ConfidenceLevels.MEDIUM;
  return ConfidenceLevels.LOW;
}

export function normalizeProviderEvidence(input: {
  providerId: CustomerVoiceProviderId;
  sourceLabel: string;
  evidence: ProviderEvidenceInput;
  knownServices?: string[];
  now?: Date;
}): NormalizedCustomerEvidence {
  const now = input.now ?? new Date();
  const text = input.evidence.text.trim();
  const extraction = extractThemesFromText(text, {
    rating: input.evidence.rating,
    knownServices: input.knownServices,
  });
  const sentiment =
    extraction.emotionalTone ||
    sentimentFromTextAndRating(text, input.evidence.rating);

  return {
    id: `${input.providerId}:${input.evidence.externalId}`,
    sourceProviderId: input.providerId,
    sourceLabel: input.sourceLabel,
    occurredAt: input.evidence.occurredAt,
    sentiment,
    confidence: evidenceConfidence(input.evidence, now),
    originalText: text.slice(0, 2000),
    extractedThemes: extraction.hits.map((hit) => hit.clusterKey),
    referencedServices: extraction.services,
    referencedEmployees: extraction.employees,
    language: input.evidence.language ?? "en",
    evidenceWeight: evidenceWeight(input.evidence, now),
  };
}

export function normalizeProviderBatch(input: {
  providerId: CustomerVoiceProviderId;
  sourceLabel: string;
  evidence: ProviderEvidenceInput[];
  knownServices?: string[];
  now?: Date;
}): NormalizedCustomerEvidence[] {
  return input.evidence
    .filter((item) => item.text.trim().length > 0 || item.rating != null)
    .map((item) =>
      normalizeProviderEvidence({
        providerId: input.providerId,
        sourceLabel: input.sourceLabel,
        evidence: item,
        knownServices: input.knownServices,
        now: input.now,
      }),
    );
}

/**
 * Duplicate themes across providers strengthen the same canonical keys —
 * this helper is the aggregation input shape (compose builds final themes).
 */
export type ThemeAggregationBucket = {
  key: string;
  label: string;
  kind: import("@/lib/customer-voice/types").ThemeKind;
  impactHints: readonly string[];
  evidenceIds: string[];
  languageVariants: Set<string>;
  weightedSupport: number;
  providerIds: Set<CustomerVoiceProviderId>;
  sentiments: import("@/lib/customer-voice/types").CustomerVoiceSentiment[];
  dates: string[];
};

export function emptyThemeBuckets(): Map<string, ThemeAggregationBucket> {
  return new Map();
}
