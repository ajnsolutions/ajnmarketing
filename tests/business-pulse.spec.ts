import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Business Pulse route, component, and pure display modules exist", () => {
  expect(existsSync(join(root, "lib/competitor-observations/display.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/competitor-observations/confidenceLabels.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/business-pulse-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/business-pulse/page.tsx"))).toBe(true);
});

test("the route redirects to setup when there's no business profile", () => {
  const route = read("app/dashboard/business-pulse/page.tsx");
  expect(route).toContain('redirect("/dashboard/setup")');
  expect(route).toContain("getBusinessProfileForUser");
});

test("the route fetches observations via Task 003's listCompetitorObservationsForUser, not a new persistence function", () => {
  const route = read("app/dashboard/business-pulse/page.tsx");
  expect(route).toContain("listCompetitorObservationsForUser");
  expect(route).toContain("listMarketRadarEntriesForUser");
});

test("the page renders a What Changed section with confidence filtering", () => {
  const page = read("components/dashboard/business-pulse-page.tsx");
  expect(page).toContain("What Changed");
  expect(page).toContain("ObservationConfidenceFilters");
  expect(page).toContain("filterObservationsByConfidence");
});

test("confidence is always rendered through the plain-language label/explanation functions, never a raw field or numeric score", () => {
  const page = read("components/dashboard/business-pulse-page.tsx");
  expect(page).toContain("confidenceLabelText(");
  expect(page).toContain("confidenceExplanation(");
  expect(page).not.toMatch(/\{\s*item\.confidence\s*\}/);
  expect(page).not.toMatch(/\{\s*observation\.confidence\s*\}/);
  expect(page).not.toMatch(/confidenceScore/);
  expect(page).not.toMatch(/\d{1,3}\s*%/);
});

test("evidence is shown as real provenance -- the observation's own sourceLabel -- never a fabricated external link", () => {
  const page = read("components/dashboard/business-pulse-page.tsx");
  expect(page).toContain("sourceLabel");
  expect(page).not.toMatch(/https?:\/\//);
});

test("the empty state is calm and honest, never implies monitoring is broken", () => {
  const page = read("components/dashboard/business-pulse-page.tsx");
  expect(page).toMatch(/no verified observations yet/i);
  expect(page).not.toMatch(/error/i);
  expect(page).not.toMatch(/broken/i);
});

test("the page is explicit that this is only the Market Radar slice of Business Pulse, not the full composition", () => {
  const page = read("components/dashboard/business-pulse-page.tsx");
  expect(page).toMatch(/Growth Momentum/);
  expect(page).toMatch(/Customer Voice/);
  expect(page).toMatch(/Seasonal Intelligence/);
});

test("Business Pulse is reachable from the More tools progressive-disclosure list, not a new primary nav item", () => {
  const supportingContext = read("components/dashboard/growth-advisor/supporting-context.tsx");
  expect(supportingContext).toContain('{ href: "/dashboard/business-pulse", label: "Business Pulse" }');

  const primaryNavFiles = ["components/dashboard/dashboard-nav.tsx", "components/dashboard/dashboard-sidebar.tsx"];
  for (const navFile of primaryNavFiles) {
    if (existsSync(join(root, navFile))) {
      expect(read(navFile)).not.toContain("/dashboard/business-pulse");
    }
  }
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
