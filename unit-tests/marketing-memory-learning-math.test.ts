import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyConfidence,
  classifyDirection,
  classifyEvidenceItem,
  computeConsistency,
  computeContradictionRate,
  computeEffectSize,
  daysBetween,
  mostRecentEvidenceRecencyDays,
} from "../lib/marketing-memory/learningMath.ts";
import { EvidenceClassifications, LearningConfidenceLevels, LearningDirections } from "../lib/marketing-memory/learningTypes.ts";

// --- effect size / direction --------------------------------------------------------

test("computeEffectSize: relative difference from baseline, signed", () => {
  assert.equal(computeEffectSize(110, 100), 0.1);
  assert.equal(computeEffectSize(90, 100), -0.1);
  assert.equal(computeEffectSize(100, 100), 0);
  assert.equal(computeEffectSize(50, 0), 0); // zero baseline never divides by zero
});

test("computeEffectSize: clamps extreme values to +/-3", () => {
  assert.equal(computeEffectSize(1000, 1), 3);
  assert.equal(computeEffectSize(-1000, 1), -3);
});

test("classifyDirection: below the noise band is neutral, not a guess", () => {
  assert.equal(classifyDirection(0.01), LearningDirections.NEUTRAL);
  assert.equal(classifyDirection(-0.01), LearningDirections.NEUTRAL);
  assert.equal(classifyDirection(0.06), LearningDirections.POSITIVE);
  assert.equal(classifyDirection(-0.06), LearningDirections.NEGATIVE);
});

// --- evidence classification --------------------------------------------------------

test("classifyEvidenceItem: supporting when item direction agrees with net direction", () => {
  assert.equal(classifyEvidenceItem(120, 100, LearningDirections.POSITIVE), EvidenceClassifications.SUPPORTING);
});

test("classifyEvidenceItem: contradicting when item direction opposes net direction", () => {
  assert.equal(classifyEvidenceItem(80, 100, LearningDirections.POSITIVE), EvidenceClassifications.CONTRADICTING);
});

test("classifyEvidenceItem: neutral when the item itself is within the noise band", () => {
  assert.equal(classifyEvidenceItem(101, 100, LearningDirections.POSITIVE), EvidenceClassifications.NEUTRAL);
});

test("classifyEvidenceItem: binary (0/1) items classify cleanly against a fractional baseline", () => {
  assert.equal(classifyEvidenceItem(1, 0.5, LearningDirections.POSITIVE), EvidenceClassifications.SUPPORTING);
  assert.equal(classifyEvidenceItem(0, 0.5, LearningDirections.POSITIVE), EvidenceClassifications.CONTRADICTING);
  assert.equal(classifyEvidenceItem(0, 0.5, LearningDirections.NEGATIVE), EvidenceClassifications.SUPPORTING);
});

// --- consistency / contradiction rate ------------------------------------------------

test("computeConsistency: excludes neutral from the denominator", () => {
  assert.equal(computeConsistency(7, 2), 7 / 9);
  assert.equal(computeConsistency(0, 0), 0);
});

test("computeContradictionRate: contradicting relative to supporting", () => {
  assert.equal(computeContradictionRate(10, 2), 0.2);
  assert.equal(computeContradictionRate(0, 3), 1); // any contradiction with zero support is maximal
  assert.equal(computeContradictionRate(0, 0), 0);
});

// --- recency -------------------------------------------------------------------------

test("daysBetween: never negative even if timestamps are reversed", () => {
  assert.equal(daysBetween("2026-07-01T00:00:00Z", "2026-07-11T00:00:00Z"), 10);
  assert.equal(daysBetween("2026-07-11T00:00:00Z", "2026-07-01T00:00:00Z"), 0);
});

test("mostRecentEvidenceRecencyDays: uses the latest item, not the earliest", () => {
  const items = [
    { observationId: "a", occurredAt: "2026-01-01T00:00:00Z", value: 1 },
    { observationId: "b", occurredAt: "2026-06-01T00:00:00Z", value: 1 },
  ];
  const asOf = new Date("2026-06-11T00:00:00Z");
  assert.equal(mostRecentEvidenceRecencyDays(items, asOf), 10);
});

test("mostRecentEvidenceRecencyDays: infinite for an empty evidence set", () => {
  assert.equal(mostRecentEvidenceRecencyDays([]), Number.POSITIVE_INFINITY);
});

// --- confidence classification -------------------------------------------------------

test("classifyConfidence: a single observation never reaches Strong", () => {
  const level = classifyConfidence({
    sampleSize: 1,
    consistency: 1,
    contradictionRate: 0,
    recencyDays: 1,
    seasonalRecurrenceCount: 0,
  });
  assert.equal(level, LearningConfidenceLevels.EARLY_SIGNAL);
});

test("classifyConfidence: three inconsistent observations stay Early signal", () => {
  const level = classifyConfidence({
    sampleSize: 3,
    consistency: 0.4,
    contradictionRate: 1.5,
    recencyDays: 5,
    seasonalRecurrenceCount: 0,
  });
  assert.equal(level, LearningConfidenceLevels.EARLY_SIGNAL);
});

test("classifyConfidence: several recent, moderately consistent observations become Developing", () => {
  const level = classifyConfidence({
    sampleSize: 5,
    consistency: 0.65,
    contradictionRate: 0.2,
    recencyDays: 10,
    seasonalRecurrenceCount: 0,
  });
  assert.equal(level, LearningConfidenceLevels.DEVELOPING_PATTERN);
});

test("classifyConfidence: repeated, highly consistent, recent evidence becomes Strong", () => {
  const level = classifyConfidence({
    sampleSize: 10,
    consistency: 0.8,
    contradictionRate: 0.1,
    recencyDays: 20,
    seasonalRecurrenceCount: 0,
  });
  assert.equal(level, LearningConfidenceLevels.STRONG_PATTERN);
});

test("classifyConfidence: strong sample/consistency but stale and non-seasonal caps at Developing", () => {
  const level = classifyConfidence({
    sampleSize: 12,
    consistency: 0.85,
    contradictionRate: 0.05,
    recencyDays: 200,
    seasonalRecurrenceCount: 0,
  });
  assert.equal(level, LearningConfidenceLevels.DEVELOPING_PATTERN);
});

test("classifyConfidence: staleness is forgiven when the pattern has recurred across seasons", () => {
  const level = classifyConfidence({
    sampleSize: 12,
    consistency: 0.85,
    contradictionRate: 0.05,
    recencyDays: 200,
    seasonalRecurrenceCount: 2,
  });
  assert.equal(level, LearningConfidenceLevels.STRONG_PATTERN);
});

test("classifyConfidence: high contradiction rate caps confidence even with a large sample", () => {
  const level = classifyConfidence({
    sampleSize: 20,
    consistency: 0.9,
    contradictionRate: 0.5,
    recencyDays: 5,
    seasonalRecurrenceCount: 0,
  });
  assert.equal(level, LearningConfidenceLevels.EARLY_SIGNAL);
});
