import assert from "node:assert/strict";
import test from "node:test";
import { GROWTH_ADVISOR_EVENTS } from "../lib/growth-advisor/experienceAnalytics.ts";

test("event vocabulary matches exactly the sprint's required tracking list", () => {
  assert.deepEqual(
    [...GROWTH_ADVISOR_EVENTS].sort(),
    [
      "growth_advisor_viewed",
      "primary_action_selected",
      "recommendation_accepted",
      "recommendation_dismissed",
      "recommendation_expanded",
      "recommendation_feedback_helped",
      "recommendation_feedback_not_useful",
      "tell_me_more",
    ].sort(),
  );
});
