import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultInstructionText,
  validateRecordOverrideInput,
  validateUpsertPreferenceInput,
} from "../lib/marketing-memory/preferenceValidation.ts";

test("validateUpsertPreferenceInput: accepts context_category_toggle disable", () => {
  const result = validateUpsertPreferenceInput({
    preferenceType: "context_category_toggle",
    factorType: "political_civic",
    factorValue: "disable",
    instructionText: "Don't use political or civic events as marketing context.",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.preferenceType, "context_category_toggle");
    assert.equal(result.value.factorType, "political_civic");
  }
});

test("validateUpsertPreferenceInput: rejects content_tone (Brand Voice remains authoritative)", () => {
  const result = validateUpsertPreferenceInput({
    preferenceType: "content_tone",
    instructionText: "Be casual",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Brand Voice/i);
  }
});

test("validateUpsertPreferenceInput: normalizes publishing_day_restriction", () => {
  const result = validateUpsertPreferenceInput({
    preferenceType: "publishing_day_restriction",
    factorValue: "Sunday",
    instructionText: "Avoid publishing on Sundays.",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.factorType, "day_of_week");
    assert.equal(result.value.factorValue, "sunday");
  }
});

test("validateUpsertPreferenceInput: rejects custom text that steers into goals/voice", () => {
  const result = validateUpsertPreferenceInput({
    preferenceType: "custom",
    instructionText: "Change my brand voice to formal",
  });
  assert.equal(result.ok, false);
});

test("validateRecordOverrideInput: requires relatedLearningId for marked_learning_incorrect", () => {
  const missing = validateRecordOverrideInput({
    overrideType: "marked_learning_incorrect",
  });
  assert.equal(missing.ok, false);

  const ok = validateRecordOverrideInput({
    overrideType: "marked_learning_incorrect",
    relatedLearningId: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(ok.ok, true);
});

test("validateRecordOverrideInput: requires known category for disabled_context_factor", () => {
  const bad = validateRecordOverrideInput({
    overrideType: "disabled_context_factor",
    factorType: "not_a_category",
  });
  assert.equal(bad.ok, false);

  const ok = validateRecordOverrideInput({
    overrideType: "disabled_context_factor",
    factorType: "weather",
    isPermanent: true,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.factorValue, "disable");
    assert.equal(ok.value.isPermanent, true);
  }
});

test("validateRecordOverrideInput: bounds clientRequestId length", () => {
  const tooLong = validateRecordOverrideInput({
    overrideType: "deferred_recommendation",
    clientRequestId: "x".repeat(201),
  });
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.match(tooLong.error, /clientRequestId/);

  const ok = validateRecordOverrideInput({
    overrideType: "deferred_recommendation",
    clientRequestId: "gesture-1",
  });
  assert.equal(ok.ok, true);
});

test("defaultInstructionText: builds customer-safe defaults", () => {
  assert.match(
    defaultInstructionText({
      preferenceType: "context_category_toggle",
      factorType: "competitor",
      factorValue: "disable",
      instructionText: "",
    }),
    /competitor/
  );
});
