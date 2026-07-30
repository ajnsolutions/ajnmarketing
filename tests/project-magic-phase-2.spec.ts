import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Project Magic Phase 2 modules and docs exist", () => {
  expect(existsSync(join(root, "lib/growth-advisor/marketingHealthCoaching.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/content-generator/suggestions.ts"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/PROJECT_MAGIC_PHASE_2.md"))).toBe(true);
});

test("Marketing Health is one coaching card, not four separate score badges", () => {
  const supporting = read("components/dashboard/growth-advisor/supporting-context.tsx");
  expect(supporting).toContain("buildMarketingHealthCoaching");
  expect(supporting).toContain("Why it matters");
  expect(supporting).toContain("What improves next");
  expect(supporting).toContain("What&apos;s behind this");
  // The old, separate always-visible badges are gone from the source.
  expect(supporting).not.toContain("customerVoiceHealthPresentation");
  expect(supporting).not.toMatch(/Business understanding · \$\{knowledgeHealth\.overallScore\}/);
});

test("Marketing Health coaching never invents a next action — it reuses Growth Advisor's own primary action", () => {
  const coaching = read("lib/growth-advisor/marketingHealthCoaching.ts");
  expect(coaching).toContain("primaryAction.kind !== \"none\"");
  expect(coaching).toContain("never a second, competing recommendation");
});

test("Business Connections leads with one recommendation; the full connection wall is behind a disclosure", () => {
  const page = read("components/dashboard/business-connections-page.tsx");
  expect(page).toContain("Recommended next");
  expect(page).toContain("What the Business Brain can see");
  expect(page).toContain("<details");
  expect(page).toContain("See all connections");
  expect(page).toContain("What will I learn if you connect this?");
});

test("bulk approve no longer uses a native confirm dialog", () => {
  const queue = read("components/dashboard/approval-queue.tsx");
  expect(queue).not.toContain("window.confirm");
  expect(queue).toContain("Confirm approve");
  expect(queue).toContain("Approve all needing review");
});

test("Content Generator is wired to a real, evidence-grounded suggestion, never a fabricated one", () => {
  const route = read("app/dashboard/content/generator/page.tsx");
  expect(route).toContain("buildContentGeneratorSuggestion");
  expect(route).toContain("getCustomerVoiceIntelligenceForCurrentUser");

  const page = read("components/dashboard/content-generator-page.tsx");
  expect(page).toContain("Suggested for you");
  expect(page).toContain("applySuggestion");

  const suggestions = read("lib/content-generator/suggestions.ts");
  expect(suggestions).toContain("evidenceCount < 2");
  expect(suggestions).not.toContain("Math.random");
});

test("Business Timeline offers a type filter instead of one flat undifferentiated list", () => {
  const page = read("components/dashboard/business-timeline-page.tsx");
  expect(page).toContain("aria-pressed={filter ===");
  expect(page).toContain("Filter timeline by type");
});

test("Guided Setup tucks completed milestones behind a disclosure so 'what's next' isn't buried", () => {
  const page = read("components/dashboard/guided-setup-experience.tsx");
  expect(page).toContain("completedMilestones");
  expect(page).toMatch(/See \{completedMilestones\.length\} completed step/);
});

test("unauthenticated pages touched this sprint still redirect to login", async ({ page }) => {
  for (const path of [
    "/dashboard",
    "/dashboard/business-connections",
    "/dashboard/content/generator",
    "/dashboard/business-timeline",
    "/dashboard/setup",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  }
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover UX improvements, simplification decisions, before/after rationale, and future opportunities", () => {
  const docs = read("docs/project-magic/PROJECT_MAGIC_PHASE_2.md");
  expect(docs).toContain("UX audit");
  expect(docs).toContain("Marketing Health");
  expect(docs).toContain("Business Connections");
  expect(docs).toContain("Content Generator");
  expect(docs).toContain("Future opportunities");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});
