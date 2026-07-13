import test from "node:test";
import assert from "node:assert/strict";
import { parseTriggerRecommendationPipelineRequestBody } from "../lib/admin/triggerRecommendationPipelineRequest.ts";

test("parseTriggerRecommendationPipelineRequestBody accepts a valid body and trims whitespace", () => {
  const result = parseTriggerRecommendationPipelineRequestBody({ userId: "  user-1  " });
  assert.deepEqual(result, { ok: true, userId: "user-1" });
});

test("parseTriggerRecommendationPipelineRequestBody rejects a missing userId", () => {
  const result = parseTriggerRecommendationPipelineRequestBody({});
  assert.equal(result.ok, false);
});

test("parseTriggerRecommendationPipelineRequestBody rejects a non-string userId", () => {
  const result = parseTriggerRecommendationPipelineRequestBody({ userId: 123 });
  assert.equal(result.ok, false);
});

test("parseTriggerRecommendationPipelineRequestBody rejects a blank/whitespace-only userId", () => {
  const result = parseTriggerRecommendationPipelineRequestBody({ userId: "   " });
  assert.equal(result.ok, false);
});

test("parseTriggerRecommendationPipelineRequestBody rejects null, arrays, and non-object bodies", () => {
  assert.equal(parseTriggerRecommendationPipelineRequestBody(null).ok, false);
  assert.equal(parseTriggerRecommendationPipelineRequestBody("not an object").ok, false);
  assert.equal(parseTriggerRecommendationPipelineRequestBody(undefined).ok, false);
});
