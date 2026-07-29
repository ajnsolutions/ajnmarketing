/**
 * INTERNAL External Intelligence Score (0–100).
 * Never surface the numeric score to customers — only maturityCopy.
 */

import type {
  ConfidenceLevel,
  ExternalIntelligenceScore,
  ExternalIntelligenceScoreBreakdown,
  ExternalMaturityLabel,
  NormalizedExternalSignal,
} from "@/lib/external-intelligence/types";
import { ExternalMaturityLabels } from "@/lib/external-intelligence/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
}

export function maturityCopyFor(label: ExternalMaturityLabel): string {
  switch (label) {
    case ExternalMaturityLabels.WELL_UNDERSTOOD:
      return "Market conditions are well understood.";
    case ExternalMaturityLabels.STILL_DEVELOPING:
      return "Market signals are still developing.";
    case ExternalMaturityLabels.MONITORING:
      return "Monitoring for stronger trends.";
    default:
      return "Monitoring for stronger trends.";
  }
}

export function calculateExternalIntelligenceScore(input: {
  signals: NormalizedExternalSignal[];
  insightCount: number;
  highConfidenceInsights: number;
  corroboratingInsightCount: number;
  categoryCount: number;
  overallConfidence: ConfidenceLevel;
  now?: Date;
}): ExternalIntelligenceScore {
  const now = input.now ?? new Date();
  const signals = input.signals;
  const count = signals.length;

  if (count === 0) {
    return {
      score: 0,
      breakdown: {
        signalVolume: 0,
        freshness: 0,
        coverage: 0,
        confidence: 0,
        corroboration: 0,
        categoryBreadth: 0,
      },
      maturityLabel: ExternalMaturityLabels.EMPTY,
      maturityCopy: maturityCopyFor(ExternalMaturityLabels.MONITORING),
    };
  }

  const signalVolume = clamp((count / 20) * 100);

  const recent = signals.filter((item) => {
    const age = daysAgo(item.occurredAt, now);
    return age != null && age <= 30;
  }).length;
  const freshness = clamp((recent / Math.max(1, count)) * 100);

  const withSubstance = signals.filter(
    (item) => item.summary.trim().length >= 24 || item.title.trim().length >= 12,
  ).length;
  const coverage = clamp((withSubstance / count) * 100);

  const confidence =
    input.overallConfidence === "high" ? 85 : input.overallConfidence === "medium" ? 60 : 35;

  const corroboration =
    input.insightCount === 0
      ? 15
      : clamp((input.corroboratingInsightCount / Math.max(1, input.insightCount)) * 100);

  const categoryBreadth = clamp((input.categoryCount / 7) * 100);

  const breakdown: ExternalIntelligenceScoreBreakdown = {
    signalVolume,
    freshness,
    coverage,
    confidence,
    corroboration,
    categoryBreadth,
  };

  const score = clamp(
    signalVolume * 0.2 +
      freshness * 0.2 +
      coverage * 0.15 +
      confidence * 0.2 +
      corroboration * 0.15 +
      categoryBreadth * 0.1,
  );

  let maturityLabel: ExternalMaturityLabel = ExternalMaturityLabels.MONITORING;
  if (count < 2 || score < 35) maturityLabel = ExternalMaturityLabels.MONITORING;
  else if (score < 60) maturityLabel = ExternalMaturityLabels.STILL_DEVELOPING;
  else maturityLabel = ExternalMaturityLabels.WELL_UNDERSTOOD;

  return {
    score,
    breakdown,
    maturityLabel,
    maturityCopy: maturityCopyFor(maturityLabel),
  };
}
