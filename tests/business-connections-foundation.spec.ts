import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Business Connections foundation docs and modules exist", () => {
  expect(existsSync(join(root, "docs/project-magic/BUSINESS_CONNECTIONS.md"))).toBe(true);
  expect(existsSync(join(root, "lib/business-connections/catalog.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-connections/resolve.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-connections/readiness.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-connections/recommendNext.ts"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/business-connections/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/business-connections-page.tsx"))).toBe(true);
});

test("customer experience explains learning value without technical jargon dump", () => {
  const page = read("components/dashboard/business-connections-page.tsx");
  expect(page).toContain("What will I learn if you connect this?");
  expect(page).toContain("Recommended next");
  expect(page).toContain("What the Business Brain can see");
  expect(page).not.toMatch(/client_secret|access_token|oauth_scope/i);
});

test("catalog is purpose-organized and seeds GBP plus placeholders", () => {
  const catalog = read("lib/business-connections/catalog.ts");
  expect(catalog).toContain("CUSTOMER_FEEDBACK");
  expect(catalog).toContain("WEBSITE_AND_SEARCH");
  expect(catalog).toContain("ADVERTISING");
  expect(catalog).toContain("SOCIAL_MEDIA");
  expect(catalog).toContain("COMMUNICATIONS");
  expect(catalog).toContain("SCHEDULING_AND_COMMERCE");
  expect(catalog).toContain("CRM_AND_SALES");
  expect(catalog).toContain("DOCUMENTS");
  expect(catalog).toContain("GOOGLE_BUSINESS_PROFILE");
  expect(catalog).toContain('implementation: "placeholder"');
  expect(catalog).toContain('implementation: "live"');
});

test("settings and advanced nav link to Business Connections; cron stays closed", () => {
  const settings = read("components/dashboard/settings-hub.tsx");
  expect(settings).toContain("/dashboard/business-connections");

  const nav = read("components/dashboard/dashboard-nav.tsx");
  expect(nav).toContain("/dashboard/business-connections");
  expect(nav).toContain("Business Connections");
  // Keep Great Simplification primary destinations free of this page.
  expect(nav.indexOf("primaryDashboardNavItems")).toBeLessThan(
    nav.indexOf('href: "/dashboard/business-connections"'),
  );

  const cron = read("lib/trigger/scheduleActivation.ts");
  expect(cron).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, lifecycle, capabilities, future providers", () => {
  const docs = read("docs/project-magic/BUSINESS_CONNECTIONS.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Connection lifecycle");
  expect(docs).toContain("Capability model");
  expect(docs).toContain("Future providers");
  expect(docs).toContain("Recommended next sprint");
});
