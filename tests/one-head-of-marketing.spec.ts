import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("One Growth Advisor source ships unified briefing and demoted nav peers", async () => {
  const page = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/growth-advisor-page.tsx"),
    "utf8",
  );
  expect(page).toContain("Your Growth Advisor");

  const supporting = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/supporting-context.tsx"),
    "utf8",
  );
  expect(supporting).toContain("Your Growth Advisor is the main place to decide.");
  expect(supporting).toContain("More tools");

  const nav = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-nav.tsx"),
    "utf8",
  );
  expect(nav).toContain("Your Growth Advisor");
  expect(nav).toContain("Results");
  expect(nav).toContain("Library");
  expect(nav).toContain("primaryDashboardNavItems");
  expect(nav).toContain("advancedDashboardNavItems");

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
