import test from "node:test";
import assert from "node:assert/strict";
import { parseTriggerMarketingMemoryLearningEvaluationRequestBody } from "../lib/admin/triggerMarketingMemoryLearningEvaluationRequest.ts";

test("parseTriggerMarketingMemoryLearningEvaluationRequestBody accepts a valid body and trims whitespace", () => {
  const result = parseTriggerMarketingMemoryLearningEvaluationRequestBody({
    userId: "  user-1  ",
    businessProfileId: "  biz-1  ",
  });
  assert.deepEqual(result, { ok: true, userId: "user-1", businessProfileId: "biz-1" });
});

test("parseTriggerMarketingMemoryLearningEvaluationRequestBody rejects a missing userId", () => {
  const result = parseTriggerMarketingMemoryLearningEvaluationRequestBody({ businessProfileId: "biz-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerMarketingMemoryLearningEvaluationRequestBody rejects a missing businessProfileId", () => {
  const result = parseTriggerMarketingMemoryLearningEvaluationRequestBody({ userId: "user-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerMarketingMemoryLearningEvaluationRequestBody rejects non-string fields", () => {
  assert.equal(
    parseTriggerMarketingMemoryLearningEvaluationRequestBody({ userId: 1, businessProfileId: "biz-1" }).ok,
    false
  );
  assert.equal(
    parseTriggerMarketingMemoryLearningEvaluationRequestBody({ userId: "user-1", businessProfileId: 2 }).ok,
    false
  );
});

test("parseTriggerMarketingMemoryLearningEvaluationRequestBody rejects blank/whitespace-only fields", () => {
  assert.equal(
    parseTriggerMarketingMemoryLearningEvaluationRequestBody({ userId: "   ", businessProfileId: "biz-1" }).ok,
    false
  );
});

test("parseTriggerMarketingMemoryLearningEvaluationRequestBody rejects null, arrays, and non-object bodies", () => {
  assert.equal(parseTriggerMarketingMemoryLearningEvaluationRequestBody(null).ok, false);
  assert.equal(parseTriggerMarketingMemoryLearningEvaluationRequestBody("nope").ok, false);
  assert.equal(parseTriggerMarketingMemoryLearningEvaluationRequestBody(undefined).ok, false);
  assert.equal(parseTriggerMarketingMemoryLearningEvaluationRequestBody([]).ok, false);
});
