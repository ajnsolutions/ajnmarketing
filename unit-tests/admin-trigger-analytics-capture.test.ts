import test from "node:test";
import assert from "node:assert/strict";
import { isAdminUserId } from "../lib/admin/isAdminUser.ts";
import { parseTriggerAnalyticsCaptureRequestBody } from "../lib/admin/triggerAnalyticsCaptureRequest.ts";

test("isAdminUserId returns true only for a userId present in the comma-separated allowlist", () => {
  const allowlist = "user-1, user-2 ,user-3";

  assert.equal(isAdminUserId("user-1", allowlist), true);
  assert.equal(isAdminUserId("user-2", allowlist), true, "surrounding whitespace in the allowlist is trimmed");
  assert.equal(isAdminUserId("user-4", allowlist), false);
});

test("isAdminUserId returns false when the allowlist is empty or unset", () => {
  assert.equal(isAdminUserId("user-1", ""), false);
  assert.equal(isAdminUserId("user-1", undefined), false);
});

test("isAdminUserId returns false for an empty userId even if the allowlist has an empty entry", () => {
  assert.equal(isAdminUserId("", "user-1,,user-2"), false);
});

test("isAdminUserId does not treat a substring match as membership", () => {
  assert.equal(isAdminUserId("user-1", "user-10,user-11"), false);
});

test("parseTriggerAnalyticsCaptureRequestBody accepts a valid body and trims whitespace", () => {
  const result = parseTriggerAnalyticsCaptureRequestBody({
    userId: "  user-1  ",
    businessProfileId: " biz-1 ",
  });

  assert.deepEqual(result, { ok: true, userId: "user-1", businessProfileId: "biz-1" });
});

test("parseTriggerAnalyticsCaptureRequestBody rejects a missing userId", () => {
  const result = parseTriggerAnalyticsCaptureRequestBody({ businessProfileId: "biz-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerAnalyticsCaptureRequestBody rejects a missing businessProfileId", () => {
  const result = parseTriggerAnalyticsCaptureRequestBody({ userId: "user-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerAnalyticsCaptureRequestBody rejects non-string fields", () => {
  const result = parseTriggerAnalyticsCaptureRequestBody({ userId: 123, businessProfileId: "biz-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerAnalyticsCaptureRequestBody rejects a blank/whitespace-only userId", () => {
  const result = parseTriggerAnalyticsCaptureRequestBody({ userId: "   ", businessProfileId: "biz-1" });
  assert.equal(result.ok, false);
});

test("parseTriggerAnalyticsCaptureRequestBody rejects null, arrays, and non-object bodies", () => {
  assert.equal(parseTriggerAnalyticsCaptureRequestBody(null).ok, false);
  assert.equal(parseTriggerAnalyticsCaptureRequestBody("not an object").ok, false);
  assert.equal(parseTriggerAnalyticsCaptureRequestBody(undefined).ok, false);
});
