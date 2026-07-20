import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard redirects toward login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated Decision Intelligence redirects toward login", async ({ page }) => {
  await page.goto("/dashboard/decision-intelligence");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated Strategic Calendar redirects toward login", async ({ page }) => {
  await page.goto("/dashboard/strategic-marketing-calendar");
  await expect(page).toHaveURL(/\/login/);
});

test("cross-tenant APIs remain unauthorized without a session", async ({ request }) => {
  const endpoints = [
    "/api/decision-intelligence",
    "/api/experiments",
    "/api/campaigns",
    "/api/strategic-marketing-calendar",
    "/api/interactive-hom",
  ];
  for (const endpoint of endpoints) {
    const response =
      endpoint === "/api/interactive-hom"
        ? await request.post(endpoint, { data: { question: "What should I work on today?" } })
        : await request.get(endpoint);
    expect(response.status(), endpoint).toBe(401);
  }
});

test("Customer Experience Polish ships hierarchy, honest experiments, and cron gate", async () => {
  const hom = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(hom).toContain("ExecutiveBriefSection");
  expect(hom).toContain("hom-primary-action");
  expect(hom).toContain("WhyPlanChangedSection");
  expect(hom).toContain("StrategicCalendarPreviewSection");
  expect(hom).toContain("CampaignsSection");
  expect(hom).toContain("ExperimentsSection");
  expect(hom).toContain("AskHeadOfMarketingPanel");
  expect(hom.indexOf("hom-primary-action")).toBeLessThan(hom.indexOf("<WhyPlanChangedSection"));
  expect(hom.indexOf("<WhyPlanChangedSection")).toBeLessThan(
    hom.indexOf("<StrategicCalendarPreviewSection"),
  );
  expect(hom.indexOf("<CampaignsSection")).toBeLessThan(hom.indexOf("<AskHeadOfMarketingPanel"));

  const experiments = readFileSync(
    join(process.cwd(), "components/dashboard/experiments-section.tsx"),
    "utf8",
  );
  expect(experiments).toContain("Inconclusive");
  expect(experiments).toContain("No winner was selected");
  expect(experiments).not.toMatch(/Winner badge|Declare winner/i);
  expect(experiments).not.toMatch(/contentEditable|free-form create/i);

  const di = readFileSync(
    join(process.cwd(), "components/dashboard/decision-intelligence-page.tsx"),
    "utf8",
  );
  expect(di).toContain("Show evidence");
  expect(di).toContain("aria-expanded");
  expect(di).not.toMatch(/<input|<textarea|onSubmit/i);

  const ask = readFileSync(
    join(process.cwd(), "components/dashboard/ask-head-of-marketing.tsx"),
    "utf8",
  );
  expect(ask).toContain("groupInteractiveHomPrompts");
  const promptGroups = readFileSync(
    join(process.cwd(), "lib/interactive-hom/promptGroups.ts"),
    "utf8",
  );
  expect(promptGroups).toContain("Current priorities");

  const calendar = readFileSync(
    join(process.cwd(), "components/dashboard/strategic-marketing-calendar-page.tsx"),
    "utf8",
  );
  expect(calendar).toContain("DAY");
  expect(calendar).toContain("WEEK");
  expect(calendar).toContain("MONTH");
  expect(calendar).toContain("FILTER_GROUP_LABELS");
  expect(calendar).toContain("Escape");
  expect(calendar).toContain("dialogRef");

  const vocab = readFileSync(join(process.cwd(), "lib/customer-ux/statusVocabulary.ts"), "utf8");
  expect(vocab).toContain("Awaiting approval");
  expect(vocab).toContain("Early signal");

  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");

  const nav = readFileSync(join(process.cwd(), "components/dashboard/dashboard-nav.tsx"), "utf8");
  expect(nav).toContain("/dashboard/decision-intelligence");
});

test("mobile-oriented classes exist on primary polish surfaces", async () => {
  const files = [
    "components/dashboard/head-of-marketing-page.tsx",
    "components/dashboard/experiments-section.tsx",
    "components/dashboard/campaigns-section.tsx",
    "components/dashboard/decision-intelligence-page.tsx",
    "components/dashboard/ask-head-of-marketing.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source, file).toMatch(/sm:|min-h-11|hom-focusable/);
  }
});
