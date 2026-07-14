import test from "node:test";
import assert from "node:assert/strict";
import {
  confidenceExplanation,
  confidenceLabelText,
  resolveConfidenceLabel,
} from "../lib/recommendation-presentation/confidenceLabels.ts";
import { getExpectedBenefit } from "../lib/recommendation-presentation/expectedBenefit.ts";
import {
  buildSupportingReasons,
  translateHistoricalReasons,
  translateOpportunityCategoryReasons,
} from "../lib/recommendation-presentation/reasonTranslation.ts";
import { presentOutcomeStatus } from "../lib/recommendation-presentation/outcomeStatus.ts";
import { MIN_BUCKET_SAMPLE_SIZE_FOR_REASON } from "../lib/recommendation-learning/weights.ts";
import type { AdaptiveScoreBreakdown } from "../lib/recommendation-learning/types.ts";
import type { RecommendationOutcomeSummary } from "../lib/recommendation-outcomes/types.ts";

function breakdown(overrides: Partial<AdaptiveScoreBreakdown> = {}): AdaptiveScoreBreakdown {
  return {
    baseScore: 60,
    baseConfidence: 70,
    historicalAdjustment: 0,
    historicalConfidence: 50,
    finalScore: 60,
    finalConfidence: 70,
    reasons: [{ reasonType: "market_opportunity", reasonWeight: 60, reasonDescription: "x", reasonSource: "market" }],
    historicalSampleSize: 0,
    ...overrides,
  };
}

function outcomeSummary(overrides: Partial<RecommendationOutcomeSummary> = {}): RecommendationOutcomeSummary {
  return {
    recommendationId: "rec-1",
    contentApprovalId: "approval-1",
    lifecycleStatus: "awaiting_review",
    draftCreatedAt: "2026-01-01T00:00:00.000Z",
    wasEdited: false,
    editCount: 0,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    rejectionReasonCode: null,
    publishingJobId: null,
    publishingStatus: null,
    publishedAt: null,
    publishingFailureCategory: null,
    performanceStatus: "not_applicable",
    measuredAt: null,
    performanceMetrics: null,
    usefulnessSignal: "unknown",
    lastEventAt: null,
    ...overrides,
  };
}

// --- Confidence labels ---

test("resolveConfidenceLabel: zero/small history always resolves to still_learning regardless of raw confidence", () => {
  assert.equal(
    resolveConfidenceLabel({ finalConfidence: 95, historicalSampleSize: 0 }),
    "still_learning"
  );
  assert.equal(
    resolveConfidenceLabel({ finalConfidence: 95, historicalSampleSize: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON - 1 }),
    "still_learning"
  );
});

test("resolveConfidenceLabel: established history uses the confidence thresholds", () => {
  assert.equal(
    resolveConfidenceLabel({ finalConfidence: 85, historicalSampleSize: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON }),
    "strong_recommendation"
  );
  assert.equal(
    resolveConfidenceLabel({ finalConfidence: 65, historicalSampleSize: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON }),
    "good_opportunity"
  );
  assert.equal(
    resolveConfidenceLabel({ finalConfidence: 30, historicalSampleSize: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON }),
    "worth_considering"
  );
});

test("confidenceLabelText / confidenceExplanation: every label has plain-language text, never a raw number", () => {
  for (const label of ["strong_recommendation", "good_opportunity", "worth_considering", "still_learning"] as const) {
    const text = confidenceLabelText(label);
    const explanation = confidenceExplanation(label);
    assert.ok(text.length > 0);
    assert.ok(explanation.length > 0);
    assert.equal(/\d+%/.test(text), false, `label text "${text}" should never contain a raw percentage`);
    assert.equal(/\d+%/.test(explanation), false, `explanation "${explanation}" should never contain a raw percentage`);
  }
});

// --- Expected benefit ---

test("getExpectedBenefit: every action type maps to plain-language text with no fabricated numeric claims", () => {
  const actionTypes = [
    "publish_gbp_post",
    "request_reviews",
    "create_seasonal_content",
    "create_timely_content",
    "increase_posting_frequency",
    "update_business_info",
    "upload_photos",
    "refresh_website_content",
  ] as const;

  for (const actionType of actionTypes) {
    const benefit = getExpectedBenefit(actionType);
    assert.ok(benefit.length > 0);
    assert.equal(/\$\d/.test(benefit), false, "must never claim a dollar figure");
    assert.equal(/\d+%/.test(benefit), false, "must never claim a percentage increase");
    assert.equal(/\d+ leads?/i.test(benefit), false, "must never claim a specific lead count");
  }
});

// --- Reason translation ---

test("translateOpportunityCategoryReasons: maps real categories to grounded plain-language text, dedupes repeats", () => {
  const reasons = translateOpportunityCategoryReasons(["weather", "weather", "holiday"]);
  assert.equal(reasons.length, 2);
  assert.ok(reasons.some((r) => r.text.toLowerCase().includes("weather")));
  assert.ok(reasons.some((r) => r.text.toLowerCase().includes("holiday")));
});

test("translateHistoricalReasons: below the minimum sample size, returns only a single 'still learning' reason regardless of signal direction", () => {
  const smallSample = breakdown({
    historicalSampleSize: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON - 1,
    reasons: [
      { reasonType: "market_opportunity", reasonWeight: 60, reasonDescription: "x", reasonSource: "market" },
      { reasonType: "action_type_performance", reasonWeight: 20, reasonDescription: "internal 91%", reasonSource: "history" },
    ],
  });

  const reasons = translateHistoricalReasons(smallSample);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0].text, /still learning/i);
});

test("translateHistoricalReasons: established history translates each dimension by sign, never echoing the internal description/weight", () => {
  const established = breakdown({
    historicalSampleSize: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON + 5,
    reasons: [
      { reasonType: "market_opportunity", reasonWeight: 60, reasonDescription: "Current market opportunity score: 60/100", reasonSource: "market" },
      { reasonType: "action_type_performance", reasonWeight: 8, reasonDescription: "91% historically", reasonSource: "history" },
      { reasonType: "channel_performance", reasonWeight: -5, reasonDescription: "12% historically", reasonSource: "history" },
    ],
  });

  const reasons = translateHistoricalReasons(established);
  assert.equal(reasons.length, 2); // market_opportunity is excluded
  assert.ok(reasons.some((r) => /approved recommendations like this most of the time/i.test(r.text)));
  assert.ok(reasons.some((r) => /hasn't performed as strongly/i.test(r.text)));
  for (const reason of reasons) {
    assert.equal(reason.text.includes("91%"), false);
    assert.equal(reason.text.includes("12%"), false);
    assert.equal(reason.text.includes("60/100"), false);
  }
});

test("translateHistoricalReasons: edit_intensity always translates as a cautionary, negative reason", () => {
  const withEdits = breakdown({
    historicalSampleSize: MIN_BUCKET_SAMPLE_SIZE_FOR_REASON + 5,
    reasons: [
      { reasonType: "market_opportunity", reasonWeight: 60, reasonDescription: "x", reasonSource: "market" },
      { reasonType: "edit_intensity", reasonWeight: -6, reasonDescription: "90% edited", reasonSource: "history" },
    ],
  });

  const reasons = translateHistoricalReasons(withEdits);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0].text, /edits?/i);
});

test("buildSupportingReasons: caps combined market + historical reasons at 4", () => {
  const manyCategories = [
    "missing_gbp_posts",
    "low_review_activity",
    "seasonal",
    "holiday",
    "weather",
  ] as const;
  const result = buildSupportingReasons([...manyCategories], breakdown({ historicalSampleSize: 0 }));
  assert.ok(result.length <= 4);
});

// --- Outcome status presentation ---

test("presentOutcomeStatus: awaiting_review maps to 'Ready for review', or 'Edited' if wasEdited", () => {
  assert.equal(presentOutcomeStatus(outcomeSummary({ lifecycleStatus: "awaiting_review", wasEdited: false })).label, "Ready for review");
  assert.equal(presentOutcomeStatus(outcomeSummary({ lifecycleStatus: "awaiting_review", wasEdited: true })).label, "Edited");
});

test("presentOutcomeStatus: publish_failed is presented as an operational issue, never a recommendation-quality failure", () => {
  const status = presentOutcomeStatus(outcomeSummary({ lifecycleStatus: "publish_failed" }));
  assert.equal(status.label, "Publishing needs attention");
  assert.equal(status.isOperationalIssue, true);
  assert.match(status.detail ?? "", /does not affect the quality/i);
});

test("presentOutcomeStatus: every other lifecycle status maps to a plain, non-operational label", () => {
  const cases: Array<[RecommendationOutcomeSummary["lifecycleStatus"], string]> = [
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["publishing_queued", "Scheduled"],
    ["publishing", "Publishing"],
    ["published", "Published"],
    ["measured", "Performance measured"],
  ];

  for (const [lifecycleStatus, expectedLabel] of cases) {
    const status = presentOutcomeStatus(outcomeSummary({ lifecycleStatus }));
    assert.equal(status.label, expectedLabel);
    assert.equal(status.isOperationalIssue, false);
  }
});
