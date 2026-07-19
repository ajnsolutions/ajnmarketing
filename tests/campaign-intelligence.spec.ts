import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Campaign Intelligence ships on Head of Marketing with timeline and cron gate", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("CampaignsSection");
  expect(pageSource).toContain("MonthlyFocusSection");

  const section = readFileSync(
    join(process.cwd(), "components/dashboard/campaigns-section.tsx"),
    "utf8",
  );
  expect(section).toContain("Active campaigns");
  expect(section).toContain("Show timeline");
  expect(section).toContain("aria-expanded");
  expect(section).toContain("aria-labelledby");
  expect(section).toContain("hom-focusable");
  expect(section).toContain("sm:p-6");

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");

  const templates = readFileSync(
    join(process.cwd(), "lib/campaign-intelligence/campaign-templates.ts"),
    "utf8",
  );
  expect(templates).toContain("back_to_school");
  expect(templates).toContain("RecommendedActionTypes.PUBLISH_GBP_POST");
  expect(templates).not.toMatch(/openai|generateRecommendation/i);
});
