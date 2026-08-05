/**
 * Deterministic, plain-language presentation for CompetitorObservationConfidence
 * -- mirrors the established rule in lib/recommendation-presentation/confidenceLabels.ts
 * ("never show a raw score or raw internal label to a customer"). Observation
 * confidence is already a discrete low/medium/high level decided by
 * lib/competitor-observations/scoring.ts, not a numeric score, so there's no
 * resolve-from-number step here — just the label/explanation lookup.
 *
 * Deliberately its own small module rather than reusing
 * lib/recommendation-presentation/confidenceLabels.ts's label set directly:
 * those labels ("Strong recommendation", "Good opportunity") are written for
 * a recommendation the product is proposing, not a factual observation about
 * a competitor -- reusing that copy verbatim here would misleadingly imply
 * Business Pulse is recommending something. This follows the same pattern
 * (deterministic map, plain label + honest explanation, never a raw score or
 * raw enum string) with wording that actually fits an observation.
 */

import {
  CompetitorObservationConfidences,
  type CompetitorObservationConfidence,
} from "@/lib/competitor-observations/types";

const CONFIDENCE_LABEL_TEXT: Record<CompetitorObservationConfidence, string> = {
  [CompetitorObservationConfidences.HIGH]: "Strong evidence",
  [CompetitorObservationConfidences.MEDIUM]: "Moderate evidence",
  [CompetitorObservationConfidences.LOW]: "Early signal",
};

const CONFIDENCE_EXPLANATIONS: Record<CompetitorObservationConfidence, string> = {
  [CompetitorObservationConfidences.HIGH]:
    "This is well-supported by the information available -- the strongest evidence Market Radar currently produces.",
  [CompetitorObservationConfidences.MEDIUM]:
    "This comes from real, self-reported business information, though it hasn't been independently confirmed.",
  [CompetitorObservationConfidences.LOW]:
    "This is an early signal worth knowing about, but the evidence behind it is limited.",
};

export function confidenceLabelText(confidence: CompetitorObservationConfidence): string {
  return CONFIDENCE_LABEL_TEXT[confidence];
}

export function confidenceExplanation(confidence: CompetitorObservationConfidence): string {
  return CONFIDENCE_EXPLANATIONS[confidence];
}
