import test from "node:test";
import assert from "node:assert/strict";
import { parseRecommendationLearningDebugRequestParams } from "../lib/admin/recommendationLearningDebugRequest.ts";

test("parseRecommendationLearningDebugRequestParams accepts valid params and trims whitespace", () => {
  const params = new URLSearchParams({ userId: "  user-1  ", businessProfileId: "  biz-1  " });
  assert.deepEqual(parseRecommendationLearningDebugRequestParams(params), {
    ok: true,
    userId: "user-1",
    businessProfileId: "biz-1",
  });
});

test("parseRecommendationLearningDebugRequestParams rejects a missing userId", () => {
  const params = new URLSearchParams({ businessProfileId: "biz-1" });
  assert.equal(parseRecommendationLearningDebugRequestParams(params).ok, false);
});

test("parseRecommendationLearningDebugRequestParams rejects a missing businessProfileId", () => {
  const params = new URLSearchParams({ userId: "user-1" });
  assert.equal(parseRecommendationLearningDebugRequestParams(params).ok, false);
});

test("parseRecommendationLearningDebugRequestParams rejects blank/whitespace-only values", () => {
  const params = new URLSearchParams({ userId: "   ", businessProfileId: "biz-1" });
  assert.equal(parseRecommendationLearningDebugRequestParams(params).ok, false);
});

test("parseRecommendationLearningDebugRequestParams rejects an entirely empty query string", () => {
  const params = new URLSearchParams();
  assert.equal(parseRecommendationLearningDebugRequestParams(params).ok, false);
});
