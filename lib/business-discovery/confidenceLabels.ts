/**
 * Plain-language presentation for the Business Confidence Score. Mirrors the
 * established rule in lib/recommendation-presentation/confidenceLabels.ts:
 * never show a raw percentage to a customer — only a deterministic label paired
 * with an honest explanation.
 *
 * The score itself (see buildResult.ts) is a simple, transparent composite of
 * how many core BusinessDiscoveryResult fields resolved Known vs. Assumed vs.
 * Missing. It intentionally does not use any AI-derived weighting — an owner
 * should never see their own understanding-of-their-business summarized by an
 * opaque model output.
 */

import { BusinessConfidenceLabels, type BusinessConfidenceLabel } from "@/lib/business-discovery/types";

const DEEP_THRESHOLD = 85;
const GOOD_THRESHOLD = 60;
const BUILDING_THRESHOLD = 30;

const LABEL_TEXT: Record<BusinessConfidenceLabel, string> = {
  [BusinessConfidenceLabels.JUST_GETTING_STARTED]: "Just getting started",
  [BusinessConfidenceLabels.BUILDING_A_PICTURE]: "Building a picture",
  [BusinessConfidenceLabels.GOOD_UNDERSTANDING]: "Good understanding",
  [BusinessConfidenceLabels.DEEP_UNDERSTANDING]: "Deep understanding",
};

const LABEL_EXPLANATIONS: Record<BusinessConfidenceLabel, string> = {
  [BusinessConfidenceLabels.JUST_GETTING_STARTED]:
    "We don't have much to go on yet — connecting a website or Google Business Profile will help a lot.",
  [BusinessConfidenceLabels.BUILDING_A_PICTURE]:
    "We're starting to understand your business, but several important details are still missing.",
  [BusinessConfidenceLabels.GOOD_UNDERSTANDING]:
    "We have a solid read on your business, with a few gaps left to fill in.",
  [BusinessConfidenceLabels.DEEP_UNDERSTANDING]:
    "We have a thorough, well-evidenced understanding of your business.",
};

/**
 * Deterministic score -> label mapping. Pure and total: every score in [0, 100]
 * resolves to exactly one label.
 */
export function resolveBusinessConfidenceLabel(score: number): BusinessConfidenceLabel {
  if (score >= DEEP_THRESHOLD) return BusinessConfidenceLabels.DEEP_UNDERSTANDING;
  if (score >= GOOD_THRESHOLD) return BusinessConfidenceLabels.GOOD_UNDERSTANDING;
  if (score >= BUILDING_THRESHOLD) return BusinessConfidenceLabels.BUILDING_A_PICTURE;
  return BusinessConfidenceLabels.JUST_GETTING_STARTED;
}

export function businessConfidenceLabelText(label: BusinessConfidenceLabel): string {
  return LABEL_TEXT[label];
}

export function businessConfidenceExplanation(label: BusinessConfidenceLabel): string {
  return LABEL_EXPLANATIONS[label];
}
