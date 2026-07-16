import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /onboarding redirects to login", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});

test("Meet Your HoM onboarding ships conversation and trust seed", async () => {
  const wizard = readFileSync(
    join(process.cwd(), "components/onboarding/onboarding-wizard.tsx"),
    "utf8",
  );
  expect(wizard).toContain("excited to become your Head of Marketing");
  expect(wizard).toContain("Where do your customers come from");
  expect(wizard).toContain("Meet Your Head of Marketing");
  expect(wizard).toContain("give me more responsibility");
  expect(wizard).not.toContain("Initializing");

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
