import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated primary destinations redirect toward login", async ({ page }) => {
  for (const path of [
    "/dashboard",
    "/dashboard/marketing-recommendations",
    "/dashboard/approvals",
    "/dashboard/publishing",
    "/dashboard/settings",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("unauthenticated workflow APIs remain unauthorized", async ({ request }) => {
  for (const endpoint of [
    "/api/setup/status",
    "/api/publishing",
    "/api/content-approval",
  ]) {
    const response = await request.get(endpoint);
    expect(response.status(), endpoint).toBe(401);
  }
});

test("Phase 4A ships orientation, grouped nav, workflow trail, and cron gate", async () => {
  const chrome = readFileSync(
    join(process.cwd(), "components/dashboard/ui/page-chrome.tsx"),
    "utf8",
  );
  expect(chrome).toContain("OrientationNote");
  expect(chrome).toContain("WorkflowTrail");
  expect(chrome).toContain("CONTENT_WORKFLOW_STEPS");

  const sidebar = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-sidebar.tsx"),
    "utf8",
  );
  expect(sidebar).toContain("ADVANCED_NAV_GROUPS");
  expect(sidebar).toContain("group.label");

  const groups = readFileSync(join(process.cwd(), "lib/customer-ux/navGroups.ts"), "utf8");
  expect(groups).toContain("this_week");
  expect(groups).toContain("Marketing foundation");
  expect(groups).toContain("/dashboard/ai-profile");

  const hom = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(hom).toContain("Supporting detail");
  expect(hom).toContain("<details");

  const docs = readFileSync(
    join(process.cwd(), "docs/PHASE4A_PILOT_EXPERIENCE_POLISH.md"),
    "utf8",
  );
  expect(docs).toContain("Remaining UX backlog");
  expect(docs).toContain("Phase 4B recommendation");

  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
