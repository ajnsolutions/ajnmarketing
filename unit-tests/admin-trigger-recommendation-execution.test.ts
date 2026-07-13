import test from "node:test";
import assert from "node:assert/strict";
import { parseTriggerRecommendationExecutionRequestBody } from "../lib/admin/triggerRecommendationExecutionRequest.ts";

test("parseTriggerRecommendationExecutionRequestBody accepts a valid body and trims whitespace", () => {
  const result = parseTriggerRecommendationExecutionRequestBody({
    userId: "  user-1  ",
    recommendationId: "  rec-1  ",
  });
  assert.deepEqual(result, { ok: true, userId: "user-1", recommendationId: "rec-1" });
});

test("parseTriggerRecommendationExecutionRequestBody rejects a missing userId", () => {
  const result = parseTriggerRecommendationExecutionRequestBody({ recommendationId: "rec-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerRecommendationExecutionRequestBody rejects a missing recommendationId", () => {
  const result = parseTriggerRecommendationExecutionRequestBody({ userId: "user-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerRecommendationExecutionRequestBody rejects non-string fields", () => {
  assert.equal(
    parseTriggerRecommendationExecutionRequestBody({ userId: 123, recommendationId: "rec-1" }).ok,
    false
  );
  assert.equal(
    parseTriggerRecommendationExecutionRequestBody({ userId: "user-1", recommendationId: 456 }).ok,
    false
  );
});

test("parseTriggerRecommendationExecutionRequestBody rejects blank/whitespace-only fields", () => {
  assert.equal(
    parseTriggerRecommendationExecutionRequestBody({ userId: "   ", recommendationId: "rec-1" }).ok,
    false
  );
  assert.equal(
    parseTriggerRecommendationExecutionRequestBody({ userId: "user-1", recommendationId: "   " }).ok,
    false
  );
});

test("parseTriggerRecommendationExecutionRequestBody rejects null, arrays, and non-object bodies", () => {
  assert.equal(parseTriggerRecommendationExecutionRequestBody(null).ok, false);
  assert.equal(parseTriggerRecommendationExecutionRequestBody("not an object").ok, false);
  assert.equal(parseTriggerRecommendationExecutionRequestBody(undefined).ok, false);
  assert.equal(parseTriggerRecommendationExecutionRequestBody([]).ok, false);
});
