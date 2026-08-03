import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Market Radar view modules, page, and API routes exist", () => {
  expect(existsSync(join(root, "lib/market-radar/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/market-radar/persistence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/market-radar/sort.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/market-radar/display.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/market-radar-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/market-radar/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/api/market-radar/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/market-radar/[id]/route.ts"))).toBe(true);
});

test("the route redirects to setup when there's no business profile", () => {
  const route = read("app/dashboard/market-radar/page.tsx");
  expect(route).toContain('redirect("/dashboard/setup")');
  expect(route).toContain("getBusinessProfileForUser");
});

test("the page lists tracked competitors and benchmarks separately, with add/remove actions", () => {
  const page = read("components/dashboard/market-radar-page.tsx");
  expect(page).toContain("Tracking");
  expect(page).toContain("Benchmarking");
  expect(page).toContain("groupMarketRadarEntriesForDisplay");
  expect(page).toContain("Remove");
  expect(page).toMatch(/\+\s*Add a/);
});

test("benchmarks are framed as inspiration, not head-to-head comparison", () => {
  const page = read("components/dashboard/market-radar-page.tsx");
  expect(page).toContain("not a head-to-head comparison");
});

test("no fabricated competitive activity or detection signal is rendered — this is an owner-managed list only", () => {
  const page = read("components/dashboard/market-radar-page.tsx");
  expect(page).not.toMatch(/detected/i);
  expect(page).not.toMatch(/recent activity/i);
  expect(page).not.toMatch(/days ago/i);
});

test("the add/remove API routes are scoped to the current authenticated user", () => {
  const collectionRoute = read("app/api/market-radar/route.ts");
  expect(collectionRoute).toContain("supabase.auth.getUser()");
  expect(collectionRoute).toContain("addMarketRadarEntryForUser");

  const itemRoute = read("app/api/market-radar/[id]/route.ts");
  expect(itemRoute).toContain("supabase.auth.getUser()");
  expect(itemRoute).toContain("removeMarketRadarEntryForUser");
});

test("the display grouping helper reuses sortMarketRadarEntries rather than reimplementing ordering", () => {
  const display = read("lib/market-radar/display.ts");
  expect(display).toContain("sortMarketRadarEntries");
});

test("Market Radar is reachable from the More tools progressive-disclosure list, not a new primary nav item", () => {
  const supportingContext = read("components/dashboard/growth-advisor/supporting-context.tsx");
  expect(supportingContext).toContain('{ href: "/dashboard/market-radar", label: "Market Radar" }');

  const primaryNavFiles = ["components/dashboard/dashboard-nav.tsx", "components/dashboard/dashboard-sidebar.tsx"];
  for (const navFile of primaryNavFiles) {
    if (existsSync(join(root, navFile))) {
      expect(read(navFile)).not.toContain("/dashboard/market-radar");
    }
  }
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});
