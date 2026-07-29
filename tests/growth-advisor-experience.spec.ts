import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Growth Advisor Experience ships conversational weekly meeting flow", () => {
  const page = read("components/dashboard/growth-advisor/growth-advisor-page.tsx");
  expect(page).toContain("This week");
  expect(page).toContain("What I noticed");
  expect(page).toContain("Why it matters");
  expect(page).toContain("Recommendation");
  expect(page).toContain("Next week");
  expect(page).toContain("One action");
  expect(page).toContain("What I&apos;m still learning");

  const greetingIndex = page.indexOf("{advisor.greeting}");
  const thisWeekIndex = page.indexOf("this-week-heading");
  const noticedIndex = page.indexOf("what-i-noticed-heading");
  const recommendIndex = page.indexOf("what-i-recommend-heading");
  const nextWeekIndex = page.indexOf("next-week-heading");
  const primaryActionIndex = page.indexOf('id="growth-advisor-primary-action"');

  expect(thisWeekIndex).toBeGreaterThan(greetingIndex);
  expect(noticedIndex).toBeGreaterThan(thisWeekIndex);
  expect(recommendIndex).toBeGreaterThan(noticedIndex);
  expect(nextWeekIndex).toBeGreaterThan(recommendIndex);
  expect(primaryActionIndex).toBeGreaterThan(nextWeekIndex);
});

test("recommendation section exposes expected impact and trust explainability", () => {
  const section = read("components/dashboard/growth-advisor/recommendation-section.tsx");
  expect(section).toContain("Expected impact");
  expect(section).toContain("Why I believe this");
  expect(section).toContain("Supporting evidence");
  expect(section).toContain("trustLabel");
  expect(section).toContain("expectedOutcomes");
});

test("build transform wires Business Brain sources without re-ranking", () => {
  const transform = read("lib/growth-advisor/buildGrowthAdvisorBriefing.ts");
  expect(transform).toContain("customerVoice");
  expect(transform).toContain("externalIntelligence");
  expect(transform).toContain("buildWhatINoticedObservations");
  expect(transform).toContain("resolveExpectedBusinessOutcomes");
  expect(transform).toContain("buildNextWeekMonitoring");
  expect(transform).toContain("NO new recommendation scores");
});

test("documentation covers experience philosophy", () => {
  expect(existsSync(join(root, "docs/project-magic/GROWTH_ADVISOR_EXPERIENCE.md"))).toBeTruthy();
  const docs = read("docs/project-magic/GROWTH_ADVISOR_EXPERIENCE.md");
  expect(docs).toContain("Conversation flow");
  expect(docs).toContain("Evidence hierarchy");
  expect(docs).toContain("Trust model");
  expect(docs).toContain("Briefing generation");
  expect(docs).toContain("Recommendation philosophy");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});

test("cron gate remains closed", () => {
  expect(read("lib/trigger/scheduleActivation.ts")).toMatch(
    /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/,
  );
});
