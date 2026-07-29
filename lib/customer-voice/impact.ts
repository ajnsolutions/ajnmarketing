/**
 * Business Impact model — frequency alone does not imply high impact.
 */

import type { BusinessImpactLevel, ThemeKind } from "@/lib/customer-voice/types";
import { BusinessImpactLevels, ThemeKinds } from "@/lib/customer-voice/types";

export type ThemeImpactInput = {
  kind: ThemeKind;
  impactHints: readonly string[];
  evidenceCount: number;
  percentageOfReviews: number;
  confidence: import("@/lib/customer-voice/types").ConfidenceLevel;
};

const HINT_WEIGHT: Record<string, number> = {
  acquisition: 3,
  conversion: 3,
  referrals: 3,
  reputation: 2,
  repeat: 2,
};

/**
 * High frequency ≠ high impact. A common "friendly staff" theme may be medium
 * impact, while a rarer "pricing unclear" concern can be high for conversion.
 */
export function calculateBusinessImpact(input: ThemeImpactInput): BusinessImpactLevel {
  let score = 0;

  for (const hint of input.impactHints) {
    score += HINT_WEIGHT[hint] ?? 1;
  }

  if (input.kind === ThemeKinds.CONCERN || input.kind === ThemeKinds.REQUEST) {
    score += 2;
  }
  if (input.kind === ThemeKinds.OPPORTUNITY) {
    score += 1;
  }
  if (input.kind === ThemeKinds.DIFFERENTIATOR) {
    score += 1;
  }

  // Rare but conversion-critical concerns punch above frequency.
  if (
    (input.kind === ThemeKinds.CONCERN || input.kind === ThemeKinds.REQUEST) &&
    input.percentageOfReviews >= 8 &&
    input.evidenceCount >= 2
  ) {
    score += 2;
  }

  // Very frequent praise without conversion hints stays moderated.
  if (
    input.kind === ThemeKinds.STRENGTH &&
    input.percentageOfReviews >= 40 &&
    !input.impactHints.includes("conversion") &&
    !input.impactHints.includes("acquisition")
  ) {
    score -= 1;
  }

  if (input.confidence === "low" && input.evidenceCount < 3) {
    score -= 2;
  }

  if (score >= 8) return BusinessImpactLevels.HIGH;
  if (score >= 4) return BusinessImpactLevels.MEDIUM;
  return BusinessImpactLevels.LOW;
}

export function rollupBusinessImpact(levels: BusinessImpactLevel[]): BusinessImpactLevel {
  if (levels.length === 0) return BusinessImpactLevels.LOW;
  if (levels.includes(BusinessImpactLevels.HIGH)) return BusinessImpactLevels.HIGH;
  if (levels.includes(BusinessImpactLevels.MEDIUM)) return BusinessImpactLevels.MEDIUM;
  return BusinessImpactLevels.LOW;
}
