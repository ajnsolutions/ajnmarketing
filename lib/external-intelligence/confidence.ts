/**
 * External Intelligence confidence model — never exaggerates.
 * Considers provider reliability, recency, corroboration, and evidence quality.
 */

import type { ConfidenceLevel } from "@/lib/external-intelligence/types";
import { ConfidenceLevels } from "@/lib/external-intelligence/types";

export type ExternalConfidenceInput = {
  evidenceCount: number;
  /** Distinct providers corroborating the same cluster. */
  providerCount: number;
  /** Average provider reliability (0–1). */
  averageReliability: number;
  /** Share of supporting evidence from the last 30 days (0–1). */
  recentShare: number;
  /** Average normalized evidence quality weight (0–1). */
  averageEvidenceQuality: number;
};

export function calculateExternalConfidence(input: ExternalConfidenceInput): ConfidenceLevel {
  const count = Math.max(0, input.evidenceCount);

  // Isolated, single-source, thin signals stay low — never overreact.
  if (count < 1) return ConfidenceLevels.LOW;
  if (count === 1 && input.providerCount < 2 && input.averageEvidenceQuality < 0.7) {
    return ConfidenceLevels.LOW;
  }

  let points = 0;

  if (count >= 4) points += 3;
  else if (count >= 2) points += 2;
  else points += 1;

  if (input.providerCount >= 3) points += 3;
  else if (input.providerCount >= 2) points += 2;

  if (input.averageReliability >= 0.8) points += 2;
  else if (input.averageReliability >= 0.65) points += 1;

  if (input.recentShare >= 0.5) points += 2;
  else if (input.recentShare >= 0.25) points += 1;

  if (input.averageEvidenceQuality >= 0.75) points += 2;
  else if (input.averageEvidenceQuality >= 0.55) points += 1;
  else points -= 1;

  if (points >= 10) return ConfidenceLevels.HIGH;
  if (points >= 5) return ConfidenceLevels.MEDIUM;
  return ConfidenceLevels.LOW;
}

export function rollupConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return ConfidenceLevels.LOW;
  const high = levels.filter((l) => l === ConfidenceLevels.HIGH).length;
  const medium = levels.filter((l) => l === ConfidenceLevels.MEDIUM).length;
  if (high >= levels.length / 2) return ConfidenceLevels.HIGH;
  if (high + medium >= levels.length / 2) return ConfidenceLevels.MEDIUM;
  return ConfidenceLevels.LOW;
}
