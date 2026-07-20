import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /api/decision-intelligence returns unauthorized JSON", async ({ request }) => {
  const response = await request.get("/api/decision-intelligence");
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toMatch(/Unauthorized/i);
});

test("unauthenticated /api/decision-intelligence/history returns unauthorized JSON", async ({ request }) => {
  const response = await request.get("/api/decision-intelligence/history");
  expect(response.status()).toBe(401);
});

test("unauthenticated /api/decision-intelligence/changes returns unauthorized JSON", async ({ request }) => {
  const response = await request.get("/api/decision-intelligence/changes?currentDecisionId=00000000-0000-0000-0000-000000000000");
  expect(response.status()).toBe(401);
});

test("unauthenticated /api/decision-intelligence/evidence returns unauthorized JSON", async ({ request }) => {
  const response = await request.get("/api/decision-intelligence/evidence?decisionId=00000000-0000-0000-0000-000000000000");
  expect(response.status()).toBe(401);
});

test("unauthenticated /dashboard/decision-intelligence redirects toward login", async ({ page }) => {
  await page.goto("/dashboard/decision-intelligence");
  await page.waitForURL(/\/login/);
  expect(page.url()).toContain("/login");
});

test("Decision Intelligence ships on Head of Marketing, has no mutation controls, and the cron gate stays false", async () => {
  const pageSource = readFileSync(join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"), "utf8");
  expect(pageSource).toContain("WhyPlanChangedSection");
  expect(pageSource).toContain("whyPlanChanged");

  const section = readFileSync(join(process.cwd(), "components/dashboard/why-plan-changed-section.tsx"), "utf8");
  expect(section).toContain("See the full decision history");
  expect(section).not.toMatch(/<input|<textarea|onSubmit/i);

  const fullPage = readFileSync(join(process.cwd(), "components/dashboard/decision-intelligence-page.tsx"), "utf8");
  expect(fullPage).toContain("Current decision");
  expect(fullPage).toContain("What changed");
  expect(fullPage).toContain("What influenced later decisions");
  expect(fullPage).toContain("Decision timeline");
  expect(fullPage).not.toMatch(/<input|<textarea|onSubmit|method="post"/i);

  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");

  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/030_decision_intelligence.sql"),
    "utf8",
  );
  expect(migration).toContain("marketing_memory_decision_links");
  expect(migration).not.toMatch(/drop table|truncate/i);

  const interactiveEngine = readFileSync(join(process.cwd(), "lib/interactive-hom/answerEngine.ts"), "utf8");
  expect(interactiveEngine).toContain("answerWhyPlanChanged");
  expect(interactiveEngine).not.toMatch(/fetch\(|openai|anthropic/i);

  const calendarTypes = readFileSync(join(process.cwd(), "lib/strategic-marketing-calendar/calendar-types.ts"), "utf8");
  expect(calendarTypes).toContain("DECISION_INTELLIGENCE");
});
