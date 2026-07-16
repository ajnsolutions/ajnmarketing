import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /onboarding redirects to login", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});

test("Magic first-five-minutes source ships calm Head of Marketing onboarding", async () => {
  const wizard = readFileSync(
    join(process.cwd(), "components/onboarding/onboarding-wizard.tsx"),
    "utf8",
  );
  expect(wizard).toContain("Head of Marketing");
  expect(wizard).toContain("Learning about your business");
  expect(wizard).toContain("Go to Dashboard");

  const home = readFileSync(
    join(process.cwd(), "components/dashboard/first-days-home.tsx"),
    "utf8",
  );
  expect(home).toContain("Setup progress");
  expect(home).toContain("Everything is underway");
});
