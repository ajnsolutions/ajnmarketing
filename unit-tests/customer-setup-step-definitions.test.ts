import assert from "node:assert/strict";
import test from "node:test";
import { listSetupStepDefinitions } from "../lib/customer-setup/steps.ts";
import { SetupStepKeys } from "../lib/customer-setup/types.ts";

/**
 * [RC-1] The notifications step's CTA previously promised an action ("Review
 * notifications") and a description implying configurable preferences
 * ("How you prefer to hear about...") that don't exist — the destination is an
 * honest "coming soon" page with nothing to configure. Locks in the fix so the
 * step's own language can't drift back out of sync with its real destination.
 */
test("notifications step CTA and description do not promise configurable preferences", () => {
  const step = listSetupStepDefinitions().find((s) => s.key === SetupStepKeys.NOTIFICATIONS);
  assert.ok(step);
  assert.notEqual(step?.primaryActionLabel, "Review notifications");
  assert.doesNotMatch(step?.description ?? "", /how you prefer/i);
  assert.doesNotMatch(step?.helpText ?? "", /defaults stay conservative until you change them/i);
});

test("every setup step definition has a non-empty primary action label and destination route", () => {
  for (const step of listSetupStepDefinitions()) {
    assert.ok(step.primaryActionLabel.trim().length > 0, `${step.key} missing a primary action label`);
    assert.ok(step.destinationRoute.startsWith("/"), `${step.key} destination route is not an app path`);
  }
});
