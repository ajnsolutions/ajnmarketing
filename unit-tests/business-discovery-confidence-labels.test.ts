import test from "node:test";
import assert from "node:assert/strict";
import {
  businessConfidenceExplanation,
  businessConfidenceLabelText,
  resolveBusinessConfidenceLabel,
} from "../lib/business-discovery/confidenceLabels.ts";
import { BusinessConfidenceLabels } from "../lib/business-discovery/types.ts";

test("resolveBusinessConfidenceLabel is deterministic across the full score range", () => {
  assert.equal(resolveBusinessConfidenceLabel(0), BusinessConfidenceLabels.JUST_GETTING_STARTED);
  assert.equal(resolveBusinessConfidenceLabel(29), BusinessConfidenceLabels.JUST_GETTING_STARTED);
  assert.equal(resolveBusinessConfidenceLabel(30), BusinessConfidenceLabels.BUILDING_A_PICTURE);
  assert.equal(resolveBusinessConfidenceLabel(59), BusinessConfidenceLabels.BUILDING_A_PICTURE);
  assert.equal(resolveBusinessConfidenceLabel(60), BusinessConfidenceLabels.GOOD_UNDERSTANDING);
  assert.equal(resolveBusinessConfidenceLabel(84), BusinessConfidenceLabels.GOOD_UNDERSTANDING);
  assert.equal(resolveBusinessConfidenceLabel(85), BusinessConfidenceLabels.DEEP_UNDERSTANDING);
  assert.equal(resolveBusinessConfidenceLabel(100), BusinessConfidenceLabels.DEEP_UNDERSTANDING);
});

test("every label has non-empty text and an honest explanation", () => {
  for (const label of Object.values(BusinessConfidenceLabels)) {
    assert.ok(businessConfidenceLabelText(label).length > 0);
    assert.ok(businessConfidenceExplanation(label).length > 0);
  }
});

test("never presents a raw percentage as the label text", () => {
  for (const label of Object.values(BusinessConfidenceLabels)) {
    assert.doesNotMatch(businessConfidenceLabelText(label), /%|\d/);
  }
});
