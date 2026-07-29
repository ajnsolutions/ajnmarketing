/**
 * Signal normalization — every provider maps into NormalizedExternalSignal.
 * Downstream never needs provider-specific fields.
 */

import type {
  ConfidenceLevel,
  ExternalIntelligenceProviderId,
  NormalizedExternalSignal,
  ProviderSignalInput,
} from "@/lib/external-intelligence/types";
import {
  ConfidenceLevels,
  PROVIDER_RELIABILITY,
} from "@/lib/external-intelligence/types";

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function evidenceWeight(
  input: ProviderSignalInput,
  providerId: ExternalIntelligenceProviderId,
  now: Date,
): number {
  const reliability = PROVIDER_RELIABILITY[providerId] ?? 0.5;
  const strength = clamp01(input.signalStrength ?? 0.5);
  const summaryLen = `${input.title} ${input.summary}`.trim().length;
  const richness = Math.min(1, summaryLen / 160);
  const ageDays = daysAgo(input.occurredAt, now);
  let recency = 0.55;
  if (ageDays != null) {
    if (ageDays <= 7) recency = 1;
    else if (ageDays <= 30) recency = 0.85;
    else if (ageDays <= 90) recency = 0.7;
    else if (ageDays <= 180) recency = 0.5;
    else recency = 0.35;
  }
  return Math.round((0.35 * reliability + 0.25 * strength + 0.2 * richness + 0.2 * recency) * 1000) / 1000;
}

function signalQuality(
  input: ProviderSignalInput,
  providerId: ExternalIntelligenceProviderId,
  now: Date,
): ConfidenceLevel {
  const weight = evidenceWeight(input, providerId, now);
  const hasSubstance = input.summary.trim().length >= 24 || input.title.trim().length >= 12;
  if (!hasSubstance || weight < 0.45) return ConfidenceLevels.LOW;
  if (weight >= 0.75) return ConfidenceLevels.HIGH;
  return ConfidenceLevels.MEDIUM;
}

export function normalizeProviderSignal(input: {
  providerId: ExternalIntelligenceProviderId;
  sourceLabel: string;
  signal: ProviderSignalInput;
  now?: Date;
}): NormalizedExternalSignal {
  const now = input.now ?? new Date();
  const signal = input.signal;
  const weight = evidenceWeight(signal, input.providerId, now);
  const quality = signalQuality(signal, input.providerId, now);

  return {
    id: `${input.providerId}:${signal.externalId}`,
    sourceProviderId: input.providerId,
    sourceLabel: input.sourceLabel,
    category: signal.category,
    title: signal.title.trim().slice(0, 200),
    summary: signal.summary.trim().slice(0, 1200),
    occurredAt: signal.occurredAt,
    expiresAt: signal.expiresAt ?? null,
    signalStrength: clamp01(signal.signalStrength ?? 0.5),
    relatedGoalHints: (signal.relatedGoalHints ?? [])
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 8),
    actionHints: (signal.actionHints ?? [])
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 8),
    evidenceWeight: weight,
    quality,
  };
}

export function normalizeProviderBatch(input: {
  providerId: ExternalIntelligenceProviderId;
  sourceLabel: string;
  signals: ProviderSignalInput[];
  now?: Date;
}): NormalizedExternalSignal[] {
  return input.signals.map((signal) =>
    normalizeProviderSignal({
      providerId: input.providerId,
      sourceLabel: input.sourceLabel,
      signal,
      now: input.now,
    }),
  );
}

/** Stable cluster key so corroborating providers strengthen the same insight. */
export function clusterKeyForSignal(signal: NormalizedExternalSignal): string {
  const base = `${signal.category}:${signal.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return base || `${signal.category}:untitled`;
}
