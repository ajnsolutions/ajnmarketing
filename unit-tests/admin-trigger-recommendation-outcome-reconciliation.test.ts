import test from "node:test";
import assert from "node:assert/strict";
import { parseTriggerRecommendationOutcomeReconciliationRequestBody } from "../lib/admin/triggerRecommendationOutcomeReconciliationRequest.ts";

test("parseTriggerRecommendationOutcomeReconciliationRequestBody accepts a valid body and trims whitespace", () => {
  const result = parseTriggerRecommendationOutcomeReconciliationRequestBody({
    userId: "  user-1  ",
    businessProfileId: "  biz-1  ",
  });
  assert.deepEqual(result, { ok: true, userId: "user-1", businessProfileId: "biz-1" });
});

test("parseTriggerRecommendationOutcomeReconciliationRequestBody rejects a missing userId", () => {
  const result = parseTriggerRecommendationOutcomeReconciliationRequestBody({ businessProfileId: "biz-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerRecommendationOutcomeReconciliationRequestBody rejects a missing businessProfileId", () => {
  const result = parseTriggerRecommendationOutcomeReconciliationRequestBody({ userId: "user-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerRecommendationOutcomeReconciliationRequestBody rejects non-string fields", () => {
  assert.equal(
    parseTriggerRecommendationOutcomeReconciliationRequestBody({ userId: 1, businessProfileId: "biz-1" }).ok,
    false
  );
  assert.equal(
    parseTriggerRecommendationOutcomeReconciliationRequestBody({ userId: "user-1", businessProfileId: 2 }).ok,
    false
  );
});

test("parseTriggerRecommendationOutcomeReconciliationRequestBody rejects blank/whitespace-only fields", () => {
  assert.equal(
    parseTriggerRecommendationOutcomeReconciliationRequestBody({ userId: "   ", businessProfileId: "biz-1" }).ok,
    false
  );
});

test("parseTriggerRecommendationOutcomeReconciliationRequestBody rejects null, arrays, and non-object bodies", () => {
  assert.equal(parseTriggerRecommendationOutcomeReconciliationRequestBody(null).ok, false);
  assert.equal(parseTriggerRecommendationOutcomeReconciliationRequestBody("nope").ok, false);
  assert.equal(parseTriggerRecommendationOutcomeReconciliationRequestBody(undefined).ok, false);
  assert.equal(parseTriggerRecommendationOutcomeReconciliationRequestBody([]).ok, false);
});
