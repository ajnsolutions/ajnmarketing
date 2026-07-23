import { NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import { buildOpsDashboardSummary } from "@/lib/ops-dashboard/service";
import { evaluateOpsAlerts } from "@/lib/production-alerts/evaluate";
import { runProductionHealthChecks } from "@/lib/production-health/service";
import { runWorkflowValidationHarness } from "@/lib/workflow-validation/harness";
import { getFailureInjectionState } from "@/lib/failure-injection/gate";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";
import { buildProductionReadinessSummary } from "@/lib/production-readiness/model";
import { getTenantOperationalHealthPage } from "@/lib/ops-dashboard/tenantHealth";
import { findStuckBackgroundJobs, classifyRetrySafety } from "@/lib/ops-dashboard/jobLifecycle";
import { getAutonomousSchedulingHealth } from "@/lib/trigger/schedulingHealth";
import { buildAssistedPilotDashboard } from "@/lib/assisted-pilot/service";

/** New Phase 3C views reflect live server state — never let these be cached. */
function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "summary";

  if (view === "health") {
    const report = await runProductionHealthChecks({
      probeDatabase: isSupabaseServiceRoleConfigured()
        ? async () => {
            const client = createServiceRoleClient();
            const { error } = await client.from("business_profiles").select("id").limit(1);
            return {
              ok: !error,
              message: error ? error.message.slice(0, 200) : "Database probe succeeded.",
            };
          }
        : undefined,
    });
    return NextResponse.json(report);
  }

  if (view === "alerts") {
    if (!isSupabaseServiceRoleConfigured()) {
      return NextResponse.json(
        evaluateOpsAlerts({
          publishingFailedCount: 0,
        })
      );
    }
    const summary = await buildOpsDashboardSummary(createServiceRoleClient());
    const alerts = evaluateOpsAlerts({
      publishingFailedCount:
        summary.sections.find((s) => s.id === "publishing_failures")?.counts.failed ?? 0,
      publishingRetryingCount:
        summary.sections.find((s) => s.id === "publishing_queue")?.counts.retrying ?? 0,
      oauthDisconnectedCount:
        summary.sections.find((s) => s.id === "oauth_health")?.counts.failed ?? 0,
      highRetryJobCount:
        summary.sections.find((s) => s.id === "retry_queue")?.counts.failed ?? 0,
    });
    return NextResponse.json(alerts);
  }

  if (view === "workflow") {
    return NextResponse.json(
      runWorkflowValidationHarness({
        attachDeclarativeProductionCrons: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
        autoPublishingEnabled: false,
        autoApprovalEnabled: false,
      })
    );
  }

  if (view === "failure-injection") {
    return NextResponse.json(getFailureInjectionState());
  }

  if (view === "readiness") {
    if (!isSupabaseServiceRoleConfigured()) {
      const summary = await buildProductionReadinessSummary();
      return jsonNoStore(summary);
    }
    const supabase = createServiceRoleClient();
    let pilotReadiness: { score: number; recommendation: string } | undefined;
    try {
      const pilotData = await buildAssistedPilotDashboard(supabase);
      pilotReadiness = {
        score: pilotData.aggregateReadiness.total,
        recommendation: pilotData.launchRecommendation,
      };
    } catch {
      pilotReadiness = undefined;
    }
    const summary = await buildProductionReadinessSummary({
      probeDatabase: async () => {
        const { error } = await supabase.from("business_profiles").select("id").limit(1);
        return {
          ok: !error,
          message: error ? error.message.slice(0, 200) : "Database probe succeeded.",
        };
      },
      migrationSupabase: supabase,
      pilotReadiness,
    });
    return jsonNoStore(summary);
  }

  if (view === "tenants") {
    if (!isSupabaseServiceRoleConfigured()) {
      return jsonNoStore({ page: 1, pageSize: 20, totalCount: 0, tenants: [] }, 503);
    }
    const page = Number(url.searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20") || 20;
    const search = url.searchParams.get("q") ?? undefined;
    const result = await getTenantOperationalHealthPage(createServiceRoleClient(), {
      page,
      pageSize,
      search,
    });
    return jsonNoStore(result);
  }

  if (view === "jobs") {
    if (!isSupabaseServiceRoleConfigured()) {
      return jsonNoStore({ stuckJobs: [], triggerSubsystems: null }, 503);
    }
    const supabase = createServiceRoleClient();
    const stuckJobs = await findStuckBackgroundJobs(supabase);
    const stuckJobsWithSafety = stuckJobs.map((job) => ({
      ...job,
      retrySafety: classifyRetrySafety({
        job_type: job.jobType,
        // Stuck jobs are queued/running, not failed/cancelled — retry safety here
        // describes what would apply *if* an operator force-fails then retries it,
        // for display only; the retry endpoint independently re-validates state.
        status: "failed",
        attempts: job.attempts,
      }),
    }));

    let triggerSubsystems: Awaited<ReturnType<typeof getAutonomousSchedulingHealth>> | null = null;
    if (process.env.TRIGGER_SECRET_KEY?.trim()) {
      try {
        triggerSubsystems = await getAutonomousSchedulingHealth();
      } catch {
        triggerSubsystems = null;
      }
    }

    return jsonNoStore({ stuckJobs: stuckJobsWithSafety, triggerSubsystems });
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
        sections: [],
        alertCounts: { info: 0, warning: 0, critical: 0 },
        error: "SUPABASE_SECRET_KEY is not configured; ops summary unavailable.",
      },
      { status: 503 }
    );
  }

  const summary = await buildOpsDashboardSummary(createServiceRoleClient());
  return NextResponse.json(summary);
}
