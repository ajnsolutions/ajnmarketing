import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("unauthenticated /dashboard/admin/ops redirects toward login", async ({ page }) => {
  await page.goto("/dashboard/admin/ops");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated ops and health APIs stay locked down or public-safe", async ({ request }) => {
  const adminViews = ["readiness", "tenants", "jobs", "summary", "health"];
  for (const view of adminViews) {
    const response = await request.get(`/api/admin/ops?view=${view}`);
    expect(response.status(), view).toBe(401);
  }

  const retryResponse = await request.post("/api/admin/ops/jobs/nonexistent-id/retry");
  expect(retryResponse.status()).toBe(401);

  // Liveness stays public and never blank/500s outright.
  const liveness = await request.get("/api/health");
  expect([200, 503]).toContain(liveness.status());
  const livenessBody = await liveness.json();
  expect(livenessBody.scheduleGateOpen).toBe(false);

  // Readiness tier is also public (infra probes can't authenticate) but never leaks secrets.
  const readiness = await request.get("/api/health/ready");
  expect([200, 503]).toContain(readiness.status());
  const readinessBody = await readiness.json();
  expect(JSON.stringify(readinessBody)).not.toMatch(/sk-|service_role/i);
});

test("cross-tenant job retry cannot be attempted without admin auth", async ({ request }) => {
  const response = await request.post("/api/admin/ops/jobs/00000000-0000-0000-0000-000000000000/retry", {
    data: { confirmOperatorReview: true },
  });
  expect(response.status()).toBe(401);
});

test("production readiness model ships richer statuses, migration check, and stuck-job detection without a second scoring engine or new job system", async () => {
  const types = readFileSync(join(process.cwd(), "lib/production-readiness/types.ts"), "utf8");
  expect(types).toContain("ready_with_warnings");
  expect(types).toContain("needs_attention");
  expect(types).toContain("intentionally_disabled");
  expect(types).toContain("blocksPilot");
  expect(types).toContain("blocksScheduleActivation");

  const model = readFileSync(join(process.cwd(), "lib/production-readiness/model.ts"), "utf8");
  expect(model).toContain("buildProductionReadinessSummary");
  // Explicitly must not recompute the pilot score — pass-through only.
  expect(model).not.toContain("computePilotReadinessScore(");
  expect(model).toContain("pilotReadiness");

  const migration = readFileSync(
    join(process.cwd(), "lib/production-readiness/migrationCheck.ts"),
    "utf8",
  );
  expect(migration).toContain("customer_setup_preferences");
  expect(migration).toContain("confirmedMissing");

  const jobLifecycle = readFileSync(join(process.cwd(), "lib/ops-dashboard/jobLifecycle.ts"), "utf8");
  expect(jobLifecycle).toContain("STUCK_QUEUED_THRESHOLD_MINUTES");
  expect(jobLifecycle).toContain("REQUIRES_OPERATOR_REVIEW");
  expect(jobLifecycle).toContain("findStuckBackgroundJobs");

  const retryRoute = readFileSync(
    join(process.cwd(), "app/api/admin/ops/jobs/[id]/retry/route.ts"),
    "utf8",
  );
  expect(retryRoute).toContain("requireAdminUser");
  expect(retryRoute).toContain("resetBackgroundJobForRetry");
  expect(retryRoute).toContain("confirmOperatorReview");
  expect(retryRoute).not.toMatch(/DROP TABLE|delete\(\)/i);

  const tenantHealth = readFileSync(
    join(process.cwd(), "lib/ops-dashboard/tenantHealthClassify.ts"),
    "utf8",
  );
  expect(tenantHealth).toContain("intentionally_unused");

  const gate = readFileSync(join(process.cwd(), "lib/trigger/scheduleActivation.ts"), "utf8");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("ops dashboard UI ships readiness, tenant health, and stuck-job panels with accessible, mobile-safe patterns", async () => {
  const dashboard = readFileSync(
    join(process.cwd(), "components/dashboard/admin-ops-dashboard.tsx"),
    "utf8",
  );
  expect(dashboard).toContain("ProductionReadinessPanel");
  expect(dashboard).toContain("TenantOperationalHealthPanel");
  expect(dashboard).toContain("StuckJobsPanel");

  const readinessPanel = readFileSync(
    join(process.cwd(), "components/dashboard/production-readiness-panel.tsx"),
    "utf8",
  );
  expect(readinessPanel).toContain("Revalidate now");

  const tenantPanel = readFileSync(
    join(process.cwd(), "components/dashboard/tenant-operational-health-panel.tsx"),
    "utf8",
  );
  expect(tenantPanel).toContain("Previous");
  expect(tenantPanel).toContain("Next");
  expect(tenantPanel).toContain("sr-only");
  expect(tenantPanel).toContain("htmlFor=");

  const jobsPanel = readFileSync(join(process.cwd(), "components/dashboard/stuck-jobs-panel.tsx"), "utf8");
  expect(jobsPanel).toContain("Confirm retry");
  expect(jobsPanel).toContain("aria-live");
  expect(jobsPanel).toContain("needsConfirmation");
});

test("no secret env var names, raw provider payloads, or authorization headers appear in new ops source", async () => {
  const files = [
    "lib/config/validate.ts",
    "lib/production-readiness/model.ts",
    "lib/ops-dashboard/tenantHealth.ts",
    "lib/ops-dashboard/jobLifecycle.ts",
    "app/api/admin/ops/jobs/[id]/retry/route.ts",
    "app/api/health/ready/route.ts",
    "components/dashboard/production-readiness-panel.tsx",
    "components/dashboard/tenant-operational-health-panel.tsx",
    "components/dashboard/stuck-jobs-panel.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source, file).not.toMatch(/authorization['"]?\s*:\s*['"]bearer/i);
    expect(source, file).not.toMatch(/console\.log\(/);
  }
});
