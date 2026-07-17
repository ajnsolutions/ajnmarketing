import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Great Simplification ships four primary destinations without new engines", async () => {
  const nav = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-nav.tsx"),
    "utf8",
  );
  expect(nav).toContain('label: "Your Head of Marketing"');
  expect(nav).toContain('label: "Results"');
  expect(nav).toContain('label: "Library"');
  expect(nav).toContain('label: "Settings"');
  expect(nav).toContain('href: "/dashboard/results"');
  expect(nav).toContain('href: "/dashboard/library"');
  expect(nav).toContain('label: "This Week"');
  expect(nav).toContain('label: "Preparing for publication"');
  expect(nav).not.toContain('label: "Approval Center"');
  expect(nav).not.toContain('label: "Analytics"');

  const results = readFileSync(join(process.cwd(), "app/dashboard/results/page.tsx"), "utf8");
  expect(results).toContain("getAnalyticsPageData");

  const library = readFileSync(join(process.cwd(), "app/dashboard/library/page.tsx"), "utf8");
  expect(library).toContain("getPublishingDashboardData");

  const settings = readFileSync(
    join(process.cwd(), "components/dashboard/settings-hub.tsx"),
    "utf8",
  );
  expect(settings).toContain("Configuration");
  expect(settings).toContain("Google Profile");

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
