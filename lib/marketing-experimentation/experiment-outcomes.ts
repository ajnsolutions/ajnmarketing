/**
 * Deterministic outcome calculation from existing KPI inputs — no ML/LLM.
 */

import {
  ExperimentConfidenceLevels,
  ExperimentOutcomeDirections,
  type ExperimentMetrics,
  type ExperimentOutcome,
  type ExperimentVariant,
} from "@/lib/marketing-experimentation/experiment-types";

export function emptyExperimentMetrics(): ExperimentMetrics {
  return {
    engagementA: 0,
    engagementB: 0,
    clicksA: 0,
    clicksB: 0,
    reviewsA: 0,
    reviewsB: 0,
    reachA: 0,
    reachB: 0,
    conversionsA: 0,
    conversionsB: 0,
    publishingConsistencyA: 0,
    publishingConsistencyB: 0,
  };
}

export function emptyExperimentOutcome(): ExperimentOutcome {
  return {
    direction: ExperimentOutcomeDirections.INSUFFICIENT_DATA,
    confidenceLevel: ExperimentConfidenceLevels.INSUFFICIENT,
    winningVariantKey: null,
    summary: "Not enough measured data yet.",
    primaryMetric: "engagement",
    liftPercent: null,
  };
}

function metricPair(
  metrics: ExperimentMetrics,
  primary: ExperimentOutcome["primaryMetric"],
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
      return {
        a: metrics.publishingConsistencyA,
        b: metrics.publishingConsistencyB,
      };
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
 * Compare A/B variant metrics for one primary KPI.
 * Identical inputs always produce identical outcomes.
 */
export function computeExperimentOutcome(input: {
  metrics: ExperimentMetrics;
  variants: ExperimentVariant[];
  primaryMetric: ExperimentOutcome["primaryMetric"];
}): ExperimentOutcome {
  const variantA = input.variants.find((variant) => variant.key === "a") ?? input.variants[0];
  const variantB = input.variants.find((variant) => variant.key === "b") ?? input.variants[1];
  const { a, b } = metricPair(input.metrics, input.primaryMetric);
  const total = a + b;

  if (!variantA || !variantB || total <= 0) {
    return {
      ...emptyExperimentOutcome(),
      primaryMetric: input.primaryMetric,
    };
  }

  const denom = Math.max(a, b, 1);
  const liftPercent = Math.round(((a - b) / denom) * 1000) / 10;
  const liftAbs = Math.abs(a - b) / denom;
  const confidenceLevel = confidenceForSample(total, liftAbs);

  if (confidenceLevel === ExperimentConfidenceLevels.INSUFFICIENT || Math.abs(a - b) < 1e-9) {
    return {
      direction: ExperimentOutcomeDirections.INCONCLUSIVE,
      confidenceLevel:
        total < 10
          ? ExperimentConfidenceLevels.INSUFFICIENT
          : ExperimentConfidenceLevels.EARLY,
      winningVariantKey: null,
      summary:
        total < 10
          ? "Not enough measured data yet to compare variants."
          : "Variants performed similarly on the primary metric.",
      primaryMetric: input.primaryMetric,
      liftPercent: Math.abs(liftPercent) < 0.05 ? 0 : liftPercent,
    };
  }

  if (a > b) {
    return {
      direction: ExperimentOutcomeDirections.VARIANT_A,
      confidenceLevel,
      winningVariantKey: variantA.key,
      summary: `${variantA.label} outperformed ${variantB.label} on ${input.primaryMetric}.`,
      primaryMetric: input.primaryMetric,
      liftPercent,
    };
  }

  return {
    direction: ExperimentOutcomeDirections.VARIANT_B,
    confidenceLevel,
    winningVariantKey: variantB.key,
    summary: `${variantB.label} outperformed ${variantA.label} on ${input.primaryMetric}.`,
    primaryMetric: input.primaryMetric,
    liftPercent: -liftPercent,
  };
}

export type VariantMetricInput = {
  engagement: number;
  clicks: number;
  reviews: number;
  reach: number;
  conversions: number;
  publishingConsistency: number;
};

/** Map two analytics-like snapshots into A/B metric buckets deterministically. */
export function metricsFromAnalyticsPair(input: {
  variantA: VariantMetricInput;
  variantB: VariantMetricInput;
}): ExperimentMetrics {
  return {
    engagementA: input.variantA.engagement,
    engagementB: input.variantB.engagement,
    clicksA: input.variantA.clicks,
    clicksB: input.variantB.clicks,
    reviewsA: input.variantA.reviews,
    reviewsB: input.variantB.reviews,
    reachA: input.variantA.reach,
    reachB: input.variantB.reach,
    conversionsA: input.variantA.conversions,
    conversionsB: input.variantB.conversions,
    publishingConsistencyA: input.variantA.publishingConsistency,
    publishingConsistencyB: input.variantB.publishingConsistency,
  };
}
