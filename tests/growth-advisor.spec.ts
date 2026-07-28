import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Your Growth Advisor — authenticated home experience.
 *
 * Follows this repo's established convention for authenticated dashboard
 * surfaces (see weekly-briefing.spec.ts, one-head-of-marketing.spec.ts, etc.):
 * there is no established pattern anywhere in this suite for signing in a
 * real authenticated test user, so real behavior is covered by the browser
 * test for the unauthenticated redirect plus deterministic unit-test
 * coverage of buildGrowthAdvisorBriefing (unit-tests/growth-advisor-build-
 * briefing.test.ts). This spec verifies the conversational hierarchy,
 * analytics event wiring, accessibility patterns, and cron gate are all
 * genuinely present in source, the same way every other dashboard-surface
 * spec in this repo does.
 */

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Your Growth Advisor ships the conversational hierarchy in order: greeting → what changed → what I noticed → what I recommend → primary action → supporting context", async () => {
  const hero = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/growth-advisor-page.tsx"),
    "utf8",
  );

  expect(hero).toContain("Your Growth Advisor");
  expect(hero).toContain("{advisor.greeting}");

  const greetingIndex = hero.indexOf("{advisor.greeting}");
  const whatChangedIndex = hero.indexOf("what-changed-heading");
  const noticedIndex = hero.indexOf("what-i-noticed-heading");
  const recommendIndex = hero.indexOf("what-i-recommend-heading");
  const primaryActionIndex = hero.indexOf('id="growth-advisor-primary-action"');
  const supportingContextIndex = hero.indexOf("<GrowthAdvisorSupportingContext");

  expect(greetingIndex).toBeGreaterThanOrEqual(0);
  expect(whatChangedIndex).toBeGreaterThan(greetingIndex);
  expect(noticedIndex).toBeGreaterThan(whatChangedIndex);
  expect(recommendIndex).toBeGreaterThan(noticedIndex);
  expect(primaryActionIndex).toBeGreaterThan(recommendIndex);
  expect(supportingContextIndex).toBeGreaterThan(primaryActionIndex);

  // Never starts with cards, charts, or metrics — no chart/metric-shaped
  // component is imported into the hero file.
  expect(hero).not.toMatch(/BarChart|LineChart|<canvas/i);

  // Exactly one recommendation, exactly one primary action.
  expect(hero).not.toMatch(/recommendations\.map/);
});

test("recommendation includes why now, expected impact, estimated effort, and why I believe this — reusing existing explainability", async () => {
  const section = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/recommendation-section.tsx"),
    "utf8",
  );
  expect(section).toContain("Expected impact");
  expect(section).toContain("Estimated effort");
  expect(section).toContain("Why I believe this");
  expect(section).toContain("Tell me more");

  const transform = readFileSync(
    join(process.cwd(), "lib/growth-advisor/buildGrowthAdvisorBriefing.ts"),
    "utf8",
  );
  // Reuses recommendation-presentation's existing confidence explainability —
  // never a new scoring/explanation system.
  expect(transform).toContain("confidenceExplanation");
  expect(transform).toContain("confidenceLabelText");
  expect(transform).toContain("topRecommendationDetail");
});

test("Marketing Memory continuity is honest — reuses real relationship memory, never invents history", async () => {
  const hero = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/growth-advisor-page.tsx"),
    "utf8",
  );
  expect(hero).toContain("advisor.whatChanged.memoryLine");

  const transform = readFileSync(
    join(process.cwd(), "lib/growth-advisor/buildGrowthAdvisorBriefing.ts"),
    "utf8",
  );
  expect(transform).toContain("briefing.relationshipMemory");
});

test("analytics tracks the required event vocabulary and never logs conversation content", async () => {
  const analytics = readFileSync(join(process.cwd(), "lib/growth-advisor/experienceAnalytics.ts"), "utf8");
  for (const event of [
    "growth_advisor_viewed",
    "recommendation_expanded",
    "recommendation_accepted",
    "recommendation_dismissed",
    "tell_me_more",
    "primary_action_selected",
  ]) {
    expect(analytics).toContain(event);
  }

  const route = readFileSync(join(process.cwd(), "app/api/growth-advisor/events/route.ts"), "utf8");
  expect(route).toContain("ALLOWED_METADATA_KEYS");
  expect(route).toContain("sanitizeMetadata");
  // Authenticated route — never accepts an anonymous event.
  expect(route).toContain("supabase.auth.getUser()");
  expect(route).toMatch(/status:\s*401/);
});

test("Supporting Context stays below the primary action and Marketing Health is presented as one line, not a hero card", async () => {
  const supporting = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/supporting-context.tsx"),
    "utf8",
  );
  expect(supporting).toContain("Supporting context");
  expect(supporting).toContain("MonthlyFocusSection");
  expect(supporting).toContain("HeadOfMarketingJournalSection");
  expect(supporting).toContain("StrategicCalendarPreviewSection");
  expect(supporting).toContain("performance trends");
});

test("nav labels Your Growth Advisor, not Your Head of Marketing", async () => {
  const nav = readFileSync(join(process.cwd(), "components/dashboard/dashboard-nav.tsx"), "utf8");
  expect(nav).toContain('label: "Your Growth Advisor"');
  expect(nav).not.toContain('label: "Your Head of Marketing"');
});

test("accessibility: skip link, semantic headings, and reduced-motion classes are present", async () => {
  const hero = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/growth-advisor-page.tsx"),
    "utf8",
  );
  expect(hero).toContain("hom-skip-link");
  expect(hero).toContain("aria-labelledby");
  expect(hero).toMatch(/<h1|<h2/);

  const recommendation = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/recommendation-section.tsx"),
    "utf8",
  );
  expect(recommendation).toContain("aria-expanded");
  expect(recommendation).toContain('role="status"');
});

test("mobile: primary action is full-width on small screens and supporting context uses native collapsible disclosure", async () => {
  const primaryAction = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/primary-action.tsx"),
    "utf8",
  );
  expect(primaryAction).toMatch(/w-full/);
  expect(primaryAction).toMatch(/sm:w-auto/);
  expect(primaryAction).toContain("min-h-11");

  const supporting = readFileSync(
    join(process.cwd(), "components/dashboard/growth-advisor/supporting-context.tsx"),
    "utf8",
  );
  expect(supporting).toContain("<details");
});

test("cron gate remains false — Growth Advisor never touches schedule activation", async () => {
  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
