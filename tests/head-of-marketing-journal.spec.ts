import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("HoM Journal ships as progressive disclosure without new top-level nav", async () => {
  const journalUi = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-journal.tsx"),
    "utf8",
  );
  expect(journalUi).toContain("While you were busy");
  expect(journalUi).toContain("journal.entries");

  const nav = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-nav.tsx"),
    "utf8",
  );
  expect(nav).toContain("Your Head of Marketing");
  expect(nav).not.toContain('label: "Journal"');

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
