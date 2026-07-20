import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_ANALYTICS_HISTORY_SNAPSHOTS,
  evaluateExperimentEligibility,
  experimentTypeForRecommendedActionType,
} from "../lib/marketing-director/experimentEligibility.ts";

function baseInput(overrides: Partial<Parameters<typeof evaluateExperimentEligibility>[0]> = {}) {
  return {
    recommendation: {
      id: "rec-1",
      recommendedActionType: "publish_gbp_post" as const,
      status: "open",
    },
    analyticsSnapshotCount: MIN_ANALYTICS_HISTORY_SNAPSHOTS,
    hasPendingProposalForType: false,
    hasActiveExperimentForType: false,
    ...overrides,
  };
}

test("eligible recommendation with sufficient history and an allowlisted action type is eligible", () => {
  const result = evaluateExperimentEligibility(baseInput());
  assert.equal(result.eligible, true);
  if (result.eligible) assert.equal(result.experimentType, "posting_time");
});

test("increase_posting_frequency also maps to posting_time", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "increase_posting_frequency", status: "open" } }),
  );
  assert.equal(result.eligible, true);
  if (result.eligible) assert.equal(result.experimentType, "posting_time");
});

test("request_reviews maps to review_request_timing", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "request_reviews", status: "open" } }),
  );
  assert.equal(result.eligible, true);
  if (result.eligible) assert.equal(result.experimentType, "review_request_timing");
});

test("dismissed recommendation is not eligible", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "publish_gbp_post", status: "dismissed" } }),
  );
  assert.equal(result.eligible, false);
});

test("superseded recommendation is not eligible", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "publish_gbp_post", status: "superseded" } }),
  );
  assert.equal(result.eligible, false);
});

test("completed recommendation is not eligible", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "publish_gbp_post", status: "completed" } }),
  );
  assert.equal(result.eligible, false);
});

test("in_progress recommendation is not eligible (a draft already exists for it)", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "publish_gbp_post", status: "in_progress" } }),
  );
  assert.equal(result.eligible, false);
});

test("unsupported action type (not allowlisted) is not eligible", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "upload_photos", status: "open" } }),
  );
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.match(result.reason, /not allowlisted/);
});

test("every non-allowlisted action type is rejected, not just upload_photos", () => {
  const nonAllowlisted = [
    "create_seasonal_content",
    "create_timely_content",
    "update_business_info",
    "refresh_website_content",
  ] as const;
  for (const actionType of nonAllowlisted) {
    const result = evaluateExperimentEligibility(
      baseInput({ recommendation: { id: "rec-1", recommendedActionType: actionType, status: "open" } }),
    );
    assert.equal(result.eligible, false, actionType);
  }
});

test("insufficient analytics history is not eligible", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ analyticsSnapshotCount: MIN_ANALYTICS_HISTORY_SNAPSHOTS - 1 }),
  );
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.match(result.reason, /insufficient analytics history/);
});

test("zero analytics history is not eligible", () => {
  const result = evaluateExperimentEligibility(baseInput({ analyticsSnapshotCount: 0 }));
  assert.equal(result.eligible, false);
});

test("a pending proposal for the same recommendation+type prevents a duplicate", () => {
  const result = evaluateExperimentEligibility(baseInput({ hasPendingProposalForType: true }));
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.match(result.reason, /pending proposal already exists/);
});

test("an active experiment for the same recommendation+type prevents a duplicate", () => {
  const result = evaluateExperimentEligibility(baseInput({ hasActiveExperimentForType: true }));
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.match(result.reason, /active experiment already exists/);
});

test("identical inputs always produce an identical result (deterministic)", () => {
  const input = baseInput();
  assert.deepEqual(evaluateExperimentEligibility(input), evaluateExperimentEligibility(input));
});

test("experimentTypeForRecommendedActionType returns null for non-allowlisted types", () => {
  assert.equal(experimentTypeForRecommendedActionType("upload_photos"), null);
  assert.equal(experimentTypeForRecommendedActionType("publish_gbp_post"), "posting_time");
  assert.equal(experimentTypeForRecommendedActionType("request_reviews"), "review_request_timing");
});

test("a recommendation existing is not, by itself, eligibility -- status alone is not sufficient without an allowlisted action type", () => {
  const result = evaluateExperimentEligibility(
    baseInput({ recommendation: { id: "rec-1", recommendedActionType: "update_business_info", status: "open" } }),
  );
  assert.equal(result.eligible, false);
});
