import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Proactive HoM ships on dashboard without becoming a notification center", async () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("ProactivePresenceSection");
  expect(pageSource).toContain("Weekly Briefing");

  const presence = readFileSync(
    join(process.cwd(), "components/dashboard/proactive-presence.tsx"),
    "utf8",
  );
  expect(presence).toContain("More updates");
  expect(presence).not.toContain("URGENT");
  expect(presence).not.toContain("CRITICAL");
  expect(presence).not.toContain("WARNING");

  const journal = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-journal.tsx"),
    "utf8",
  );
  expect(journal).toContain("timelineTitle");
  expect(journal).toContain("ACTIVITY_EVENT_LABELS");

  const nav = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-nav.tsx"),
    "utf8",
  );
  expect(nav).toContain("Your Head of Marketing");
  expect(nav).not.toContain('label: "Proactive"');

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
