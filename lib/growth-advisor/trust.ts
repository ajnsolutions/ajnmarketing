/**
 * Trust vocabulary for Growth Advisor Experience.
 * Separates Observed / Likely / Predicted / Suggested — never overstates certainty.
 */

export const TrustCertaintyLevels = {
  OBSERVED: "observed",
  LIKELY: "likely",
  PREDICTED: "predicted",
  SUGGESTED: "suggested",
} as const;

export type TrustCertainty =
  (typeof TrustCertaintyLevels)[keyof typeof TrustCertaintyLevels];

export const TRUST_CERTAINTY_LABELS: Record<TrustCertainty, string> = {
  observed: "Observed",
  likely: "Likely",
  predicted: "Predicted",
  suggested: "Suggested",
};

export function trustLabel(certainty: TrustCertainty): string {
  return TRUST_CERTAINTY_LABELS[certainty];
}
