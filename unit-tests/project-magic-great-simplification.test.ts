import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  HOM_ADVANCED_NAV_HREFS,
  HOM_PRIMARY_NAV_HREFS,
} from "../lib/head-of-marketing/types.ts";
import { FOCUSED_NAV_HREFS } from "../lib/dashboard/first-days-home.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Great Simplification", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("primary nav is HoM + Results + Library + Settings only", () => {
  assert.deepEqual([...HOM_PRIMARY_NAV_HREFS], [
    "/dashboard",
    "/dashboard/results",
    "/dashboard/library",
    "/dashboard/settings",
  ]);
  assert.deepEqual([...FOCUSED_NAV_HREFS], [...HOM_PRIMARY_NAV_HREFS]);

  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  assert.match(nav, /label: "Your Head of Marketing"/);
  assert.match(nav, /label: "Results"/);
  assert.match(nav, /label: "Library"/);
  assert.match(nav, /label: "Settings"/);
  assert.match(nav, /href: "\/dashboard\/results"/);
  assert.match(nav, /href: "\/dashboard\/library"/);
});

test("This Week and Google Profile are progressive disclosure, not primary", () => {
  assert.equal((HOM_PRIMARY_NAV_HREFS as readonly string[]).includes("/dashboard/approvals"), false);
  assert.equal(
    (HOM_PRIMARY_NAV_HREFS as readonly string[]).includes("/dashboard/google-business-profile"),
    false,
  );
  assert.ok((HOM_ADVANCED_NAV_HREFS as readonly string[]).includes("/dashboard/approvals"));
  assert.ok(
    (HOM_ADVANCED_NAV_HREFS as readonly string[]).includes("/dashboard/google-business-profile"),
  );

  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  const primaryBlock = nav.slice(
    nav.indexOf("export const primaryDashboardNavItems"),
    nav.indexOf("export const focusedDashboardNavHrefs"),
  );
  assert.equal(primaryBlock.includes("/dashboard/approvals"), false);
  assert.equal(primaryBlock.includes("/dashboard/google-business-profile"), false);
  assert.match(nav, /label: "This Week"/);
  assert.match(nav, /label: "Preparing for publication"/);
  assert.equal(nav.includes('label: "Notifications"'), false);
  assert.equal(nav.includes('label: "Billing"'), false);
});

test("customer language replaces software titles on key surfaces", () => {
  const approvals = readFileSync(join(root, "components/dashboard/approvals-page.tsx"), "utf8");
  assert.match(approvals, /This Week/);
  assert.equal(approvals.includes("Approval Center"), false);

  const publishing = readFileSync(join(root, "components/dashboard/publishing-page.tsx"), "utf8");
  assert.match(publishing, /Preparing for publication/);
  assert.equal(publishing.includes("Publishing Queue"), false);

  const recommendations = readFileSync(
    join(root, "components/dashboard/marketing-recommendations-page.tsx"),
    "utf8",
  );
  assert.match(recommendations, /What I&apos;d recommend/);
  assert.equal(recommendations.includes("Marketing Recommendations"), false);

  const tasks = readFileSync(
    join(root, "components/dashboard/marketing-agent-tasks-page.tsx"),
    "utf8",
  );
  assert.match(tasks, /What I&apos;m working on/);

  const command = readFileSync(join(root, "components/dashboard/command-center-page.tsx"), "utf8");
  assert.match(command, /Detailed workspace/);
  assert.equal(command.includes("AI Marketing Command Center"), false);
});

test("Results and Library routes exist; legacy analytics/content redirect", () => {
  const results = readFileSync(join(root, "app/dashboard/results/page.tsx"), "utf8");
  const library = readFileSync(join(root, "app/dashboard/library/page.tsx"), "utf8");
  const analytics = readFileSync(join(root, "app/dashboard/analytics/page.tsx"), "utf8");
  const content = readFileSync(join(root, "app/dashboard/content/page.tsx"), "utf8");

  assert.match(results, /experience="results"/);
  assert.match(library, /experience="library"/);
  assert.match(analytics, /redirect\("\/dashboard\/results"\)/);
  assert.match(content, /redirect\("\/dashboard\/library"\)/);
});

test("Great Simplification docs and presentation-only guardrails", () => {
  const doc = readFileSync(join(root, "docs/GREAT_SIMPLIFICATION.md"), "utf8");
  assert.match(doc, /Navigation reductions/);
  assert.match(doc, /Pages consolidated/);
  assert.match(doc, /Progressive disclosure/);
  assert.match(doc, /Primary action philosophy/);
  assert.match(doc, /Future simplification opportunities/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  assert.equal(nav.includes("runMarketingDecisionEngine"), false);
  assert.equal(nav.includes("generateWeeklyApprovalPackage"), false);

  const gate = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(gate, /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/);
});
