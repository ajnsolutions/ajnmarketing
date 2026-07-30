import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Guided Setup docs and modules exist", () => {
  expect(existsSync(join(root, "docs/project-magic/GUIDED_SETUP.md"))).toBe(true);
  expect(existsSync(join(root, "lib/guided-setup/buildGuidedSetupExperience.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/guided-setup/firstWins.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/guided-setup-experience.tsx"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/growth-advisor/setup-progress-section.tsx"))).toBe(
    true,
  );
});

test("guided experience shows milestones, first wins, and one next step", () => {
  const page = read("components/dashboard/guided-setup-experience.tsx");
  expect(page).toContain("Meaningful milestones");
  expect(page).toContain("First win");
  expect(page).toContain("Recommended next");
  expect(page).toContain("How this helps the Business Brain");
  expect(page).toContain("Known · Learning · Waiting");
  expect(page).not.toMatch(/percent complete|progress bar|%\s*complete/i);
});

test("setup route defaults to guided experience; checklist is progressive disclosure", () => {
  const route = read("app/dashboard/setup/page.tsx");
  expect(route).toContain("GuidedSetupExperiencePage");
  expect(route).toContain('view === "checklist"');
  expect(route).toContain("SetupChecklist");
});

test("Growth Advisor and readiness gate recognize onboarding progress", () => {
  const ga = read("components/dashboard/growth-advisor/growth-advisor-page.tsx");
  expect(ga).toContain("GrowthAdvisorSetupProgress");
  expect(ga).toContain("guidedSetup");

  const readiness = read("components/dashboard/setup-hom-readiness.tsx");
  expect(readiness).toContain("First win");
  expect(readiness).toContain("Recommended next");
  expect(readiness).toContain("What&apos;s missing");
  expect(readiness).toContain("What I&apos;ll improve");
  expect(readiness).not.toMatch(/failed setup|system error/i);

  const dashboard = read("app/dashboard/page.tsx");
  expect(dashboard).toContain("getGuidedSetupExperienceForCurrentUser");
  expect(dashboard).toContain("guidedSetup");
});

test("docs and cron gate", () => {
  const docs = read("docs/project-magic/GUIDED_SETUP.md");
  expect(docs).toContain("Setup philosophy");
  expect(docs).toContain("First-win model");
  expect(docs).toContain("Readiness flow");
  expect(docs).toContain("Business Brain activation");

  const cron = read("lib/trigger/scheduleActivation.ts");
  expect(cron).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
