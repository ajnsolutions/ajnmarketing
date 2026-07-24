import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("customer success page is admin-gated and compose-only", () => {
  const page = read("app/dashboard/admin/customer-success/page.tsx");
  expect(page).toContain("isAdminUserId");
  expect(page).toContain("buildCustomerSuccessDashboard");
  expect(page).not.toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = true");
});

test("customer success dashboard covers Phase 5 surfaces", () => {
  const ui = read("components/dashboard/customer-success-dashboard.tsx");
  expect(ui).toContain("Attention Center");
  expect(ui).toContain("Guided recovery");
  expect(ui).toContain("Pilot feedback");
  expect(ui).toContain("Operator checklist");
  expect(ui).toContain("Activity timeline");
  expect(ui).toContain("aria-pressed");
  expect(ui).toContain("min-h-11");
});

test("compose helpers avoid inventing health metrics", () => {
  const compose = read("lib/assisted-pilot/customerSuccessCompose.ts");
  expect(compose).toContain("composeAttentionCenter");
  expect(compose).toContain("filterCustomerSuccessCards");
  expect(compose).not.toContain("Math.random");
  expect(compose).not.toContain("fabricat");
});

test("ops dashboard links to customer success and system readiness", () => {
  const ops = read("components/dashboard/admin-ops-dashboard.tsx");
  expect(ops).toContain("/dashboard/admin/customer-success");
  expect(ops).toContain("System readiness");
  expect(ops).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});

test("pilot runbook documents daily and exit loops", () => {
  const docs = read("docs/PILOT_RUNBOOK.md");
  expect(docs).toContain("Daily operator checklist");
  expect(docs).toContain("Weekly operator review");
  expect(docs).toContain("Common recovery steps");
  expect(docs).toContain("Pilot exit checklist");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});
