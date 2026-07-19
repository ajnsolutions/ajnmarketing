import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard/strategic-marketing-calendar redirects toward login", async ({
  page,
}) => {
  await page.goto("/dashboard/strategic-marketing-calendar");
  await expect(page).toHaveURL(/\/login/);
});

test("Strategic Marketing Calendar ships preview, full page, filters, and read-only guardrails", async () => {
  const hom = readFileSync(
    join(process.cwd(), "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  expect(hom).toContain("StrategicCalendarPreviewSection");
  expect(hom).toContain("AskHeadOfMarketingPanel");
  expect(hom).toContain("ExecutiveBriefSection");

  const preview = readFileSync(
    join(process.cwd(), "components/dashboard/strategic-calendar-preview.tsx"),
    "utf8",
  );
  expect(preview).toContain("Open full calendar");
  expect(preview).toContain("Pending approvals");
  expect(preview).toContain("/dashboard/strategic-marketing-calendar");

  const pageSource = readFileSync(
    join(process.cwd(), "components/dashboard/strategic-marketing-calendar-page.tsx"),
    "utf8",
  );
  expect(pageSource).toContain("Strategic Marketing Calendar");
  expect(pageSource).toContain('aria-pressed');
  expect(pageSource).toContain("Today");
  expect(pageSource).toContain("Previous");
  expect(pageSource).toContain("Next");
  expect(pageSource).toContain("Event category filters");
  expect(pageSource).toContain("Open authoritative view");
  expect(pageSource).toContain("hom-focusable");
  expect(pageSource).toContain("sm:flex-row");
  expect(pageSource).not.toMatch(/drag|onDrop|reschedule|quick-create/i);

  const api = readFileSync(
    join(process.cwd(), "app/api/strategic-marketing-calendar/route.ts"),
    "utf8",
  );
  expect(api).toContain("export async function GET");
  expect(api).not.toMatch(/export async function POST/);

  const gate = readFileSync(
    join(process.cwd(), "lib/trigger/scheduleActivation.ts"),
    "utf8",
  );
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");

  const interactive = readFileSync(
    join(process.cwd(), "components/dashboard/ask-head-of-marketing.tsx"),
    "utf8",
  );
  expect(interactive).toContain("Ask your Head of Marketing");
});
