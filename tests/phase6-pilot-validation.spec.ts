import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("pilot validation page is admin-gated and compose-only", () => {
  const page = read("app/dashboard/admin/pilot-validation/page.tsx");
  expect(page).toContain("isAdminUserId");
  expect(page).toContain("buildPilotValidationDashboard");
  expect(page).not.toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = true");
});

test("pilot validation dashboard covers Phase 6 surfaces", () => {
  const ui = read("components/dashboard/pilot-validation-dashboard.tsx");
  expect(ui).toContain("Pilot readiness audit");
  expect(ui).toContain("Operational validation");
  expect(ui).toContain("Customer journey validation");
  expect(ui).toContain("Production readiness report");
  expect(ui).toContain("Admin observability");
  expect(ui).toContain("min-h-11");
  expect(ui).toContain("hom-focusable");
});

test("compose helpers do not invent metrics or open the cron gate", () => {
  const compose = read("lib/assisted-pilot/pilotValidationCompose.ts");
  expect(compose).toContain("composePilotReadinessAudit");
  expect(compose).toContain("composeJourneyValidationChecklist");
  expect(compose).toContain("composeProductionReadinessReport");
  expect(compose).not.toContain("Math.random");
  expect(compose).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});

test("ops and customer success link to pilot validation", () => {
  expect(read("components/dashboard/admin-ops-dashboard.tsx")).toContain(
    "/dashboard/admin/pilot-validation",
  );
  expect(read("components/dashboard/customer-success-dashboard.tsx")).toContain(
    "/dashboard/admin/pilot-validation",
  );
});

test("pilot validation guide documents go-live and rollback", () => {
  const docs = read("docs/PILOT_VALIDATION_GUIDE.md");
  expect(docs).toContain("Pilot validation checklist");
  expect(docs).toContain("Daily validation");
  expect(docs).toContain("Weekly validation");
  expect(docs).toContain("Go-live checklist");
  expect(docs).toContain("Criteria before enabling schedules");
  expect(docs).toContain("Rollback considerations");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});
