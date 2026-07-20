/**
 * Deterministic outcome representation from existing KPI inputs — no ML/LLM.
 *
 * [Claude review, follow-up] Existing analytics capture one aggregate total per KPI per
 * business; there is no per-post/per-variant tag anywhere in analytics capture. Every
 * constructor in this module therefore produces an honest "aggregate observed, no
 * attribution" outcome: direction is always inconclusive or insufficient_data,
 * winningVariantKey is always null, confidence never exceeds "early", and
 * attributionAvailable is always false. `computeVariantComparisonOutcome` (the general
 * A-vs-B math engine from the original implementation) is kept for a future phase where
 * real per-variant attribution exists — see docs/MARKETING_EXPERIMENTATION_ENGINE.md
 * "Future attribution boundary" — but nothing in the current measurement path calls it.
 */

import {
  ExperimentConfidenceLevels,
  ExperimentOutcomeDirections,
  type ExperimentKpiMetric,
  type ExperimentMetrics,
  type ExperimentOutcome,
  type ExperimentVariant,
} from "@/lib/marketing-experimentation/experiment-types";

export function emptyExperimentMetrics(primaryMetric: ExperimentKpiMetric): ExperimentMetrics {
  return {
    primaryMetric,
    aggregateValue: null,
    measurementStart: null,
    measurementEnd: null,
  };
}

export function emptyExperimentOutcome(primaryMetric: ExperimentKpiMetric): ExperimentOutcome {
  return {
    direction: ExperimentOutcomeDirections.INSUFFICIENT_DATA,
    confidenceLevel: ExperimentConfidenceLevels.INSUFFICIENT,
    winningVariantKey: null,
    summary: "Not enough measured data yet.",
    primaryMetric,
    liftPercent: null,
    attributionAvailable: false,
  };
}

/**
 * The only outcome constructor the live measurement path (experiment-service.ts's
 * measureExperimentForUser) uses. Deterministic: identical aggregateValue + window
 * always produce an identical outcome. Never claims a winner, never exceeds "early"
 * confidence, regardless of how large aggregateValue is — magnitude of an
 * undifferentiated aggregate is not evidence about a variant, so it cannot legitimately
 * raise confidence.
 */
export function aggregateObservedOutcome(input: {
  primaryMetric: ExperimentKpiMetric;
  aggregateValue: number | null;
  measurementStart: string;
  measurementEnd: string;
}): ExperimentOutcome {
  if (input.aggregateValue === null) {
    return {
      ...emptyExperimentOutcome(input.primaryMetric),
      summary: "No analytics were available for this measurement window.",
    };
  }

  return {
    direction: ExperimentOutcomeDirections.INCONCLUSIVE,
    confidenceLevel: ExperimentConfidenceLevels.EARLY,
    winningVariantKey: null,
    summary:
      "Aggregate performance was observed for this measurement window, but variant attribution is unavailable — this business's analytics do not yet record which result belongs to the control or treatment definition, so no variant can be credited or blamed for it.",
    primaryMetric: input.primaryMetric,
    liftPercent: null,
    attributionAvailable: false,
  };
}

function metricPair(
  metrics: {
    engagementA: number;
    engagementB: number;
    clicksA: number;
    clicksB: number;
    reviewsA: number;
    reviewsB: number;
    reachA: number;
    reachB: number;
    conversionsA: number;
    conversionsB: number;
    publishingConsistencyA: number;
    publishingConsistencyB: number;
  },
  primary: ExperimentKpiMetric,
): { a: number; b: number } {
  switch (primary) {
    case "engagement":
      return { a: metrics.engagementA, b: metrics.engagementB };
    case "clicks":
      return { a: metrics.clicksA, b: metrics.clicksB };
    case "reviews":
      return { a: metrics.reviewsA, b: metrics.reviewsB };
    case "reach":
      return { a: metrics.reachA, b: metrics.reachB };
    case "conversions":
      return { a: metrics.conversionsA, b: metrics.conversionsB };
    case "publishingConsistency":
      return { a: metrics.publishingConsistencyA, b: metrics.publishingConsistencyB };
    default:
      return { a: metrics.engagementA, b: metrics.engagementB };
  }
}

function confidenceForSample(total: number, liftAbs: number): ExperimentOutcome["confidenceLevel"] {
  if (total < 10) return ExperimentConfidenceLevels.INSUFFICIENT;
  if (total < 40 || liftAbs < 0.05) return ExperimentConfidenceLevels.EARLY;
  if (total < 100 || liftAbs < 0.15) return ExperimentConfidenceLevels.MODERATE;
  return ExperimentConfidenceLevels.STRONG;
}

/**
 * General-purpose A-vs-B comparison math — NOT called anywhere in the current
 * measurement path. Kept for the future phase where real per-variant attribution exists
 * (see docs/MARKETING_EXPERIMENTATION_ENGINE.md "Future attribution boundary"): once
 * publishing/analytics capture can tag a result with the variant that produced it, this
 * function is what would compare them. Requires genuinely separate perVariantA/
 * perVariantB inputs — do not call this with two copies of one aggregate value.
 */
export function computeVariantComparisonOutcome(input: {
  perVariantMetrics: {
    engagementA: number;
    engagementB: number;
    clicksA: number;
    clicksB: number;
    reviewsA: number;
    reviewsB: number;
    reachA: number;
    reachB: number;
    conversionsA: number;
    conversionsB: number;
    publishingConsistencyA: number;
    publishingConsistencyB: number;
  };
  variants: ExperimentVariant[];
  primaryMetric: ExperimentKpiMetric;
}): ExperimentOutcome {
  const control = input.variants.find((variant) => variant.key === "control") ?? input.variants[0];
  const treatment = input.variants.find((variant) => variant.key === "treatment") ?? input.variants[1];
  const { a, b } = metricPair(input.perVariantMetrics, input.primaryMetric);
  const total = a + b;

  if (!control || !treatment || total <= 0) {
    return { ...emptyExperimentOutcome(input.primaryMetric), attributionAvailable: true };
  }

  const denom = Math.max(a, b, 1);
  const liftPercent = Math.round(((a - b) / denom) * 1000) / 10;
  const liftAbs = Math.abs(a - b) / denom;
  const confidenceLevel = confidenceForSample(total, liftAbs);

  if (confidenceLevel === ExperimentConfidenceLevels.INSUFFICIENT || Math.abs(a - b) < 1e-9) {
    return {
      direction: ExperimentOutcomeDirections.INCONCLUSIVE,
      confidenceLevel:
        total < 10 ? ExperimentConfidenceLevels.INSUFFICIENT : ExperimentConfidenceLevels.EARLY,
      winningVariantKey: null,
      summary:
        total < 10
          ? "Not enough measured data yet to compare variants."
          : "Variants performed similarly on the primary metric.",
      primaryMetric: input.primaryMetric,
      liftPercent: Math.abs(liftPercent) < 0.05 ? 0 : liftPercent,
      attributionAvailable: true,
    };
  }

  if (a > b) {
    return {
      direction: ExperimentOutcomeDirections.VARIANT_A,
      confidenceLevel,
      winningVariantKey: control.key,
      summary: `${control.label} outperformed ${treatment.label} on ${input.primaryMetric}.`,
      primaryMetric: input.primaryMetric,
      liftPercent,
      attributionAvailable: true,
    };
  }

  return {
    direction: ExperimentOutcomeDirections.VARIANT_B,
    confidenceLevel,
    winningVariantKey: treatment.key,
    summary: `${treatment.label} outperformed ${control.label} on ${input.primaryMetric}.`,
    primaryMetric: input.primaryMetric,
    liftPercent: -liftPercent,
    attributionAvailable: true,
  };
}
