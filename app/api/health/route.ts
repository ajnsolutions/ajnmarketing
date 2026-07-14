import { NextResponse } from "next/server";
import { runProductionHealthChecks } from "@/lib/production-health/service";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

/**
 * Lightweight public health endpoint for uptime probes.
 * Does not expose secrets, tenant data, or detailed diagnostics.
 */
export async function GET() {
  const report = await runProductionHealthChecks();
  const status =
    report.overall === "critical" ? 503 : report.overall === "warning" ? 200 : 200;

  return NextResponse.json(
    {
      status: report.overall,
      scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
      generatedAt: report.generatedAt,
      correlationId: report.correlationId,
      categories: report.checks.map((check) => ({
        category: check.category,
        status: check.status,
      })),
    },
    { status }
  );
}
