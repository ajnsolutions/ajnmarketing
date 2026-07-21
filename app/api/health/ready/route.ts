import { NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { checkMigration031Applied } from "@/lib/production-readiness/migrationCheck";

const PROBE_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(timeoutValue), ms)),
  ]);
}

/**
 * Readiness tier (distinct from the liveness check at /api/health, which never
 * touches the database). This confirms the platform's *required* dependencies are
 * actually reachable before infrastructure routes traffic here — a real, bounded
 * database probe plus a migration-031 schema check, both non-destructive and
 * time-boxed so a slow/unreachable database degrades this endpoint rather than
 * hanging it. No secrets or schema details beyond migration-applied/not-applied are
 * ever returned. This intentionally does not require admin auth — infrastructure
 * readiness probes generally can't authenticate, and no sensitive data is exposed.
 */
export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      {
        status: "not_configured",
        reason: "Service-role database access is not configured.",
        generatedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  const supabase = createServiceRoleClient();

  const dbProbe = await withTimeout(
    (async () => {
      const { error } = await supabase.from("business_profiles").select("id").limit(1);
      return { ok: !error, message: error?.message ?? null };
    })(),
    PROBE_TIMEOUT_MS,
    { ok: false, message: "Database probe timed out." }
  );

  if (!dbProbe.ok) {
    return NextResponse.json(
      {
        status: "unavailable",
        reason: "Database is not reachable.",
        generatedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  const migration = await withTimeout(checkMigration031Applied(supabase), PROBE_TIMEOUT_MS, {
    migration: "031_customer_setup_preferences",
    table: "customer_setup_preferences",
    applied: false,
    confirmedMissing: false,
    detail: "Migration check timed out.",
  });

  const status = migration.applied ? "ready" : migration.confirmedMissing ? "degraded" : "unknown";

  // "unknown" (ambiguous probe failure, not a confirmed missing table) intentionally
  // stays 200 to avoid a deployment restart loop on a transient/ambiguous check —
  // "degraded" (confirmed missing migration) is a definitive, actionable problem.
  return NextResponse.json(
    {
      status,
      database: "reachable",
      migration031Applied: migration.applied,
      generatedAt: new Date().toISOString(),
    },
    { status: status === "degraded" ? 503 : 200 }
  );
}
