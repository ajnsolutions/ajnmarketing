import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated setup redirects toward login", async ({ page }) => {
  await page.goto("/dashboard/setup");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated setup APIs remain unauthorized", async ({ request }) => {
  const endpoints = [
    { method: "GET", url: "/api/setup/status" },
    { method: "POST", url: "/api/setup/preferences", data: { dismissOnboarding: true } },
    { method: "POST", url: "/api/setup/steps/website/skip" },
    { method: "POST", url: "/api/setup/steps/approval_education/acknowledge" },
  ] as const;

  for (const endpoint of endpoints) {
    const response =
      endpoint.method === "GET"
        ? await request.get(endpoint.url)
        : await request.post(endpoint.url, { data: "data" in endpoint ? endpoint.data : {} });
    expect(response.status(), endpoint.url).toBe(401);
  }
});

test("guided onboarding ships setup model, page, card, and cron gate", async () => {
  const steps = readFileSync(join(process.cwd(), "lib/customer-setup/steps.ts"), "utf8");
  const types = readFileSync(join(process.cwd(), "lib/customer-setup/types.ts"), "utf8");
  expect(types).toContain('BUSINESS_INFO: "business_info"');
  expect(types).toContain('MARKETING_GOALS: "marketing_goals"');
  expect(types).toContain('GOOGLE_BUSINESS: "google_business"');
  expect(types).toContain('APPROVAL_EDUCATION: "approval_education"');
  expect(steps).toContain("SetupStepKeys.BUSINESS_INFO");
  expect(steps).toContain("SetupStepKeys.APPROVAL_EDUCATION");
  expect(steps).not.toMatch(/create campaign automatically|launch experiment|auto.?publish/i);

  const progress = readFileSync(join(process.cwd(), "lib/customer-setup/progress.ts"), "utf8");
  expect(progress).toContain("computeCustomerSetupSnapshot");
  expect(progress).toContain("requiredPercentComplete");
  expect(progress).toContain("shouldShowDashboardSetupCard");
  expect(progress).not.toMatch(/page.?visit|visited_at.*complete/i);

  const checklist = readFileSync(
    join(process.cwd(), "components/dashboard/setup-checklist.tsx"),
    "utf8",
  );
  expect(checklist).toContain("Required setup");
  expect(checklist).toContain("Optional enhancements");
  expect(checklist).toContain("role=\"progressbar\"");
  expect(checklist).toContain("Skip for now");
  expect(checklist).toContain("Open Head of Marketing");

  const card = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-setup-card.tsx"),
    "utf8",
  );
  expect(card).toContain("Continue setup");
  expect(card).toContain("/dashboard/setup");

  const hom = readFileSync(
    join(process.cwd(), "components/dashboard/setup-hom-readiness.tsx"),
    "utf8",
  );
  expect(hom).toContain("A little more setup first");
  expect(hom).toContain("Nothing strategic is");

  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/031_customer_setup_preferences.sql"),
    "utf8",
  );
  expect(migration).toContain("customer_setup_preferences");
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("business_profiles bp");
  expect(migration).toContain("skipped_step_keys");
  expect(migration).not.toContain("required_percent");

  const gbp = readFileSync(
    join(process.cwd(), "components/dashboard/gbp-connect-page.tsx"),
    "utf8",
  );
  expect(gbp).not.toMatch(/TOKEN_ENCRYPTION_KEY|GOOGLE_CLIENT_ID|client_secret/i);
  expect(gbp).toContain("Optional connection");

  const website = readFileSync(
    join(process.cwd(), "components/dashboard/website-no-website-action.tsx"),
    "utf8",
  );
  expect(website).toContain("I don&apos;t have a website");

  const settings = readFileSync(
    join(process.cwd(), "components/dashboard/settings-hub.tsx"),
    "utf8",
  );
  expect(settings).toContain("/dashboard/setup");

  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");

  const docs = readFileSync(
    join(process.cwd(), "docs/GUIDED_ONBOARDING_AND_SETUP.md"),
    "utf8",
  );
  expect(docs).toContain("Authoritative setup-state source");
  expect(docs).toContain("No duplicate engines");
});

test("setup mobile layout primitives keep stacked actions", async () => {
  const checklist = readFileSync(
    join(process.cwd(), "components/dashboard/setup-checklist.tsx"),
    "utf8",
  );
  expect(checklist).toContain("flex-col gap-2 sm:flex-row");
  expect(checklist).toContain("min-h-11");

  const card = readFileSync(
    join(process.cwd(), "components/dashboard/dashboard-setup-card.tsx"),
    "utf8",
  );
  expect(card).toContain("flex-col gap-2 sm:flex-row");
  expect(card).toContain("min-h-11");
});
