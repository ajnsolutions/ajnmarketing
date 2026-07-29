/**
 * Plan trust vocabulary — Observed / Likely / Recommended.
 * Distinct from Growth Advisor's Predicted / Suggested wording, but aligned in spirit.
 */

export const PlanTrustCertaintyLevels = {
  OBSERVED: "observed",
  LIKELY: "likely",
  RECOMMENDED: "recommended",
} as const;

export type PlanTrustCertainty =
  (typeof PlanTrustCertaintyLevels)[keyof typeof PlanTrustCertaintyLevels];

export const PLAN_TRUST_LABELS: Record<PlanTrustCertainty, string> = {
  observed: "Observed",
  likely: "Likely",
  recommended: "Recommended",
};

export function planTrustLabel(certainty: PlanTrustCertainty): string {
  return PLAN_TRUST_LABELS[certainty];
}
