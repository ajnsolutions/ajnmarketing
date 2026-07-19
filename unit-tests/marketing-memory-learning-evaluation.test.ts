import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRecommendationActionOutcome,
  evaluateTimingPerformance,
  type ActionOutcomeEvidenceRow,
  type PerformanceEvidenceRow,
} from "../lib/marketing-memory/learningEvaluation.ts";
import { containsForbiddenTerm } from "../lib/marketing-memory/rationale.ts";
import {
  LearningConfidenceLevels,
  LearningDirections,
  LearningFamilies,
  LearningMetricKeys,
  LearningStatuses,
  TimeDimensions,
} from "../lib/marketing-memory/learningTypes.ts";

function perfRow(overrides: Partial<PerformanceEvidenceRow>): PerformanceEvidenceRow {
  return {
    observationId: "obs",
    occurredAt: "2026-06-04T09:00:00Z",
    performanceScore: 50,
    dayOfWeek: "thursday",
    month: 6,
    season: "summer",
    ...overrides,
  };
}

function actionRow(overrides: Partial<ActionOutcomeEvidenceRow>): ActionOutcomeEvidenceRow {
  return {
    observationId: "obs",
    occurredAt: "2026-06-04T09:00:00Z",
    approved: true,
    actionType: "create_seasonal_content",
    ...overrides,
  };
}

// --- timing_performance ---------------------------------------------------------------

test("evaluateTimingPerformance: produces separate learnings per time dimension (day/month/season are not conflated)", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: PerformanceEvidenceRow[] = [
    perfRow({ observationId: "a", performanceScore: 90, dayOfWeek: "thursday", month: 6, season: "summer" }),
    perfRow({ observationId: "b", performanceScore: 92, dayOfWeek: "thursday", month: 6, season: "summer" }),
    perfRow({ observationId: "c", performanceScore: 30, dayOfWeek: "monday", month: 6, season: "summer" }),
    perfRow({ observationId: "d", performanceScore: 32, dayOfWeek: "monday", month: 6, season: "summer" }),
  ];

  const results = evaluateTimingPerformance("biz-1", rows, asOf);
  const families = new Set(results.map((r) => r.learningFamily));
  assert.deepEqual([...families], [LearningFamilies.TIMING_PERFORMANCE]);

  const dayOfWeekResults = results.filter((r) => r.timeDimension === TimeDimensions.DAY_OF_WEEK);
  assert.ok(dayOfWeekResults.some((r) => r.subjectKey === "thursday"));
  assert.ok(dayOfWeekResults.some((r) => r.subjectKey === "monday"));
});

test("evaluateTimingPerformance: never reaches strong_pattern confidence — performanceScore is an estimated metric", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  // Deliberately overwhelming, consistent, recent evidence -- would be strong_pattern
  // for any other metric.
  const rows: PerformanceEvidenceRow[] = Array.from({ length: 15 }, (_, i) =>
    perfRow({ observationId: `strong-${i}`, performanceScore: 95, dayOfWeek: "thursday", occurredAt: `2026-06-${String((i % 10) + 1).padStart(2, "0")}T09:00:00Z` })
  ).concat(
    Array.from({ length: 15 }, (_, i) =>
      perfRow({ observationId: `baseline-${i}`, performanceScore: 20, dayOfWeek: "monday", occurredAt: `2026-06-${String((i % 10) + 1).padStart(2, "0")}T09:00:00Z` })
    )
  );

  const results = evaluateTimingPerformance("biz-1", rows, asOf);
  const thursday = results.find((r) => r.timeDimension === TimeDimensions.DAY_OF_WEEK && r.subjectKey === "thursday");
  assert.ok(thursday);
  assert.notEqual(thursday!.confidenceLevel, LearningConfidenceLevels.STRONG_PATTERN);
  assert.ok(thursday!.confidenceComponents.confounderCodes.includes("estimated_performance_metric" as never));
});

test("evaluateTimingPerformance: no clear pattern produces an inconclusive learning, not a fabricated direction", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: PerformanceEvidenceRow[] = [
    perfRow({ observationId: "a", performanceScore: 50, dayOfWeek: "thursday" }),
    perfRow({ observationId: "b", performanceScore: 51, dayOfWeek: "thursday" }),
    perfRow({ observationId: "c", performanceScore: 50, dayOfWeek: "monday" }),
    perfRow({ observationId: "d", performanceScore: 49, dayOfWeek: "monday" }),
  ];

  const results = evaluateTimingPerformance("biz-1", rows, asOf);
  for (const result of results.filter((r) => r.timeDimension === TimeDimensions.DAY_OF_WEEK)) {
    assert.equal(result.direction, LearningDirections.NEUTRAL);
    assert.equal(result.status, LearningStatuses.INCONCLUSIVE);
  }
});

test("evaluateTimingPerformance: rows missing a time dimension value are excluded from that dimension's cohorts", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: PerformanceEvidenceRow[] = [
    perfRow({ observationId: "a", performanceScore: 90, dayOfWeek: "thursday", month: null }),
    perfRow({ observationId: "b", performanceScore: 92, dayOfWeek: "thursday", month: null }),
  ];

  const results = evaluateTimingPerformance("biz-1", rows, asOf);
  assert.equal(results.some((r) => r.timeDimension === TimeDimensions.MONTH), false);
});

test("every summary produced by evaluateTimingPerformance is correlation-safe", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: PerformanceEvidenceRow[] = [
    perfRow({ observationId: "a", performanceScore: 90, dayOfWeek: "thursday" }),
    perfRow({ observationId: "b", performanceScore: 92, dayOfWeek: "thursday" }),
    perfRow({ observationId: "c", performanceScore: 10, dayOfWeek: "monday" }),
    perfRow({ observationId: "d", performanceScore: 12, dayOfWeek: "monday" }),
  ];
  for (const result of evaluateTimingPerformance("biz-1", rows, asOf)) {
    assert.equal(containsForbiddenTerm(result.summary), null);
    assert.equal(containsForbiddenTerm(result.internalRationale), null);
  }
});

// --- recommendation_action_outcome ------------------------------------------------------

test("evaluateRecommendationActionOutcome: one cohort per action type, metric_key is approval_rate", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: ActionOutcomeEvidenceRow[] = [
    actionRow({ observationId: "a", actionType: "request_reviews", approved: true }),
    actionRow({ observationId: "b", actionType: "request_reviews", approved: true }),
    actionRow({ observationId: "c", actionType: "upload_photos", approved: false }),
    actionRow({ observationId: "d", actionType: "upload_photos", approved: false }),
  ];

  const results = evaluateRecommendationActionOutcome("biz-1", rows, asOf);
  assert.ok(results.every((r) => r.metricKey === LearningMetricKeys.APPROVAL_RATE));
  assert.ok(results.every((r) => r.timeDimension === null));
  const subjectKeys = results.map((r) => r.subjectKey).sort();
  assert.deepEqual(subjectKeys, ["request_reviews", "upload_photos"]);
});

test("evaluateRecommendationActionOutcome: an action type approved more than the overall baseline is positive", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: ActionOutcomeEvidenceRow[] = [
    actionRow({ observationId: "a", actionType: "request_reviews", approved: true }),
    actionRow({ observationId: "b", actionType: "request_reviews", approved: true }),
    actionRow({ observationId: "c", actionType: "request_reviews", approved: true }),
    actionRow({ observationId: "d", actionType: "upload_photos", approved: false }),
    actionRow({ observationId: "e", actionType: "upload_photos", approved: false }),
    actionRow({ observationId: "f", actionType: "upload_photos", approved: false }),
  ];

  const results = evaluateRecommendationActionOutcome("biz-1", rows, asOf);
  const reviews = results.find((r) => r.subjectKey === "request_reviews")!;
  const photos = results.find((r) => r.subjectKey === "upload_photos")!;
  assert.equal(reviews.direction, LearningDirections.POSITIVE);
  assert.equal(photos.direction, LearningDirections.NEGATIVE);
});

test("evaluateRecommendationActionOutcome: performanceScore estimation confounder does not apply to this family", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: ActionOutcomeEvidenceRow[] = [
    actionRow({ observationId: "a", actionType: "request_reviews", approved: true }),
    actionRow({ observationId: "b", actionType: "request_reviews", approved: true }),
  ];
  const results = evaluateRecommendationActionOutcome("biz-1", rows, asOf);
  for (const result of results) {
    assert.equal(result.confidenceComponents.confounderCodes.includes("estimated_performance_metric" as never), false);
  }
});

test("recommendation_action_outcome cohorts can reach strong_pattern (no structural confidence ceiling for this family)", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");
  const rows: ActionOutcomeEvidenceRow[] = [
    ...Array.from({ length: 10 }, (_, i) => actionRow({ observationId: `approved-${i}`, actionType: "request_reviews", approved: true, occurredAt: `2026-06-${String((i % 10) + 1).padStart(2, "0")}T09:00:00Z` })),
    ...Array.from({ length: 10 }, (_, i) => actionRow({ observationId: `rejected-${i}`, actionType: "upload_photos", approved: false, occurredAt: `2026-06-${String((i % 10) + 1).padStart(2, "0")}T09:00:00Z` })),
  ];
  const results = evaluateRecommendationActionOutcome("biz-1", rows, asOf);
  assert.ok(results.some((r) => r.confidenceLevel === LearningConfidenceLevels.STRONG_PATTERN));
});

// --- weakening detection ---------------------------------------------------------------

test("evaluateTimingPerformance: recent contradicting evidence produces a weakening status even with strong historical support", () => {
  const asOf = new Date("2026-07-01T00:00:00Z");
  const rows: PerformanceEvidenceRow[] = [
    // Strong historical support (outside the 90-day recent window).
    ...Array.from({ length: 8 }, (_, i) => perfRow({ observationId: `old-thu-${i}`, performanceScore: 90, dayOfWeek: "thursday", occurredAt: "2025-12-01T00:00:00Z" })),
    ...Array.from({ length: 8 }, (_, i) => perfRow({ observationId: `old-mon-${i}`, performanceScore: 20, dayOfWeek: "monday", occurredAt: "2025-12-01T00:00:00Z" })),
    // Recent, contradicting Thursday evidence.
    perfRow({ observationId: "recent-thu-1", performanceScore: 15, dayOfWeek: "thursday", occurredAt: "2026-06-20T00:00:00Z" }),
    perfRow({ observationId: "recent-thu-2", performanceScore: 12, dayOfWeek: "thursday", occurredAt: "2026-06-25T00:00:00Z" }),
  ];

  const results = evaluateTimingPerformance("biz-1", rows, asOf);
  const thursday = results.find((r) => r.timeDimension === TimeDimensions.DAY_OF_WEEK && r.subjectKey === "thursday");
  assert.ok(thursday);
  assert.equal(thursday!.status, LearningStatuses.WEAKENING);
});
