import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Interactive Head of Marketing ships as Ask panel without schedules or new engines", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("AskHeadOfMarketingPanel");
  expect(pageSource).toContain("CampaignsSection");
  expect(pageSource).toContain("ExecutiveBriefSection");

  const panel = readFileSync(
    join(process.cwd(), "components/dashboard/ask-head-of-marketing.tsx"),
    "utf8",
  );
  expect(panel).toContain("Ask your Head of Marketing");
  expect(panel).toContain("Suggested questions");
  expect(panel).toContain("aria-live");
  expect(panel).toContain("hom-focusable");
  expect(panel).toContain("sm:flex-row");
  expect(panel).toContain("/api/interactive-hom");

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");

  const engine = readFileSync(
    join(process.cwd(), "lib/interactive-hom/answerEngine.ts"),
    "utf8",
  );
  expect(engine).not.toMatch(/openai|createRecommendation/i);
});
