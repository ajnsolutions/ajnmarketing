import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { buildOpsDashboardSummary } from "@/lib/ops-dashboard/service";
import { evaluateOpsAlerts } from "@/lib/production-alerts/evaluate";
import { runProductionHealthChecks } from "@/lib/production-health/service";
import { runWorkflowValidationHarness } from "@/lib/workflow-validation/harness";
import { getFailureInjectionState } from "@/lib/failure-injection/gate";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  if (!isAdminUserId(user.id)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
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
