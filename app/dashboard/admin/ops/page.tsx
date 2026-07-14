import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/admin/isAdminUser";
import { AdminOpsDashboard } from "@/components/dashboard/admin-ops-dashboard";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { buildOpsDashboardSummary } from "@/lib/ops-dashboard/service";
import { evaluateOpsAlerts } from "@/lib/production-alerts/evaluate";
import { runProductionHealthChecks } from "@/lib/production-health/service";
import { runWorkflowValidationHarness } from "@/lib/workflow-validation/harness";
import { getFailureInjectionState } from "@/lib/failure-injection/gate";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

export const metadata = {
  title: "Ops Dashboard",
  description: "Internal operational monitoring for AJN Marketing autonomous systems.",
};

export default async function AdminOpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/admin/ops");
  }
  if (!isAdminUserId(user.id)) {
    redirect("/dashboard/command-center");
  }

  const health = await runProductionHealthChecks({
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

  const summary = isSupabaseServiceRoleConfigured()
    ? await buildOpsDashboardSummary(createServiceRoleClient())
    : null;

  const alerts = evaluateOpsAlerts({
    publishingFailedCount:
      summary?.sections.find((s) => s.id === "publishing_failures")?.counts.failed ?? 0,
    publishingRetryingCount:
      summary?.sections.find((s) => s.id === "publishing_queue")?.counts.retrying ?? 0,
    oauthDisconnectedCount:
      summary?.sections.find((s) => s.id === "oauth_health")?.counts.failed ?? 0,
    highRetryJobCount: summary?.sections.find((s) => s.id === "retry_queue")?.counts.failed ?? 0,
  });

  const workflow = runWorkflowValidationHarness({
    attachDeclarativeProductionCrons: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
    autoPublishingEnabled: false,
    autoApprovalEnabled: false,
  });

  return (
    <AdminOpsDashboard
      health={health}
      summary={summary}
      alerts={alerts}
      workflow={workflow}
      failureInjection={getFailureInjectionState()}
    />
  );
}
