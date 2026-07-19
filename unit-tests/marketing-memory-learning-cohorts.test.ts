import test from "node:test";
import assert from "node:assert/strict";
import { buildCohorts, cohortSeasonalRecurrenceCount, resolveCohortDirection, type CohortInputItem } from "../lib/marketing-memory/cohorts.ts";
import { recurrencePatternForTimeDimension, seasonalRecurrenceCount } from "../lib/marketing-memory/seasonality.ts";
import { LearningDirections, RecurrencePatterns, TimeDimensions } from "../lib/marketing-memory/learningTypes.ts";

function item(overrides: Partial<CohortInputItem>): CohortInputItem {
  return {
    observationId: "obs-1",
    occurredAt: "2026-06-01T09:00:00Z",
    value: 50,
    groupKey: "thursday",
    ...overrides,
  };
}

// --- buildCohorts --------------------------------------------------------------------

test("buildCohorts: groups comparable observations by groupKey", () => {
  const items = [
    item({ observationId: "a", groupKey: "thursday", value: 80 }),
    item({ observationId: "b", groupKey: "thursday", value: 85 }),
    item({ observationId: "c", groupKey: "monday", value: 40 }),
    item({ observationId: "d", groupKey: "monday", value: 42 }),
  ];

  const cohorts = buildCohorts(items, new Date("2026-06-15T00:00:00Z"));
  const groupKeys = cohorts.map((c) => c.groupKey).sort();
  assert.deepEqual(groupKeys, ["monday", "thursday"]);
});

test("buildCohorts: excludes groups below the minimum sample size (never fabricates a learning from one data point)", () => {
  const items = [
    item({ observationId: "a", groupKey: "thursday", value: 80 }),
    item({ observationId: "b", groupKey: "friday", value: 60 }),
    item({ observationId: "c", groupKey: "friday", value: 65 }),
  ];

  const cohorts = buildCohorts(items, new Date("2026-06-15T00:00:00Z"));
  assert.deepEqual(cohorts.map((c) => c.groupKey), ["friday"]);
});

test("buildCohorts: unrelated groups never contaminate each other's baseline (baseline is the overall average across the whole comparable set)", () => {
  const items = [
    item({ observationId: "a", groupKey: "thursday", value: 100 }),
    item({ observationId: "b", groupKey: "thursday", value: 100 }),
    item({ observationId: "c", groupKey: "monday", value: 20 }),
    item({ observationId: "d", groupKey: "monday", value: 20 }),
  ];

  const cohorts = buildCohorts(items, new Date("2026-06-15T00:00:00Z"));
  // overall average = (100+100+20+20)/4 = 60 -- both cohorts compare against this shared baseline
  for (const cohort of cohorts) {
    assert.equal(cohort.baselineValue, 60);
  }
  const thursday = cohorts.find((c) => c.groupKey === "thursday")!;
  const monday = cohorts.find((c) => c.groupKey === "monday")!;
  assert.equal(thursday.direction, LearningDirections.POSITIVE);
  assert.equal(monday.direction, LearningDirections.NEGATIVE);
});

test("buildCohorts: consistent evidence within a cohort classifies every item as supporting", () => {
  const items = [
    item({ observationId: "a", groupKey: "thursday", value: 90 }),
    item({ observationId: "b", groupKey: "thursday", value: 95 }),
    item({ observationId: "c", groupKey: "thursday", value: 92 }),
    item({ observationId: "d", groupKey: "monday", value: 30 }),
    item({ observationId: "e", groupKey: "monday", value: 32 }),
  ];

  const cohorts = buildCohorts(items, new Date("2026-06-15T00:00:00Z"));
  const thursday = cohorts.find((c) => c.groupKey === "thursday")!;
  assert.equal(thursday.supportingIds.length, 3);
  assert.equal(thursday.contradictingIds.length, 0);
});

test("buildCohorts: mixed evidence within a cohort produces contradicting items and lower consistency", () => {
  const items = [
    item({ observationId: "a", groupKey: "thursday", value: 90 }),
    item({ observationId: "b", groupKey: "thursday", value: 20 }), // a weak Thursday, contradicts the cohort's own positive lean
    item({ observationId: "c", groupKey: "thursday", value: 85 }),
    item({ observationId: "d", groupKey: "monday", value: 40 }),
    item({ observationId: "e", groupKey: "monday", value: 42 }),
  ];

  const cohorts = buildCohorts(items, new Date("2026-06-15T00:00:00Z"));
  const thursday = cohorts.find((c) => c.groupKey === "thursday")!;
  assert.ok(thursday.contradictingIds.length >= 1, "a low-performing Thursday should register as contradicting evidence");
  assert.ok(thursday.consistency < 1);
});

test("buildCohorts: negative outcomes remain usable evidence, not discarded", () => {
  const items = [
    item({ observationId: "a", groupKey: "sunday", value: 10 }),
    item({ observationId: "b", groupKey: "sunday", value: 12 }),
    item({ observationId: "c", groupKey: "weekday", value: 60 }),
    item({ observationId: "d", groupKey: "weekday", value: 62 }),
  ];

  const cohorts = buildCohorts(items, new Date("2026-06-15T00:00:00Z"));
  const sunday = cohorts.find((c) => c.groupKey === "sunday")!;
  assert.equal(sunday.direction, LearningDirections.NEGATIVE);
  assert.equal(sunday.supportingIds.length, 2); // both low-performing Sundays support "Sundays are worse"
});

test("buildCohorts: recentContradictionRate reflects only items within the recent weakening window", () => {
  const asOf = new Date("2026-07-01T00:00:00Z");
  const items = [
    // Old, strongly supporting evidence (outside the 90-day recent window).
    item({ observationId: "old1", groupKey: "thursday", value: 90, occurredAt: "2025-12-01T00:00:00Z" }),
    item({ observationId: "old2", groupKey: "thursday", value: 92, occurredAt: "2025-12-05T00:00:00Z" }),
    item({ observationId: "old3", groupKey: "thursday", value: 95, occurredAt: "2025-12-10T00:00:00Z" }),
    // Recent, contradicting evidence (within the 90-day window).
    item({ observationId: "new1", groupKey: "thursday", value: 20, occurredAt: "2026-06-25T00:00:00Z" }),
    item({ observationId: "new2", groupKey: "monday", value: 30, occurredAt: "2026-06-20T00:00:00Z" }),
    item({ observationId: "new3", groupKey: "monday", value: 32, occurredAt: "2026-06-22T00:00:00Z" }),
  ];

  const cohorts = buildCohorts(items, asOf);
  const thursday = cohorts.find((c) => c.groupKey === "thursday")!;
  assert.ok(thursday.recentContradictionRate > 0, "recent contradicting evidence should be reflected");
});

test("buildCohorts: empty input produces no cohorts", () => {
  assert.deepEqual(buildCohorts([]), []);
});

// --- resolveCohortDirection -----------------------------------------------------------

test("resolveCohortDirection: a flat cohort (net direction neutral) stays neutral", () => {
  const items = [
    item({ observationId: "a", groupKey: "thursday", value: 50 }),
    item({ observationId: "b", groupKey: "thursday", value: 51 }),
    item({ observationId: "c", groupKey: "monday", value: 50 }),
    item({ observationId: "d", groupKey: "monday", value: 49 }),
  ];
  const cohorts = buildCohorts(items, new Date("2026-06-15T00:00:00Z"));
  for (const cohort of cohorts) {
    assert.equal(resolveCohortDirection(cohort), LearningDirections.NEUTRAL);
  }
});

// --- seasonality -----------------------------------------------------------------------

test("recurrencePatternForTimeDimension: maps each dimension to its recurrence shape", () => {
  assert.equal(recurrencePatternForTimeDimension(TimeDimensions.DAY_OF_WEEK), RecurrencePatterns.RECURRING_WEEKLY);
  assert.equal(recurrencePatternForTimeDimension(TimeDimensions.MONTH), RecurrencePatterns.ANNUAL_MONTH);
  assert.equal(recurrencePatternForTimeDimension(TimeDimensions.SEASON), RecurrencePatterns.ANNUAL_RANGE);
  assert.equal(recurrencePatternForTimeDimension(null), RecurrencePatterns.NONE);
});

test("seasonalRecurrenceCount: a December pattern from a single year is not yet 'recurring'", () => {
  const items = [
    { observationId: "a", occurredAt: "2025-12-01T00:00:00Z", value: 1 },
    { observationId: "b", occurredAt: "2025-12-15T00:00:00Z", value: 1 },
  ];
  assert.equal(seasonalRecurrenceCount(items, TimeDimensions.MONTH), 0);
});

test("seasonalRecurrenceCount: evidence spanning two distinct Decembers counts as recurring", () => {
  const items = [
    { observationId: "a", occurredAt: "2024-12-01T00:00:00Z", value: 1 },
    { observationId: "b", occurredAt: "2025-12-15T00:00:00Z", value: 1 },
  ];
  assert.equal(seasonalRecurrenceCount(items, TimeDimensions.MONTH), 2);
});

test("seasonalRecurrenceCount: does not apply to day_of_week or non-seasonal dimensions", () => {
  const items = [
    { observationId: "a", occurredAt: "2024-06-01T00:00:00Z", value: 1 },
    { observationId: "b", occurredAt: "2025-06-01T00:00:00Z", value: 1 },
  ];
  assert.equal(seasonalRecurrenceCount(items, TimeDimensions.DAY_OF_WEEK), 0);
  assert.equal(seasonalRecurrenceCount(items, null), 0);
});

test("cohortSeasonalRecurrenceCount: wraps a CohortResult correctly for month/season only", () => {
  const items = [
    item({ observationId: "a", groupKey: "7", value: 80, occurredAt: "2024-07-01T00:00:00Z" }),
    item({ observationId: "b", groupKey: "7", value: 82, occurredAt: "2025-07-01T00:00:00Z" }),
    item({ observationId: "c", groupKey: "1", value: 20, occurredAt: "2025-01-01T00:00:00Z" }),
    item({ observationId: "d", groupKey: "1", value: 22, occurredAt: "2025-01-05T00:00:00Z" }),
  ];
  const cohorts = buildCohorts(items, new Date("2026-01-01T00:00:00Z"));
  const july = cohorts.find((c) => c.groupKey === "7")!;
  const january = cohorts.find((c) => c.groupKey === "1")!;
  assert.equal(cohortSeasonalRecurrenceCount(july, TimeDimensions.MONTH), 2);
  assert.equal(cohortSeasonalRecurrenceCount(january, TimeDimensions.MONTH), 0);
  assert.equal(cohortSeasonalRecurrenceCount(july, TimeDimensions.DAY_OF_WEEK), 0);
});
