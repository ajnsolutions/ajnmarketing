/**
 * INTERNAL Customer Voice Score (0–100).
 * Never surface the numeric score to customers — only maturityCopy.
 */

import type {
  ConfidenceLevel,
  CustomerVoiceScore,
  CustomerVoiceScoreBreakdown,
  NormalizedCustomerEvidence,
  VoiceMaturityLabel,
} from "@/lib/customer-voice/types";
import { VoiceMaturityLabels } from "@/lib/customer-voice/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
}

export function maturityCopyFor(label: VoiceMaturityLabel): string {
  switch (label) {
    case VoiceMaturityLabels.WELL_ESTABLISHED:
      return "Customer feedback is well established.";
    case VoiceMaturityLabels.LIMITED:
      return "Customer feedback is still limited.";
    case VoiceMaturityLabels.CONTINUING_TO_LEARN:
      return "The advisor is continuing to learn.";
    default:
      return "The advisor is continuing to learn.";
  }
}

export function calculateCustomerVoiceScore(input: {
  evidence: NormalizedCustomerEvidence[];
  themeCount: number;
  highConfidenceThemes: number;
  overallConfidence: ConfidenceLevel;
  now?: Date;
}): CustomerVoiceScore {
  const now = input.now ?? new Date();
  const evidence = input.evidence;
  const count = evidence.length;

  if (count === 0) {
    return {
      score: 0,
      breakdown: {
        reviewVolume: 0,
        freshness: 0,
        coverage: 0,
        confidence: 0,
        themeConsistency: 0,
        sentimentStability: 0,
      },
      maturityLabel: VoiceMaturityLabels.EMPTY,
      maturityCopy: maturityCopyFor(VoiceMaturityLabels.CONTINUING_TO_LEARN),
    };
  }

  const reviewVolume = clamp((count / 40) * 100);

  const recent = evidence.filter((item) => {
    const age = daysAgo(item.occurredAt, now);
    return age != null && age <= 90;
  }).length;
  const freshness = clamp((recent / Math.max(1, count)) * 100);

  const withText = evidence.filter((item) => item.originalText.trim().length >= 20).length;
  const coverage = clamp((withText / count) * 100);

  const confidence =
    input.overallConfidence === "high" ? 85 : input.overallConfidence === "medium" ? 60 : 35;

  const themeConsistency =
    input.themeCount === 0
      ? 20
      : clamp((input.highConfidenceThemes / Math.max(1, input.themeCount)) * 100);

  const positive = evidence.filter((e) => e.sentiment === "positive").length;
  const negative = evidence.filter((e) => e.sentiment === "negative").length;
  const dominant = Math.max(positive, negative, count - positive - negative);
  const sentimentStability = clamp((dominant / count) * 100);

  const breakdown: CustomerVoiceScoreBreakdown = {
    reviewVolume,
    freshness,
    coverage,
    confidence,
    themeConsistency,
    sentimentStability,
  };

  const score = clamp(
    reviewVolume * 0.2 +
      freshness * 0.15 +
      coverage * 0.15 +
      confidence * 0.2 +
      themeConsistency * 0.15 +
      sentimentStability * 0.15,
  );

  let maturityLabel: VoiceMaturityLabel = VoiceMaturityLabels.CONTINUING_TO_LEARN;
  if (count < 3 || score < 35) maturityLabel = VoiceMaturityLabels.CONTINUING_TO_LEARN;
  else if (score < 60) maturityLabel = VoiceMaturityLabels.LIMITED;
  else maturityLabel = VoiceMaturityLabels.WELL_ESTABLISHED;

  return {
    score,
    breakdown,
    maturityLabel,
    maturityCopy: maturityCopyFor(maturityLabel),
  };
}
