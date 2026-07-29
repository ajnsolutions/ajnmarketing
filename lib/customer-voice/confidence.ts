/**
 * Theme confidence model — never exaggerates.
 */

import type { ConfidenceLevel } from "@/lib/customer-voice/types";
import { ConfidenceLevels } from "@/lib/customer-voice/types";

export type ThemeConfidenceInput = {
  evidenceCount: number;
  totalEvidence: number;
  /** Distinct providers contributing — multi-source strengthens confidence. */
  providerCount: number;
  /** Share of supporting evidence from the last 90 days (0–1). */
  recentShare: number;
  /** Consistency: share of supporting evidence with the same sentiment polarity (0–1). */
  consistency: number;
};

export type ThemeConfidenceResult = {
  confidence: ConfidenceLevel;
  percentageOfReviews: number;
};

export function calculateThemeConfidence(input: ThemeConfidenceInput): ThemeConfidenceResult {
  const total = Math.max(0, input.totalEvidence);
  const count = Math.max(0, input.evidenceCount);
  const percentage = total === 0 ? 0 : Math.round((count / total) * 1000) / 10;

  // Isolated mentions stay low — never overreact.
  if (count < 2 || percentage < 5) {
    return { confidence: ConfidenceLevels.LOW, percentageOfReviews: percentage };
  }

  let points = 0;
  if (count >= 8) points += 3;
  else if (count >= 4) points += 2;
  else points += 1;

  if (percentage >= 25) points += 3;
  else if (percentage >= 12) points += 2;
  else if (percentage >= 5) points += 1;

  if (input.providerCount >= 2) points += 2;
  if (input.recentShare >= 0.4) points += 1;
  if (input.consistency >= 0.7) points += 1;
  else if (input.consistency < 0.45) points -= 1;

  if (points >= 8) return { confidence: ConfidenceLevels.HIGH, percentageOfReviews: percentage };
  if (points >= 4) return { confidence: ConfidenceLevels.MEDIUM, percentageOfReviews: percentage };
  return { confidence: ConfidenceLevels.LOW, percentageOfReviews: percentage };
}

export function rollupConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return ConfidenceLevels.LOW;
  const high = levels.filter((l) => l === ConfidenceLevels.HIGH).length;
  const medium = levels.filter((l) => l === ConfidenceLevels.MEDIUM).length;
  if (high >= levels.length / 2) return ConfidenceLevels.HIGH;
  if (high + medium >= levels.length / 2) return ConfidenceLevels.MEDIUM;
  return ConfidenceLevels.LOW;
}
