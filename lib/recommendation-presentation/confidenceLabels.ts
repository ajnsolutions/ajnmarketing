/**
 * Deterministic, client-friendly confidence presentation. Never shows a raw percentage
 * -- only a plain-language label paired with an explanation, per this milestone's
 * "never imply certainty unsupported by the data" requirement.
 *
 * Cold-start aware: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON (reused from
 * lib/recommendation-learning/weights.ts, not duplicated) is the same threshold PR #28
 * already uses to decide whether a historical bucket is trustworthy enough to name --
 * below it, this always resolves to "Still learning" regardless of the underlying
 * (possibly high) raw confidence number, since that number isn't yet backed by enough
 * of this business's own history to make a strong claim.
 */

import { MIN_BUCKET_SAMPLE_SIZE_FOR_REASON } from "@/lib/recommendation-learning/weights";
import { ConfidenceLabels, type ConfidenceLabel } from "@/lib/recommendation-presentation/types";

const STRONG_THRESHOLD = 80;
const GOOD_THRESHOLD = 60;

const CONFIDENCE_LABEL_TEXT: Record<ConfidenceLabel, string> = {
  [ConfidenceLabels.STRONG_RECOMMENDATION]: "Strong recommendation",
  [ConfidenceLabels.GOOD_OPPORTUNITY]: "Good opportunity",
  [ConfidenceLabels.WORTH_CONSIDERING]: "Worth considering",
  [ConfidenceLabels.STILL_LEARNING]: "Still learning",
};

const CONFIDENCE_EXPLANATIONS: Record<ConfidenceLabel, string> = {
  [ConfidenceLabels.STRONG_RECOMMENDATION]:
    "Based on how similar recommendations have performed for your business, this one has a strong track record.",
  [ConfidenceLabels.GOOD_OPPORTUNITY]:
    "Current signals and your past results both point in a positive direction.",
  [ConfidenceLabels.WORTH_CONSIDERING]:
    "This lines up with a real opportunity, though the evidence for your business specifically is mixed or limited.",
  [ConfidenceLabels.STILL_LEARNING]:
    "We don't have enough history with your business yet to say how well this typically performs -- your feedback and results help us learn.",
};

export function resolveConfidenceLabel(input: {
  finalConfidence: number;
  historicalSampleSize: number;
}): ConfidenceLabel {
  if (input.historicalSampleSize < MIN_BUCKET_SAMPLE_SIZE_FOR_REASON) {
    return ConfidenceLabels.STILL_LEARNING;
  }
  if (input.finalConfidence >= STRONG_THRESHOLD) {
    return ConfidenceLabels.STRONG_RECOMMENDATION;
  }
  if (input.finalConfidence >= GOOD_THRESHOLD) {
    return ConfidenceLabels.GOOD_OPPORTUNITY;
  }
  return ConfidenceLabels.WORTH_CONSIDERING;
}

export function confidenceLabelText(label: ConfidenceLabel): string {
  return CONFIDENCE_LABEL_TEXT[label];
}

export function confidenceExplanation(label: ConfidenceLabel): string {
  return CONFIDENCE_EXPLANATIONS[label];
}
