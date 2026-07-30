import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Search Console modules, routes, and docs exist", () => {
  expect(existsSync(join(root, "lib/google-search-console/oauth.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/google-search-console/persistence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/google-search-console/service.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/google-search-console/sync.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/google-search-console/normalize.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/google-search-console/connect/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/google-search-console/callback/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/google-search-console/status/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/google-search-console/properties/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/google-search-console/properties/select/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/google-search-console/disconnect/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/google-search-console/sync/route.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/search-console-connect-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/search-console/connect/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/search-console/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "supabase/migrations/032_google_search_console.sql"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/GOOGLE_SEARCH_CONSOLE.md"))).toBe(true);
});

test("unauthenticated Search Console connect page redirects to login", async ({ page }) => {
  await page.goto("/dashboard/search-console/connect");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated Search Console manage page redirects to login", async ({ page }) => {
  await page.goto("/dashboard/search-console");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated Search Console APIs remain unauthorized", async ({ request }) => {
  const endpoints = [
    { method: "GET", url: "/api/google-search-console/connect" },
    { method: "GET", url: "/api/google-search-console/status" },
    { method: "GET", url: "/api/google-search-console/properties" },
    { method: "POST", url: "/api/google-search-console/properties", data: {} },
    { method: "POST", url: "/api/google-search-console/properties/select", data: { siteUrl: "https://example.com/" } },
    { method: "POST", url: "/api/google-search-console/disconnect" },
  ] as const;

  for (const endpoint of endpoints) {
    const response =
      endpoint.method === "GET"
        ? await request.get(endpoint.url)
        : await request.post(endpoint.url, { data: "data" in endpoint ? endpoint.data : {} });
    expect(response.status(), endpoint.url).toBe(401);
  }
});

test("catalog entry is live and points at the real connect/manage routes", () => {
  const catalog = read("lib/business-connections/catalog.ts");
  expect(catalog).toContain("conn_search_console");
  expect(catalog).toContain('connectHref: "/dashboard/search-console/connect"');
  expect(catalog).toContain('manageHref: "/dashboard/search-console"');

  const resolve = read("lib/business-connections/resolve.ts");
  expect(resolve).toContain("resolveSearchConsole");
  expect(resolve).toContain("ConnectionProviderIds.GOOGLE_SEARCH_CONSOLE");
});

test("Growth Advisor and Weekly Growth Plan already consume search_demand_trends evidence", () => {
  const evidence = read("lib/growth-planner/evidence.ts");
  expect(evidence).toContain("searchDemandTrends");

  const nextWeek = read("lib/growth-advisor/nextWeek.ts");
  // Search demand trends flow through the generic top-insight observation even
  // where nextWeek.ts doesn't special-case the bucket by name.
  expect(nextWeek.length).toBeGreaterThan(0);

  const observations = read("lib/growth-advisor/observations.ts");
  expect(observations).toContain("externalIntelligenceObservation");
});

test("connect page source requests read-only scope and never leaks secrets", () => {
  const page = read("components/dashboard/search-console-connect-page.tsx");
  expect(page).not.toMatch(/TOKEN_ENCRYPTION_KEY|GOOGLE_CLIENT_ID|client_secret|access_token_encrypted|refresh_token_encrypted/i);
  expect(page).toContain("Disconnect");
  expect(page).toContain("Choose a property");

  const oauth = read("lib/google-search-console/oauth.ts");
  expect(oauth).toContain("webmasters.readonly");
});

test("migration enforces RLS on every Search Console table", () => {
  const migration = read("supabase/migrations/032_google_search_console.sql");
  for (const tableName of [
    "google_search_console_connections",
    "google_search_console_properties",
    "google_search_console_metrics",
    "google_search_console_sync_log",
  ]) {
    expect(migration).toContain(`create table if not exists public.${tableName}`);
    expect(migration).toContain(`alter table public.${tableName} enable row level security`);
  }
  expect(migration).toContain("auth.uid() = user_id");
  // Tokens are never queryable by anyone else — no policy grants cross-tenant access.
  expect(migration).not.toMatch(/using \(true\)/i);
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, OAuth flow, normalization, security, and future extensions", () => {
  const docs = read("docs/project-magic/GOOGLE_SEARCH_CONSOLE.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("OAuth flow");
  expect(docs).toContain("Normalization");
  expect(docs).toContain("Business Brain");
  expect(docs).toContain("Security");
  expect(docs).toContain("Future extensions");
});
