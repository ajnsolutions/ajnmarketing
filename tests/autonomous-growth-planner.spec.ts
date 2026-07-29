import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Autonomous Growth Planner docs and engine modules exist", () => {
  expect(existsSync(join(root, "docs/project-magic/AUTONOMOUS_GROWTH_PLANNER.md"))).toBe(true);
  expect(existsSync(join(root, "lib/growth-planner/buildWeeklyGrowthPlan.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/growth-planner/history.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/growth-planner/service.ts"))).toBe(true);
  expect(
    existsSync(join(root, "components/dashboard/growth-advisor/weekly-growth-plan-section.tsx")),
  ).toBe(true);
});

test("Growth Advisor surfaces Weekly Growth Plan without autopilot", () => {
  const page = read("components/dashboard/growth-advisor/growth-advisor-page.tsx");
  expect(page).toContain("WeeklyGrowthPlanSection");
  expect(page).toContain("weeklyPlan");

  const section = read("components/dashboard/growth-advisor/weekly-growth-plan-section.tsx");
  expect(section).toContain("Weekly Growth Plan");
  expect(section).toContain("Primary objective");
  expect(section).toContain("Why now");
  expect(section).toContain("Expected impact");
  expect(section).toContain("Estimated effort");
  expect(section).toContain("Supporting actions");
  expect(section).toContain("Success metric");
  expect(section).toContain("What I&apos;ll watch");
  expect(section).toContain("Plan history");
  expect(section).toMatch(/nothing runs automatically|Nothing runs automatically/i);
  expect(section).not.toMatch(/auto-publish|autopilot|execute automatically/i);

  const dashboard = read("app/dashboard/page.tsx");
  expect(dashboard).toContain("getWeeklyGrowthPlanForCurrentUser");
});

test("planner preserves single objective and cron gate", () => {
  const primary = read("lib/growth-planner/primaryObjective.ts");
  expect(primary).toContain("exactly one");
  expect(primary).toContain("resolvePrimaryObjective");

  const compose = read("lib/growth-planner/buildWeeklyGrowthPlan.ts");
  expect(compose).toContain("exactly one weekly plan");
  expect(compose).toContain("never executes");

  const cron = read("lib/trigger/scheduleActivation.ts");
  expect(cron).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs describe planning engine, evidence, lifecycle, history, future execution", () => {
  const docs = read("docs/project-magic/AUTONOMOUS_GROWTH_PLANNER.md");
  expect(docs).toContain("Planning engine");
  expect(docs).toContain("Evidence synthesis");
  expect(docs).toContain("Weekly lifecycle");
  expect(docs).toContain("History model");
  expect(docs).toContain("Future autonomous execution");
  expect(docs).toContain("__weekly_growth_plans_v1__");
});
