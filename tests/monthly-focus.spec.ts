import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Monthly Focus ships on Head of Marketing surface without new nav destination", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("MonthlyFocusSection");
  expect(pageSource).toContain("Your Head of Marketing is the main place to decide.");

  const section = readFileSync(
    join(process.cwd(), "components/dashboard/monthly-focus-section.tsx"),
    "utf8",
  );
  expect(section).toContain("focus.title");
  expect(section).toContain("What we");
  expect(section).toContain("priorities");
  expect(section).not.toContain("Marketing Strategy");
  expect(section).not.toContain("Planning Engine");
  expect(section).not.toContain("Roadmap");

  const focusSrc = readFileSync(
    join(process.cwd(), "lib/head-of-marketing/monthlyFocus.ts"),
    "utf8",
  );
  expect(focusSrc).toContain("This Month's Focus");

  const nav = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-nav.tsx"),
    "utf8",
  );
  expect(nav).toContain("Your Head of Marketing");
  expect(nav).not.toContain('label: "Monthly Focus"');
  expect(nav).not.toContain('label: "This Month\'s Focus"');

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
