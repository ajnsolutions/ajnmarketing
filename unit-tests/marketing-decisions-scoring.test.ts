import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreOpportunity,
  aggregatePriorityScore,
  aggregateConfidence,
  urgencyFromPriorityScore,
} from "../lib/marketing-decisions/scoring.ts";
import type { MarketingOpportunity } from "../lib/marketing-opportunities/types.ts";

const NOW = new Date("2026-07-12T12:00:00.000Z");

function opportunity(overrides: Partial<MarketingOpportunity> = {}): MarketingOpportunity {
  return {
    id: "opp-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    category: "missing_gbp_posts",
    severity: "medium",
    confidence: 70,
    title: "Test opportunity",
    description: "desc",
    evidence: {},
    recommended_action: "do something",
    expires_at: null,
    status: "open",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

test("scoreOpportunity: higher severity always produces a higher score, all else equal", () => {
  const low = scoreOpportunity(opportunity({ severity: "low" }), NOW);
  const medium = scoreOpportunity(opportunity({ severity: "medium" }), NOW);
  const high = scoreOpportunity(opportunity({ severity: "high" }), NOW);
  const critical = scoreOpportunity(opportunity({ severity: "critical" }), NOW);

  assert.ok(low < medium);
  assert.ok(medium < high);
  assert.ok(high < critical);
});

test("scoreOpportunity: higher confidence produces a higher score, all else equal", () => {
  const lowConfidence = scoreOpportunity(opportunity({ confidence: 20 }), NOW);
  const highConfidence = scoreOpportunity(opportunity({ confidence: 90 }), NOW);
  assert.ok(lowConfidence < highConfidence);
});

test("scoreOpportunity: a closer expiry raises the score than a farther one", () => {
  const soon = scoreOpportunity(opportunity({ expires_at: "2026-07-13T00:00:00.000Z" }), NOW); // 1 day
  const later = scoreOpportunity(opportunity({ expires_at: "2026-08-12T00:00:00.000Z" }), NOW); // ~31 days
  assert.ok(soon > later);
});

test("scoreOpportunity: no expiry contributes zero time-urgency (not treated as infinitely urgent or irrelevant)", () => {
  const noExpiry = scoreOpportunity(opportunity({ expires_at: null, severity: "medium", confidence: 50 }), NOW);
  const farExpiry = scoreOpportunity(
    opportunity({ expires_at: "2027-01-01T00:00:00.000Z", severity: "medium", confidence: 50 }),
    NOW
  );
  assert.ok(noExpiry <= farExpiry);
});

test("scoreOpportunity: score is always clamped to [0, 100]", () => {
  const maxed = scoreOpportunity(
    opportunity({ severity: "critical", confidence: 100, expires_at: "2026-07-12T13:00:00.000Z" }),
    NOW
  );
  assert.ok(maxed <= 100);
  assert.ok(maxed >= 0);
});

test("scoreOpportunity: is deterministic for identical inputs", () => {
  const a = scoreOpportunity(opportunity(), NOW);
  const b = scoreOpportunity(opportunity(), NOW);
  assert.equal(a, b);
});

test("aggregatePriorityScore: empty list scores 0", () => {
  assert.equal(aggregatePriorityScore([]), 0);
});

test("aggregatePriorityScore: single score returns that score unchanged", () => {
  assert.equal(aggregatePriorityScore([55]), 55);
});

test("aggregatePriorityScore: multiple scores use the max plus a capped bonus per extra opportunity", () => {
  const result = aggregatePriorityScore([40, 60, 50]);
  assert.equal(result, 70); // max(60) + min(15, 2*5=10) = 70
});

test("aggregatePriorityScore: the group bonus is capped so many weak signals can't out-rank a strong one indefinitely", () => {
  const manySignals = aggregatePriorityScore([30, 30, 30, 30, 30, 30, 30, 30, 30, 30]);
  assert.equal(manySignals, 45); // max(30) + min(15, 9*5=45 -> capped 15) = 45
});

test("aggregatePriorityScore: result never exceeds 100", () => {
  const result = aggregatePriorityScore([95, 95, 95, 95]);
  assert.ok(result <= 100);
});

test("aggregateConfidence: empty list is 0", () => {
  assert.equal(aggregateConfidence([]), 0);
});

test("aggregateConfidence: averages the given confidences", () => {
  assert.equal(aggregateConfidence([80, 60]), 70);
});

test("urgencyFromPriorityScore: maps thresholds correctly and consistently with priority_score", () => {
  assert.equal(urgencyFromPriorityScore(90), "critical");
  assert.equal(urgencyFromPriorityScore(85), "critical");
  assert.equal(urgencyFromPriorityScore(84.9), "high");
  assert.equal(urgencyFromPriorityScore(65), "high");
  assert.equal(urgencyFromPriorityScore(64.9), "medium");
  assert.equal(urgencyFromPriorityScore(40), "medium");
  assert.equal(urgencyFromPriorityScore(39.9), "low");
  assert.equal(urgencyFromPriorityScore(0), "low");
});
