import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /onboarding redirects to login", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});

test("Magic first-five-minutes source ships calm Growth Advisor onboarding", async () => {
  const wizard = readFileSync(
    join(process.cwd(), "components/onboarding/onboarding-wizard.tsx"),
    "utf8",
  );
  expect(wizard).toContain("Growth Advisor");
  expect(wizard).toContain("Meet Your Growth Advisor");
  expect(wizard).toContain("already started learning about your business");

  const home = readFileSync(
    join(process.cwd(), "components/dashboard/first-days-home.tsx"),
    "utf8",
  );
  expect(home).toContain("Getting to know your business");
  expect(home).toContain("Everything is underway");
});
