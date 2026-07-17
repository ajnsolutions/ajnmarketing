import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false during UX audit branch", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("Approval Center no longer claims automatic publishing", () => {
  const source = readFileSync(
    join(root, "components/dashboard/approvals-page.tsx"),
    "utf8"
  );
  assert.equal(source.includes("Automatically Published"), false);
  assert.equal(source.includes("From AI draft to published — automatically"), false);
  assert.match(source, /Ready to Publish/);
  assert.match(source, /before anything publishes/);
  assert.match(source, /Review This Week/);
});

test("Onboarding GBP step links to the real connect flow", () => {
  const source = readFileSync(
    join(root, "components/onboarding/onboarding-wizard.tsx"),
    "utf8"
  );
  assert.equal(source.includes("Google connection coming soon"), false);
  assert.match(source, /\/dashboard\/google-business-profile\/connect/);
  assert.match(source, /Do you already have a Google Business Profile/);
});
