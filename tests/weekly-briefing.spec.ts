import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Weekly Briefing content ships on Your Growth Advisor surface without new nav destination", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/growth-advisor-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("Your Growth Advisor");
  expect(pageSource).toContain("This week");
  expect(pageSource).toContain("What I noticed");
  expect(pageSource).toContain("Recommendation");
  expect(pageSource).toContain("Next week");

  const transform = readFileSync(
    join(process.cwd(), "lib/growth-advisor/buildGrowthAdvisorBriefing.ts"),
    "utf8",
  );
  expect(transform).toContain("timeRespectLabel");

  const nav = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-nav.tsx"),
    "utf8",
  );
  expect(nav).toContain("Your Growth Advisor");
  expect(nav).not.toContain('label: "Weekly Briefing"');

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
