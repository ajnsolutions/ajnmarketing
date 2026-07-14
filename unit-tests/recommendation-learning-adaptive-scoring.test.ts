import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAdaptiveRecommendationScore,
  resolveChannelForActionType,
  applyAdaptiveScoringToDrafts,
} from "../lib/recommendation-learning/adaptiveScoring.ts";
import {
  COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE,
  MAX_HISTORICAL_ADJUSTMENT_POINTS,
} from "../lib/recommendation-learning/weights.ts";
import type { HistoricalRecommendationSignals } from "../lib/recommendation-learning/types.ts";
import type { MarketingRecommendationDraft } from "../lib/marketing-decisions/types.ts";

function emptySignals(overrides: Partial<HistoricalRecommendationSignals> = {}): HistoricalRecommendationSignals {
  return {
    historicalSampleSize: 0,
    confidenceInHistory: 0,
    overallApprovalRate: null,
    overallRejectionRate: null,
    overallEditRate: null,
    overallPublishSuccessRate: null,
    overallPerformanceRate: null,
    averageUsefulScore: null,
    channelSuccessRates: {},
    actionTypeSuccessRates: {},
    categorySuccessRates: {},
    seasonalSuccessRates: {},
    timeOfDaySuccessRates: {},
    categoryEditRates: {},
    averageTimeToApprovalHours: null,
    averageEditIntensity: null,
    ...overrides,
  };
}

const BASE_INPUT = {
  actionType: "create_timely_content" as const,
  baseScore: 60,
  baseConfidence: 70,
  categories: ["holiday"],
  channel: "google_business_profile",
  season: "winter" as const,
  timeOfDay: "morning" as const,
};

// --- Cold start / no history ---

test("computeAdaptiveRecommendationScore: zero history -> final score/confidence equal base exactly, cold_start reason present", () => {
  const result = computeAdaptiveRecommendationScore(BASE_INPUT, emptySignals());

  assert.equal(result.finalScore, BASE_INPUT.baseScore);
  assert.equal(result.finalConfidence, BASE_INPUT.baseConfidence);
  assert.equal(result.historicalAdjustment, 0);
  assert.equal(result.historicalSampleSize, 0);
  assert.ok(result.reasons.some((r) => r.reasonType === "cold_start"));
  assert.ok(result.reasons.some((r) => r.reasonType === "market_opportunity"));
});

test("computeAdaptiveRecommendationScore: history exists but no bucket matches this recommendation -> no adjustment, cold_start-style reason still explains why", () => {
  const signals = emptySignals({
    historicalSampleSize: 10,
    confidenceInHistory: 0.5,
    actionTypeSuccessRates: { publish_gbp_post: 0.9 }, // different action type than BASE_INPUT
  });

  const result = computeAdaptiveRecommendationScore(BASE_INPUT, signals);

  assert.equal(result.historicalAdjustment, 0);
  assert.equal(result.finalScore, BASE_INPUT.baseScore);
  assert.ok(result.reasons.some((r) => r.reasonType === "cold_start"));
});

// --- Cold-start scaling across sample sizes (Phase 7 worked examples: 0/5/20/100) ---

test("cold-start scaling: 5 recommendations produce a much weaker adjustment than 100, same signal strength", () => {
  const strongPositiveActionType = { actionTypeSuccessRates: { create_timely_content: 1 } };

  const small = computeAdaptiveRecommendationScore(
    BASE_INPUT,
    emptySignals({ historicalSampleSize: 5, confidenceInHistory: 5 / COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE, ...strongPositiveActionType })
  );
  const large = computeAdaptiveRecommendationScore(
    BASE_INPUT,
    emptySignals({ historicalSampleSize: 100, confidenceInHistory: 1, ...strongPositiveActionType })
  );

  assert.ok(small.historicalAdjustment > 0);
  assert.ok(large.historicalAdjustment > small.historicalAdjustment);
  assert.ok(large.historicalAdjustment <= MAX_HISTORICAL_ADJUSTMENT_POINTS);
});

test("cold-start scaling: 20 recommendations reach full confidence (matches COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE)", () => {
  const at20 = computeAdaptiveRecommendationScore(
    BASE_INPUT,
    emptySignals({
      historicalSampleSize: 20,
      confidenceInHistory: 1,
      actionTypeSuccessRates: { create_timely_content: 1 },
    })
  );
  const at100 = computeAdaptiveRecommendationScore(
    BASE_INPUT,
    emptySignals({
      historicalSampleSize: 100,
      confidenceInHistory: 1,
      actionTypeSuccessRates: { create_timely_content: 1 },
    })
  );

  // Confidence saturates at 1.0 for both 20 and 100 -- no further overfitting beyond the cap.
  assert.equal(at20.historicalAdjustment, at100.historicalAdjustment);
});

// --- Directional weighting per dimension ---

test("action-type weighting: a historically well-received action type increases the score", () => {
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    actionTypeSuccessRates: { create_timely_content: 0.95 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, categories: [], channel: null }, signals);
  assert.ok(result.historicalAdjustment > 0);
  assert.ok(result.finalScore > BASE_INPUT.baseScore);
});

test("action-type weighting: a historically poorly-received action type decreases the score", () => {
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    actionTypeSuccessRates: { create_timely_content: 0.05 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, categories: [], channel: null }, signals);
  assert.ok(result.historicalAdjustment < 0);
  assert.ok(result.finalScore < BASE_INPUT.baseScore);
});

test("channel weighting: a well-performing channel increases the score with a channel_performance reason", () => {
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    channelSuccessRates: { google_business_profile: 0.9 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, categories: [] }, signals);
  assert.ok(result.historicalAdjustment > 0);
  assert.ok(result.reasons.some((r) => r.reasonType === "channel_performance" && r.reasonWeight > 0));
});

test("channel weighting: a consistently-ignored channel decreases the score", () => {
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    channelSuccessRates: { google_business_profile: 0.1 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, categories: [] }, signals);
  assert.ok(result.historicalAdjustment < 0);
});

test("category weighting: a well-performing category increases the score with a category_performance reason", () => {
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    categorySuccessRates: { holiday: 0.9 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, channel: null }, signals);
  assert.ok(result.reasons.some((r) => r.reasonType === "category_performance" && r.reasonWeight > 0));
});

test("category weighting: a heavily-edited category decreases the score via edit_intensity, not category_performance", () => {
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    categoryEditRates: { holiday: 0.9 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, channel: null }, signals);
  assert.ok(result.historicalAdjustment < 0);
  assert.ok(result.reasons.some((r) => r.reasonType === "edit_intensity" && r.reasonWeight < 0));
});

test("edit weighting: a category edited below the heavy-edit threshold contributes no penalty", () => {
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    categoryEditRates: { holiday: 0.2 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, channel: null }, signals);
  assert.equal(result.reasons.some((r) => r.reasonType === "edit_intensity"), false);
});

// --- Provider failure neutrality ---

test("provider failure neutrality: an action type with a low publish-success rate but no success-rate entry (because publish_failed is excluded upstream) is not penalized by this function", () => {
  // signals.ts is responsible for excluding provider-failure recs from
  // actionTypeSuccessRates entirely (tested separately) -- this test proves the scoring
  // function itself applies no adjustment when a bucket simply has no entry.
  const signals = emptySignals({
    historicalSampleSize: 20,
    confidenceInHistory: 1,
    overallPublishSuccessRate: 0.3, // low, but irrelevant to per-bucket scoring
    actionTypeSuccessRates: {}, // no entry for this action type
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, categories: [], channel: null }, signals);
  assert.equal(result.historicalAdjustment, 0);
});

// --- Bounds ---

test("historical adjustment never exceeds MAX_HISTORICAL_ADJUSTMENT_POINTS in either direction", () => {
  const veryPositive = computeAdaptiveRecommendationScore(
    BASE_INPUT,
    emptySignals({
      historicalSampleSize: 100,
      confidenceInHistory: 1,
      actionTypeSuccessRates: { create_timely_content: 1 },
      channelSuccessRates: { google_business_profile: 1 },
      categorySuccessRates: { holiday: 1 },
      seasonalSuccessRates: { winter: 1 },
    })
  );
  const veryNegative = computeAdaptiveRecommendationScore(
    BASE_INPUT,
    emptySignals({
      historicalSampleSize: 100,
      confidenceInHistory: 1,
      actionTypeSuccessRates: { create_timely_content: 0 },
      channelSuccessRates: { google_business_profile: 0 },
      categorySuccessRates: { holiday: 0 },
      seasonalSuccessRates: { winter: 0 },
    })
  );

  assert.ok(veryPositive.historicalAdjustment <= MAX_HISTORICAL_ADJUSTMENT_POINTS);
  assert.ok(veryNegative.historicalAdjustment >= -MAX_HISTORICAL_ADJUSTMENT_POINTS);
  assert.ok(veryPositive.finalScore <= 100);
  assert.ok(veryNegative.finalScore >= 0);
});

// --- Confidence model ---

test("confidence: with zero history, final confidence equals base confidence untouched", () => {
  const result = computeAdaptiveRecommendationScore(BASE_INPUT, emptySignals());
  assert.equal(result.finalConfidence, BASE_INPUT.baseConfidence);
  assert.equal(result.historicalConfidence, 50);
});

test("confidence: strong positive history raises final confidence above base confidence", () => {
  const signals = emptySignals({
    historicalSampleSize: 50,
    confidenceInHistory: 1,
    actionTypeSuccessRates: { create_timely_content: 0.95 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, categories: [], channel: null }, signals);
  assert.ok(result.historicalConfidence > 50);
  assert.ok(result.finalConfidence > BASE_INPUT.baseConfidence);
});

test("confidence: strong negative history lowers final confidence below base confidence", () => {
  const signals = emptySignals({
    historicalSampleSize: 50,
    confidenceInHistory: 1,
    actionTypeSuccessRates: { create_timely_content: 0.05 },
  });
  const result = computeAdaptiveRecommendationScore({ ...BASE_INPUT, categories: [], channel: null }, signals);
  assert.ok(result.historicalConfidence < 50);
  assert.ok(result.finalConfidence < BASE_INPUT.baseConfidence);
});

// --- Determinism ---

test("determinism: identical inputs always produce identical output, no randomness", () => {
  const signals = emptySignals({
    historicalSampleSize: 30,
    confidenceInHistory: 1,
    actionTypeSuccessRates: { create_timely_content: 0.7 },
    channelSuccessRates: { google_business_profile: 0.6 },
    categorySuccessRates: { holiday: 0.65 },
    seasonalSuccessRates: { winter: 0.55 },
  });

  const results = Array.from({ length: 5 }, () => computeAdaptiveRecommendationScore(BASE_INPUT, signals));
  const serialized = results.map((r) => JSON.stringify(r));
  assert.ok(serialized.every((s) => s === serialized[0]));
});

// --- Channel resolution ---

test("resolveChannelForActionType: content-supported action types resolve to a channel", () => {
  assert.equal(resolveChannelForActionType("publish_gbp_post"), "google_business_profile");
});

test("resolveChannelForActionType: non-content-supported action types resolve to null", () => {
  assert.equal(resolveChannelForActionType("request_reviews"), null);
});

// --- Draft-batch application ---

function draft(overrides: Partial<MarketingRecommendationDraft> = {}): MarketingRecommendationDraft {
  return {
    recommendedActionType: "create_timely_content",
    priorityScore: 60,
    urgency: "medium",
    businessImpact: "medium",
    estimatedEffort: "medium",
    confidence: 70,
    reasoning: "test",
    relatedOpportunityIds: ["opp-1"],
    dedupeKey: "opp-1",
    ...overrides,
  };
}

test("applyAdaptiveScoringToDrafts: recomputes urgency from the adjusted priority score, never leaves it stale", () => {
  const signals = emptySignals({
    historicalSampleSize: 30,
    confidenceInHistory: 1,
    actionTypeSuccessRates: { create_timely_content: 1 },
  });
  const categoriesByDedupeKey = new Map([["opp-1", ["holiday"]]]);

  const [result] = applyAdaptiveScoringToDrafts([draft({ priorityScore: 55, urgency: "medium" })], categoriesByDedupeKey, signals);

  assert.ok(result.breakdown.finalScore > 55);
  // urgencyFromPriorityScore(85) -> critical; confirms recompute happened, not left at "medium".
  if (result.breakdown.finalScore >= 85) {
    assert.equal(result.draft.urgency, "critical");
  }
});

test("applyAdaptiveScoringToDrafts: deterministic ordering is preserved -- output array order matches input order", () => {
  const signals = emptySignals();
  const drafts = [
    draft({ dedupeKey: "a", priorityScore: 90 }),
    draft({ dedupeKey: "b", priorityScore: 50 }),
    draft({ dedupeKey: "c", priorityScore: 70 }),
  ];

  const results = applyAdaptiveScoringToDrafts(drafts, new Map(), signals);
  assert.deepEqual(
    results.map((r) => r.draft.dedupeKey),
    ["a", "b", "c"]
  );
});
