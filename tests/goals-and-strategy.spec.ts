import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("onboarding asks what success looks like with multi-select goals", () => {
  const wizard = read("components/onboarding/onboarding-wizard.tsx");
  expect(wizard).toContain("What would success look like for your business over the next year?");
  expect(wizard).toContain("successGoals");
  expect(wizard).toContain("GOAL_TIMEFRAME_OPTIONS");
  expect(wizard).not.toContain('Ask:\n"What are your goals?"');
});

test("setup goals form supports priority ordering and timeframe", () => {
  const form = read("components/dashboard/setup-goals-form.tsx");
  expect(form).toContain("What would success look like");
  expect(form).toContain("moveGoal");
  expect(form).toContain("applyBusinessGoalsToMarketingGoals");
});

test("Growth Advisor surfaces goal progress and supports-goal on recommendations", () => {
  const page = read("components/dashboard/growth-advisor/growth-advisor-page.tsx");
  expect(page).toContain("Progress toward goals");
  expect(page).toContain("Strategic focus");
  expect(page).toContain("Recommended next step");

  const rec = read("components/dashboard/growth-advisor/recommendation-section.tsx");
  expect(rec).toContain("Supports goal");
  expect(rec).toContain("Expected impact");
  expect(rec).toContain("Estimated effort");
  expect(rec).toContain("Why I believe this");
});

test("strategy layer does not replace recommendation ranking", () => {
  const strategy = read("lib/strategy/goalRelevance.ts");
  expect(strategy).toContain("Does NOT rank, score, or replace");
  expect(strategy).toContain("explainGoalRelevance");

  const schedule = read("lib/trigger/scheduleActivation.ts");
  expect(schedule).toMatch(/ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/);
});

test("goals and strategy documentation exists", () => {
  const docs = read("docs/project-magic/GOALS_AND_STRATEGY.md");
  expect(docs).toContain("Goal model");
  expect(docs).toContain("Strategy layer");
  expect(docs).toContain("Goal Progress");
  expect(docs).toContain("Recommendation ranking");
  expect(docs).toContain("Future roadmap");
});
