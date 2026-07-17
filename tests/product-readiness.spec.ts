import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Product Readiness polish ships without backend or schedule changes", async () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  expect(css).toContain("prefers-reduced-motion");
  expect(css).toContain("hom-focusable");

  const states = readFileSync(
    join(process.cwd(), "components/dashboard/ui/dashboard-states.tsx"),
    "utf8",
  );
  expect(states).toContain("I couldn't complete that just now");
  expect(states).not.toContain("Loading dashboard...");

  const hom = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(hom).toContain("What I handled");
  expect(hom).toContain("hom-focusable");

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
