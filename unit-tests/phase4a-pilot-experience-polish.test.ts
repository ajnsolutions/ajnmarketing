import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ADVANCED_NAV_GROUPS } from "../lib/customer-ux/navGroups.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

const root = process.cwd();

test("advanced nav groups are labeled and point at real dashboard routes", () => {
  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  for (const group of ADVANCED_NAV_GROUPS) {
    assert.ok(group.label.trim().length > 0);
    assert.ok(group.hrefs.length > 0);
    for (const href of group.hrefs) {
      assert.match(nav, new RegExp(`href:\\s*"${href.replace(/\//g, "\\/")}"`));
    }
  }
  assert.match(nav, /\/dashboard\/ai-profile/);
});

test("page-chrome ships orientation and workflow trail primitives", () => {
  const chrome = readFileSync(join(root, "components/dashboard/ui/page-chrome.tsx"), "utf8");
  assert.match(chrome, /export function OrientationNote/);
  assert.match(chrome, /export function WorkflowTrail/);
  assert.match(chrome, /CONTENT_WORKFLOW_STEPS/);
  assert.match(chrome, /RECOMMENDATION_WORKFLOW_STEPS/);
  assert.match(chrome, /aria-current/);
});

test("HoM reduces supporting-detail noise and clarifies next step", () => {
  const hom = readFileSync(
    join(root, "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  assert.match(hom, /This is your home base/);
  assert.match(hom, /Supporting detail/);
  assert.match(hom, /<details/);
  assert.match(hom, /nothing\s+publishes without your approval/i);
  assert.match(hom, /\/dashboard\/setup/);
});

test("recommendation cards explain why and accept outcomes without exposing raw score badge", () => {
  const card = readFileSync(
    join(root, "components/dashboard/marketing-recommendation-card.tsx"),
    "utf8",
  );
  assert.match(card, /Why you&apos;re seeing this/);
  assert.match(card, /If you accept/);
  assert.match(card, /Expected impact/);
  assert.doesNotMatch(card, /Score \$\{/);
});

test("GBP customer empty states avoid OAuth internals", () => {
  const gbp = readFileSync(
    join(root, "components/dashboard/google-business-profile-page.tsx"),
    "utf8",
  );
  assert.match(gbp, /temporarily unavailable|isn't connected yet/i);
  assert.doesNotMatch(gbp, /TOKEN_ENCRYPTION_KEY|GOOGLE_CLIENT_ID|client_secret/);
});

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});
