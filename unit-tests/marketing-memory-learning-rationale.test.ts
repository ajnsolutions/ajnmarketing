import test from "node:test";
import assert from "node:assert/strict";
import {
  MARKETING_MEMORY_FORBIDDEN_TERMS,
  buildCustomerSafeSummary,
  buildInternalRationale,
  containsForbiddenTerm,
} from "../lib/marketing-memory/rationale.ts";
import { LearningConfidenceLevels, LearningDirections, LearningFamilies, TimeDimensions } from "../lib/marketing-memory/learningTypes.ts";

function baseComponents(overrides: Partial<Parameters<typeof buildInternalRationale>[0]["confidenceComponents"]> = {}) {
  return {
    sampleSize: 10,
    supportingCount: 8,
    contradictingCount: 2,
    neutralCount: 0,
    excludedCount: 0,
    consistency: 0.8,
    contradictionRate: 0.25,
    effectSize: 0.15,
    recencyDays: 10,
    seasonalRecurrenceCount: 0,
    confounderCodes: [],
    ...overrides,
  };
}

// --- forbidden terms -------------------------------------------------------------------

test("containsForbiddenTerm: flags causal/absolute language", () => {
  assert.equal(containsForbiddenTerm("This caused a spike."), "caused");
  assert.equal(containsForbiddenTerm("This guarantees success."), "guarantee");
  assert.equal(containsForbiddenTerm("It always works."), "always works");
  assert.equal(containsForbiddenTerm("This proves the theory."), "proves");
});

test("containsForbiddenTerm: allows correlation-aware language", () => {
  assert.equal(containsForbiddenTerm("Historically performed better and may have contributed."), null);
  assert.equal(containsForbiddenTerm("Evidence suggests a repeated pattern, appears stronger."), null);
});

test("no summary produced by buildCustomerSafeSummary ever contains a forbidden term, across every confidence level and direction", () => {
  const confidenceLevels = Object.values(LearningConfidenceLevels);
  const directions = Object.values(LearningDirections);
  const families = Object.values(LearningFamilies);

  for (const confidenceLevel of confidenceLevels) {
    for (const direction of directions) {
      for (const learningFamily of families) {
        const summary = buildCustomerSafeSummary({
          learningFamily,
          timeDimension: learningFamily === LearningFamilies.TIMING_PERFORMANCE ? TimeDimensions.DAY_OF_WEEK : null,
          subjectKey: learningFamily === LearningFamilies.TIMING_PERFORMANCE ? "thursday" : "create_seasonal_content",
          direction,
          confidenceLevel,
        });
        const hit = containsForbiddenTerm(summary);
        assert.equal(hit, null, `forbidden term "${hit}" found in: "${summary}"`);
      }
    }
  }
});

test("internal rationale never contains a forbidden term either", () => {
  const rationale = buildInternalRationale({
    learningFamily: LearningFamilies.TIMING_PERFORMANCE,
    subjectKey: "thursday",
    confidenceComponents: baseComponents(),
    comparisonBaseline: "trailing rolling average",
  });
  assert.equal(containsForbiddenTerm(rationale), null);
});

test("MARKETING_MEMORY_FORBIDDEN_TERMS includes the explicitly disallowed vocabulary", () => {
  for (const term of ["caused", "guarantee", "always works", "will improve", "proves"]) {
    assert.ok(MARKETING_MEMORY_FORBIDDEN_TERMS.includes(term as never), `missing forbidden term: ${term}`);
  }
});

// --- template correctness --------------------------------------------------------------

test("buildCustomerSafeSummary: early_signal uses tentative, watching language", () => {
  const summary = buildCustomerSafeSummary({
    learningFamily: LearningFamilies.TIMING_PERFORMANCE,
    timeDimension: TimeDimensions.DAY_OF_WEEK,
    subjectKey: "thursday",
    direction: LearningDirections.POSITIVE,
    confidenceLevel: LearningConfidenceLevels.EARLY_SIGNAL,
  });
  assert.match(summary, /early signal/i);
  assert.match(summary, /keep watching/i);
});

test("buildCustomerSafeSummary: strong_pattern uses confident but correlation-aware language", () => {
  const summary = buildCustomerSafeSummary({
    learningFamily: LearningFamilies.TIMING_PERFORMANCE,
    timeDimension: TimeDimensions.DAY_OF_WEEK,
    subjectKey: "thursday",
    direction: LearningDirections.POSITIVE,
    confidenceLevel: LearningConfidenceLevels.STRONG_PATTERN,
  });
  assert.match(summary, /historically/i);
  assert.match(summary, /Thursdays/);
});

test("buildCustomerSafeSummary: neutral/inconclusive direction never claims a pattern exists", () => {
  const summary = buildCustomerSafeSummary({
    learningFamily: LearningFamilies.TIMING_PERFORMANCE,
    timeDimension: TimeDimensions.DAY_OF_WEEK,
    subjectKey: "thursday",
    direction: LearningDirections.INCONCLUSIVE,
    confidenceLevel: LearningConfidenceLevels.EARLY_SIGNAL,
  });
  assert.match(summary, /keep watching/i);
  assert.doesNotMatch(summary, /historically performed/i);
});

test("buildCustomerSafeSummary: recommendation_action_outcome family uses the customer-safe action label, not the raw enum value", () => {
  const summary = buildCustomerSafeSummary({
    learningFamily: LearningFamilies.RECOMMENDATION_ACTION_OUTCOME,
    timeDimension: null,
    subjectKey: "create_seasonal_content",
    direction: LearningDirections.POSITIVE,
    confidenceLevel: LearningConfidenceLevels.DEVELOPING_PATTERN,
  });
  assert.equal(summary.includes("create_seasonal_content"), false);
  assert.match(summary, /approved/i);
});

test("buildInternalRationale: includes limitation-relevant components for weak evidence", () => {
  const rationale = buildInternalRationale({
    learningFamily: LearningFamilies.TIMING_PERFORMANCE,
    subjectKey: "thursday",
    confidenceComponents: baseComponents({ sampleSize: 3, consistency: 0.5, confounderCodes: ["small_sample"] as never }),
    comparisonBaseline: "trailing rolling average",
  });
  assert.match(rationale, /sample_size=3/);
  assert.match(rationale, /small_sample/);
  assert.match(rationale, /not a verified causal relationship/i);
});
