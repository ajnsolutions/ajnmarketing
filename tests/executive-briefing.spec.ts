import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Executive Brief ships on Head of Marketing without new engines or schedules", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("ExecutiveBriefSection");

  const card = readFileSync(
    join(process.cwd(), "components/dashboard/executive-brief-section.tsx"),
    "utf8",
  );
  expect(card).toContain("Executive Brief");
  expect(card).toContain("Show full brief details");
  expect(card).toContain("Refresh");
  expect(card).toContain("<details");
  expect(card).toContain("aria-labelledby");
  expect(card).toContain("hom-focusable");

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
