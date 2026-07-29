import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Regression guard for a release-blocking incident: PR #74-#78 were each
 * merged ("MERGED" on GitHub), but only into a stacked intermediate branch
 * that was never itself merged into `main` — production deployed from
 * `main` and 404'd on /snapshot, and the homepage never got its "Scan My
 * Business" entry point, because none of that code ever actually reached
 * the branch production builds from. See
 * docs/BUSINESS_DISCOVERY_SNAPSHOT_TROUBLESHOOTING.md.
 *
 * This is not a code-correctness bug any of the other test suites would
 * catch — those all pass on the stacked branch itself. This test exists
 * specifically to fail loudly if these release-critical files are ever
 * missing from whatever branch/commit it's run against, which is the one
 * class of check that would have caught the incident before it reached
 * production.
 */

const REQUIRED_FILES = [
  "app/snapshot/page.tsx",
  "app/api/business-discovery/snapshot/route.ts",
  "app/api/business-discovery/continuation/resolve/route.ts",
  "app/api/business-discovery/continuation/claim/route.ts",
  "app/api/business-discovery/continuation/confirm/route.ts",
  "components/home/home-scan-cta.tsx",
  "components/dashboard/growth-advisor/growth-advisor-page.tsx",
  "lib/business-discovery/public/service.ts",
  "lib/business-discovery/public/urlSafety.ts",
  "lib/business-discovery/continuation/service.ts",
];

test("every release-critical First Impression / Growth Advisor file exists on this branch", () => {
  const missing = REQUIRED_FILES.filter((relativePath) => !existsSync(join(root, relativePath)));
  assert.deepEqual(missing, [], `missing release-critical files: ${missing.join(", ")}`);
});

test("the homepage actually renders the Scan My Business entry point", () => {
  const homepage = readFileSync(join(root, "app/page.tsx"), "utf8");
  assert.match(homepage, /HomeScanCta/, "app/page.tsx must import and render HomeScanCta");

  const cta = readFileSync(join(root, "components/home/home-scan-cta.tsx"), "utf8");
  assert.match(cta, /Scan My Business/);
  assert.match(cta, /\/snapshot/);
});

test("the dashboard actually renders Your Growth Advisor, not a stale Head of Marketing page", () => {
  const dashboardPage = readFileSync(join(root, "app/dashboard/page.tsx"), "utf8");
  assert.match(dashboardPage, /GrowthAdvisorPage/);
  assert.doesNotMatch(dashboardPage, /HeadOfMarketingPage/);
});

test("onboarding continuation is wired -- a snapshotRef can resolve into the wizard", () => {
  const onboarding = readFileSync(join(root, "app/onboarding/page.tsx"), "utf8");
  assert.match(onboarding, /snapshotRef/);
  assert.match(onboarding, /resolveSnapshotContinuation|resolveSnapshotForUser/);
});
