import assert from "node:assert/strict";
import test from "node:test";
import {
  assertStepCanAcknowledge,
  assertStepCanSkip,
  parseSetupPreferencesBody,
  parseSetupStepKeyBody,
} from "../lib/customer-setup/request.ts";
import { SetupStepKeys } from "../lib/customer-setup/types.ts";

test("rejects unknown step keys", () => {
  const parsed = parseSetupStepKeyBody({ stepKey: "not_a_real_step" });
  assert.equal(parsed.ok, false);
});

test("cannot skip required business info", () => {
  const result = assertStepCanSkip(SetupStepKeys.BUSINESS_INFO);
  assert.equal(result.ok, false);
});

test("can skip optional google business", () => {
  const result = assertStepCanSkip(SetupStepKeys.GOOGLE_BUSINESS);
  assert.equal(result.ok, true);
});

test("cannot acknowledge derived business info complete", () => {
  const result = assertStepCanAcknowledge(SetupStepKeys.BUSINESS_INFO);
  assert.equal(result.ok, false);
});

test("can acknowledge educational steps", () => {
  assert.equal(assertStepCanAcknowledge(SetupStepKeys.APPROVAL_EDUCATION).ok, true);
});

test("rejects client-controlled completion fields", () => {
  const parsed = parseSetupPreferencesBody({
    dismissOnboarding: true,
    requiredPercentComplete: 100,
  });
  assert.equal(parsed.ok, false);
});

test("accepts dismiss preference", () => {
  const parsed = parseSetupPreferencesBody({ dismissOnboarding: true });
  assert.equal(parsed.ok, true);
});
