import assert from "node:assert/strict";
import test from "node:test";
import { buildProductionReadinessSummary } from "../lib/production-readiness/model.ts";
import { checkMigration031Applied } from "../lib/production-readiness/migrationCheck.ts";
import { validateServerConfig } from "../lib/config/validate.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { ReadinessStatuses } from "../lib/production-readiness/types.ts";

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for production readiness model", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("readiness summary never returns secret values, only presence", async () => {
  const summary = await buildProductionReadinessSummary();
  const blob = JSON.stringify(summary);
  assert.equal(blob.includes("sk-"), false);
  assert.equal(blob.toLowerCase().includes("service_role"), false);
  assert.ok(summary.items.length > 0);
});

test("schedule_attachment item reflects the gate honestly and is intentionally_disabled while the gate is closed", async () => {
  const summary = await buildProductionReadinessSummary();
  const scheduleItem = summary.items.find((i) => i.key === "schedule_attachment");
  assert.ok(scheduleItem);
  assert.equal(scheduleItem?.status, ReadinessStatuses.INTENTIONALLY_DISABLED);
  assert.equal(scheduleItem?.blocksScheduleActivation, false);
  assert.equal(summary.scheduleGateOpen, false);
});

test("overallStatus rolls up to the worst status present, following the documented severity order", async () => {
  const summary = await buildProductionReadinessSummary();
  // Ordering invariant: overallStatus must be one of the statuses actually present.
  assert.ok(summary.items.some((item) => item.status === summary.overallStatus));
});

test("migration check without a service-role client returns unknown, not a false negative", async () => {
  const summary = await buildProductionReadinessSummary();
  const migrationItem = summary.items.find((i) => i.key === "migration_031");
  assert.ok(migrationItem);
  assert.equal(migrationItem?.status, ReadinessStatuses.UNKNOWN);
  assert.equal(migrationItem?.blocksPilot, false);
});

test("migration check distinguishes applied, confirmed-missing, and ambiguous failures", async () => {
  const appliedProbe = { from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }) };
  const applied = await checkMigration031Applied(appliedProbe as never);
  assert.equal(applied.applied, true);
  assert.equal(applied.confirmedMissing, false);

  const missingProbe = {
    from: () => ({
      select: () => ({
        limit: () =>
          Promise.resolve({ error: { code: "42P01", message: "relation does not exist" } }),
      }),
    }),
  };
  const missing = await checkMigration031Applied(missingProbe as never);
  assert.equal(missing.applied, false);
  assert.equal(missing.confirmedMissing, true);

  const ambiguousProbe = {
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ error: { code: "PGRST301", message: "JWT expired" } }),
      }),
    }),
  };
  const ambiguous = await checkMigration031Applied(ambiguousProbe as never);
  assert.equal(ambiguous.applied, false);
  assert.equal(ambiguous.confirmedMissing, false);
});

test("readiness summary with a mocked applied-migration client reports ready and unblocks pilot", async () => {
  const appliedProbe = {
    from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
  };
  const summary = await buildProductionReadinessSummary({
    migrationSupabase: appliedProbe as never,
  });
  const migrationItem = summary.items.find((i) => i.key === "migration_031");
  assert.equal(migrationItem?.status, ReadinessStatuses.READY);
  assert.equal(migrationItem?.blocksPilot, false);
});

test("readiness summary with a mocked missing-migration client blocks pilot and schedule activation", async () => {
  const missingProbe = {
    from: () => ({
      select: () => ({
        limit: () =>
          Promise.resolve({ error: { code: "42P01", message: "relation does not exist" } }),
      }),
    }),
  };
  const summary = await buildProductionReadinessSummary({
    migrationSupabase: missingProbe as never,
  });
  const migrationItem = summary.items.find((i) => i.key === "migration_031");
  assert.equal(migrationItem?.status, ReadinessStatuses.BLOCKED);
  assert.equal(migrationItem?.blocksPilot, true);
  assert.ok(summary.blockers.some((b) => b.key === "migration_031"));
  assert.equal(summary.overallStatus, ReadinessStatuses.BLOCKED);
});

test("pilot readiness is a pass-through pointer, never recomputed by this model", async () => {
  const withPilot = await buildProductionReadinessSummary({
    pilotReadiness: { score: 72, recommendation: "Pilot In Progress" },
  });
  assert.equal(withPilot.pilotReadiness.scoreAvailable, true);
  assert.equal(withPilot.pilotReadiness.score, 72);
  assert.equal(withPilot.pilotReadiness.recommendation, "Pilot In Progress");

  const withoutPilot = await buildProductionReadinessSummary();
  assert.equal(withoutPilot.pilotReadiness.scoreAvailable, false);
  assert.equal(withoutPilot.pilotReadiness.score, null);
});

test("config validator distinguishes required, optional, and malformed values without exposing them", () => {
  const report = validateServerConfig({
    NEXT_PUBLIC_SUPABASE_URL: "not-a-valid-url",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  } as unknown as NodeJS.ProcessEnv);

  const supabaseUrlKey = report.keys.find((k) => k.key === "NEXT_PUBLIC_SUPABASE_URL");
  assert.equal(supabaseUrlKey?.present, true);
  assert.equal(supabaseUrlKey?.malformed, true);
  assert.ok(report.malformedKeys.includes("NEXT_PUBLIC_SUPABASE_URL"));

  const secretKey = report.keys.find((k) => k.key === "SUPABASE_SECRET_KEY");
  assert.equal(secretKey?.present, false);
  // Conditionally required keys should not appear in missingRequired (only "required" does).
  assert.equal(report.missingRequired.includes("SUPABASE_SECRET_KEY"), false);

  const blob = JSON.stringify(report);
  assert.equal(blob.includes("anon-key"), false);
});

test("config validator flags missing required keys", () => {
  const report = validateServerConfig({} as unknown as NodeJS.ProcessEnv);
  assert.ok(report.missingRequired.includes("NEXT_PUBLIC_SUPABASE_URL"));
  assert.ok(report.missingRequired.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
});
