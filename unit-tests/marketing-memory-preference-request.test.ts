import test from "node:test";
import assert from "node:assert/strict";
import { parseDeactivatePreferenceRequestBody } from "../lib/marketing-memory/preferenceRequest.ts";
import { buildOverrideIdempotencyKey } from "../lib/marketing-memory/preferenceIdempotency.ts";

test("parseDeactivatePreferenceRequestBody: requires id", () => {
  assert.equal(parseDeactivatePreferenceRequestBody({}).ok, false);
  const ok = parseDeactivatePreferenceRequestBody({ id: " pref-1 " });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.preferenceId, "pref-1");
});

test("buildOverrideIdempotencyKey: is deterministic for the same clientRequestId", () => {
  const a = buildOverrideIdempotencyKey({
    businessProfileId: "biz-1",
    overrideType: "disabled_context_factor",
    factorType: "weather",
    factorValue: "disable",
    clientRequestId: "abc",
    createdAtIso: "2026-07-18T12:00:00.000Z",
  });
  const b = buildOverrideIdempotencyKey({
    businessProfileId: "biz-1",
    overrideType: "disabled_context_factor",
    factorType: "weather",
    factorValue: "disable",
    clientRequestId: "abc",
    createdAtIso: "2026-07-18T15:00:00.000Z",
  });
  assert.equal(a, b);
  assert.match(a, /^ovr:biz-1:disabled_context_factor:/);
});
