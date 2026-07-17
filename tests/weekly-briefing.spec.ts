import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Weekly Briefing ships on Head of Marketing surface without new nav destination", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("Weekly Briefing");
  expect(pageSource).toContain("What I handled");
  expect(pageSource).toContain("What I noticed");
  expect(pageSource).toContain("Next Week");
  expect(pageSource).toContain("timeRespectLabel");

  const nav = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-nav.tsx"),
    "utf8",
  );
  expect(nav).toContain("Your Head of Marketing");
  expect(nav).not.toContain('label: "Weekly Briefing"');

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
