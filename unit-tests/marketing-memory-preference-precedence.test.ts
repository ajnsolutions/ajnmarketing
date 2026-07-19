import test from "node:test";
import assert from "node:assert/strict";
import {
  compareMemoryPrecedenceLayers,
  listDisabledContextCategories,
  MemoryPrecedenceLayers,
  sortPreferenceSummariesForPrecedence,
} from "../lib/marketing-memory/preferencePrecedence.ts";
import type { MarketingMemoryPreferenceSummary } from "../lib/marketing-memory/preferenceTypes.ts";

function summary(
  overrides: Partial<MarketingMemoryPreferenceSummary> & Pick<MarketingMemoryPreferenceSummary, "id" | "instructionText">
): MarketingMemoryPreferenceSummary {
  return {
    preferenceType: "custom",
    factorType: null,
    factorValue: null,
    source: "explicit_statement",
    isActive: true,
    activeUntil: null,
    confidenceLabel: "confirmed_preference",
    ...overrides,
  };
}

test("compareMemoryPrecedenceLayers: explicit preferences outrank learnings and best practices", () => {
  assert.ok(
    compareMemoryPrecedenceLayers(
      MemoryPrecedenceLayers.EXPLICIT_PREFERENCE,
      MemoryPrecedenceLayers.STRONG_LEARNING
    ) < 0
  );
  assert.ok(
    compareMemoryPrecedenceLayers(
      MemoryPrecedenceLayers.BUSINESS_GOALS,
      MemoryPrecedenceLayers.EXPLICIT_PREFERENCE
    ) > 0
  );
  assert.ok(
    compareMemoryPrecedenceLayers(
      MemoryPrecedenceLayers.LEGAL_COMPLIANCE,
      MemoryPrecedenceLayers.EXPLICIT_PREFERENCE
    ) < 0
  );
});

test("sortPreferenceSummariesForPrecedence: active before inactive", () => {
  const sorted = sortPreferenceSummariesForPrecedence([
    summary({ id: "1", instructionText: "Old", isActive: false }),
    summary({ id: "2", instructionText: "Live", isActive: true }),
  ]);
  assert.equal(sorted[0].id, "2");
  assert.equal(sorted[1].id, "1");
});

test("listDisabledContextCategories: only active disable toggles", () => {
  const disabled = listDisabledContextCategories([
    summary({
      id: "1",
      instructionText: "skip civic",
      preferenceType: "context_category_toggle",
      factorType: "political_civic",
      factorValue: "disable",
      isActive: true,
    }),
    summary({
      id: "2",
      instructionText: "was weather",
      preferenceType: "context_category_toggle",
      factorType: "weather",
      factorValue: "disable",
      isActive: false,
    }),
    summary({
      id: "3",
      instructionText: "enable holiday",
      preferenceType: "context_category_toggle",
      factorType: "holiday",
      factorValue: "enable",
      isActive: true,
    }),
  ]);
  assert.deepEqual(disabled, ["political_civic"]);
});
