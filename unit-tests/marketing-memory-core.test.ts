import test from "node:test";
import assert from "node:assert/strict";
import { RecommendationOutcomeEventTypes } from "../lib/recommendation-outcomes/types.ts";
import {
  observationTypeForOutcomeEvent,
  outcomeDirectionForObservationType,
  retentionClassificationForObservationType,
} from "../lib/marketing-memory/mapping.ts";
import {
  MarketingMemoryObservationTypes,
  MarketingMemoryOutcomeDirections,
  MarketingMemoryRetentionClassifications,
} from "../lib/marketing-memory/types.ts";
import {
  buildContextSnapshotIdempotencyKey,
  buildEvidenceLinkIdempotencyKey,
  buildObservationIdempotencyKey,
  utcDateKey,
} from "../lib/marketing-memory/idempotency.ts";
import { classifyError, sanitizeMetricSummary } from "../lib/marketing-memory/metadata.ts";

// --- mapping.ts -------------------------------------------------------------------

test("observationTypeForOutcomeEvent: every recommendation outcome event type maps to exactly one observation type", () => {
  const expected: Record<string, string> = {
    draft_created: MarketingMemoryObservationTypes.RECOMMENDATION_DRAFTED,
    draft_edited: MarketingMemoryObservationTypes.RECOMMENDATION_EDITED,
    draft_approved: MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED,
    draft_rejected: MarketingMemoryObservationTypes.RECOMMENDATION_REJECTED,
    do_more_like_this: MarketingMemoryObservationTypes.RECOMMENDATION_DO_MORE_LIKE_THIS,
    publishing_queued: MarketingMemoryObservationTypes.PUBLISHING_QUEUED,
    publishing_succeeded: MarketingMemoryObservationTypes.PUBLISHING_SUCCEEDED,
    publishing_failed: MarketingMemoryObservationTypes.PUBLISHING_FAILED,
    performance_measured: MarketingMemoryObservationTypes.PERFORMANCE_MEASURED,
  };

  for (const eventType of Object.values(RecommendationOutcomeEventTypes)) {
    assert.equal(observationTypeForOutcomeEvent(eventType), expected[eventType], eventType);
  }
});

test("outcomeDirectionForObservationType: purely factual, non-inferential mapping", () => {
  assert.equal(
    outcomeDirectionForObservationType(MarketingMemoryObservationTypes.RECOMMENDATION_APPROVED),
    MarketingMemoryOutcomeDirections.POSITIVE
  );
  assert.equal(
    outcomeDirectionForObservationType(MarketingMemoryObservationTypes.RECOMMENDATION_REJECTED),
    MarketingMemoryOutcomeDirections.NEGATIVE
  );
  assert.equal(
    outcomeDirectionForObservationType(MarketingMemoryObservationTypes.PUBLISHING_SUCCEEDED),
    MarketingMemoryOutcomeDirections.POSITIVE
  );
  assert.equal(
    outcomeDirectionForObservationType(MarketingMemoryObservationTypes.PUBLISHING_FAILED),
    MarketingMemoryOutcomeDirections.NEGATIVE
  );
  assert.equal(
    outcomeDirectionForObservationType(MarketingMemoryObservationTypes.RECOMMENDATION_DRAFTED),
    MarketingMemoryOutcomeDirections.NEUTRAL
  );
  // performance_measured is always "unknown": judging a metric requires a baseline
  // comparison, which is Learning-layer work, out of scope for Phase 1.
  assert.equal(
    outcomeDirectionForObservationType(MarketingMemoryObservationTypes.PERFORMANCE_MEASURED),
    MarketingMemoryOutcomeDirections.UNKNOWN
  );
  assert.equal(
    outcomeDirectionForObservationType(MarketingMemoryObservationTypes.ANALYTICS_SNAPSHOT_CAPTURED),
    MarketingMemoryOutcomeDirections.NEUTRAL
  );
});

test("retentionClassificationForObservationType: recommendation-outcome-derived observations are long_term_audit_evidence; analytics captures are standard_operational_evidence", () => {
  for (const type of Object.values(MarketingMemoryObservationTypes)) {
    const classification = retentionClassificationForObservationType(type);
    if (type === MarketingMemoryObservationTypes.ANALYTICS_SNAPSHOT_CAPTURED) {
      assert.equal(classification, MarketingMemoryRetentionClassifications.STANDARD_OPERATIONAL_EVIDENCE);
    } else {
      assert.equal(classification, MarketingMemoryRetentionClassifications.LONG_TERM_AUDIT_EVIDENCE);
    }
  }
});

// --- idempotency.ts ---------------------------------------------------------------

test("buildObservationIdempotencyKey: deterministic and distinguishes source type/id", () => {
  const a = buildObservationIdempotencyKey("biz-1", "recommendation_outcome_event", "event-1");
  const b = buildObservationIdempotencyKey("biz-1", "recommendation_outcome_event", "event-1");
  const c = buildObservationIdempotencyKey("biz-1", "analytics_snapshot", "event-1");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a, "obs:biz-1:recommendation_outcome_event:event-1");
});

test("buildContextSnapshotIdempotencyKey: one key per business per UTC day", () => {
  assert.equal(buildContextSnapshotIdempotencyKey("biz-1", "2026-07-01"), "ctx:biz-1:2026-07-01");
  assert.notEqual(
    buildContextSnapshotIdempotencyKey("biz-1", "2026-07-01"),
    buildContextSnapshotIdempotencyKey("biz-1", "2026-07-02")
  );
});

test("buildEvidenceLinkIdempotencyKey: deterministic per observation/source pair", () => {
  assert.equal(
    buildEvidenceLinkIdempotencyKey("obs-1", "recommendation", "rec-1"),
    "obs-1:recommendation:rec-1"
  );
});

test("utcDateKey: stable UTC calendar date regardless of time-of-day", () => {
  assert.equal(utcDateKey(new Date("2026-07-01T00:00:00.000Z")), "2026-07-01");
  assert.equal(utcDateKey(new Date("2026-07-01T23:59:59.000Z")), "2026-07-01");
  assert.notEqual(utcDateKey(new Date("2026-07-02T00:00:00.000Z")), "2026-07-01");
});

// --- metadata.ts --------------------------------------------------------------------

test("sanitizeMetricSummary: keeps only bounded primitive values", () => {
  const result = sanitizeMetricSummary({
    impressions: 120,
    positive: true,
    label: "ok",
    nested: { should: "be dropped" },
    list: [1, 2, 3],
    fn: () => "dropped",
    missing: undefined,
    nullable: null,
  });

  assert.deepEqual(result, { impressions: 120, positive: true, label: "ok", nullable: null });
});

test("sanitizeMetricSummary: drops non-object input entirely", () => {
  assert.deepEqual(sanitizeMetricSummary(null), {});
  assert.deepEqual(sanitizeMetricSummary(undefined), {});
  assert.deepEqual(sanitizeMetricSummary("raw string payload"), {});
  assert.deepEqual(sanitizeMetricSummary([1, 2, 3]), {});
  assert.deepEqual(sanitizeMetricSummary(42), {});
});

test("sanitizeMetricSummary: never stores a raw provider payload dump (nested structure) even when it is the entire input", () => {
  const providerPayload = {
    request: { headers: { authorization: "Bearer secret-token" } },
    response: { body: { id: "abc", nested: { deep: true } } },
  };
  const result = sanitizeMetricSummary(providerPayload);
  assert.deepEqual(result, {});
});

test("sanitizeMetricSummary: truncates long string values and caps key count", () => {
  const longString = "x".repeat(10_000);
  const manyKeys: Record<string, number> = {};
  for (let i = 0; i < 50; i += 1) manyKeys[`key${i}`] = i;

  const truncated = sanitizeMetricSummary({ note: longString });
  assert.ok((truncated.note as string).length <= 500);

  const capped = sanitizeMetricSummary(manyKeys);
  assert.ok(Object.keys(capped).length <= 12);
});

test("sanitizeMetricSummary: infinite/NaN numbers are dropped, not stored", () => {
  const result = sanitizeMetricSummary({ ok: 5, bad: Infinity, alsoBad: NaN });
  assert.deepEqual(result, { ok: 5 });
});

test("classifyError: never exposes a raw error message or stack, only a safe class name", () => {
  const err = new TypeError("contains a secret token: abc123");
  const classified = classifyError(err);
  assert.equal(classified, "TypeError");
  assert.ok(!classified.includes("secret"));
  assert.equal(classifyError("just a string"), "UnknownError");
  assert.equal(classifyError(undefined), "UnknownError");
});
