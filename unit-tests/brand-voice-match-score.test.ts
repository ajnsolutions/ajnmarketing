import assert from "node:assert/strict";
import test from "node:test";
import { matchScoreLabel } from "../lib/brand-voice/matchScoreLabel.ts";

/**
 * [RC-1] Regression coverage for the fabricated "Strong Match" badge fix — the
 * previous implementation hardcoded this label regardless of the real score.
 */
test("null score is honestly labeled as not yet analyzed, never a fabricated match label", () => {
  const result = matchScoreLabel(null);
  assert.equal(result.label, "Not yet analyzed");
});

test("low score is labeled as an early signal, not a false 'strong match' claim", () => {
  assert.equal(matchScoreLabel(10).label, "Early signal");
  assert.equal(matchScoreLabel(39).label, "Early signal");
});

test("mid-range score is labeled a good match", () => {
  assert.equal(matchScoreLabel(40).label, "Good match");
  assert.equal(matchScoreLabel(69).label, "Good match");
});

test("high score is honestly labeled a strong match", () => {
  assert.equal(matchScoreLabel(70).label, "Strong match");
  assert.equal(matchScoreLabel(100).label, "Strong match");
});
