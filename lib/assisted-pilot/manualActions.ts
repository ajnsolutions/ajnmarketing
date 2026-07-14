import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk";
import type { recommendationPipelineForTenantTask } from "@/trigger/recommendationPipeline";
import type { analyticsCaptureForTenantTask } from "@/trigger/analyticsCapture";
import { runWebsiteAnalysisForUser } from "@/lib/website-analysis/service";
import {
  generateWeeklyApprovalPackageForUser,
} from "@/lib/weekly-approval-package/service";
import { resolveWeeklyPackageBaseUrl } from "@/lib/weekly-approval-package/signedLinks";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import { reconcileRecommendationOutcomesForUser } from "@/lib/recommendation-outcomes/reconciliation";
import { runProductionHealthChecks } from "@/lib/production-health/service";
import { executePublishingJobById } from "@/lib/publishing/publishingEngine";
import { buildRecommendationPipelineConcurrencyKey } from "@/lib/trigger/recommendationPipelineKeys";
import {
  finishManualActionRun,
  getPilotBusinessById,
  startManualActionRun,
  updateChecklistStage,
} from "@/lib/assisted-pilot/persistence";
import { PilotChecklistStageKeys, PilotManualActionKeys } from "@/lib/assisted-pilot/types";
import { createCorrelationId, logWorkflow } from "@/lib/observability/workflowLogger";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";
import { isSupabaseServiceRoleConfigured, createServiceRoleClient } from "@/lib/supabase/service";

export type ManualActionResult = {
  runId: string;
  actionKey: string;
  result: "success" | "failure" | "skipped";
  durationMs: number | null;
  errorMessage: string | null;
  detail?: Record<string, unknown>;
};

/**
 * Executes assisted-pilot manual actions by reusing existing services/tasks.
 * Never flips schedule gates, never auto-approves, never auto-publishes a queue sweep.
 */
export async function executePilotManualAction(input: {
  supabase: SupabaseClient;
  pilotBusinessId: string;
  actionKey: string;
  triggeredBy: string;
  publishingJobId?: string | null;
}): Promise<ManualActionResult> {
  if (ATTACH_DECLARATIVE_PRODUCTION_CRONS) {
    // Soft guard: assisted pilot may still run, but we never treat this path as schedule activation.
  }

  const pilot = await getPilotBusinessById(input.supabase, input.pilotBusinessId);
  if (!pilot) throw new Error("Pilot business not found.");

  const correlationId = createCorrelationId();
  const run = await startManualActionRun(input.supabase, {
    pilotBusinessId: pilot.id,
    actionKey: input.actionKey,
    triggeredBy: input.triggeredBy,
  });

  const started = Date.now();

  try {
    let detail: Record<string, unknown> = {};

    switch (input.actionKey) {
      case PilotManualActionKeys.WEBSITE_ANALYSIS: {
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.WEBSITE_ANALYSIS,
          "running"
        );
        await runWebsiteAnalysisForUser(pilot.user_id, input.supabase);
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.WEBSITE_ANALYSIS,
          "completed"
        );
        detail = { mode: "sync" };
        break;
      }
      case PilotManualActionKeys.RECOMMENDATION_GENERATION: {
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.RECOMMENDATION_GENERATION,
          "running"
        );
        const handle = await tasks.trigger<typeof recommendationPipelineForTenantTask>(
          "recommendation-pipeline-for-tenant",
          { userId: pilot.user_id, reason: "manual_trigger" },
          {
            concurrencyKey: buildRecommendationPipelineConcurrencyKey(pilot.user_id),
          }
        );
        detail = { mode: "trigger", triggerRunId: handle.id };
        // Leave stage running until operator marks complete or a later cycle updates it.
        break;
      }
      case PilotManualActionKeys.WEEKLY_PACKAGE: {
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.APPROVAL_PACKAGE,
          "running"
        );
        const profile = await getBusinessProfileForUserId(input.supabase, pilot.user_id);
        if (!profile || profile.id !== pilot.business_profile_id) {
          throw new Error("Business profile not found for this pilot.");
        }
        const pkg = await generateWeeklyApprovalPackageForUser(
          {
            userId: pilot.user_id,
            businessProfileId: pilot.business_profile_id,
            businessName: profile.business_name?.trim() || pilot.display_name || "Your Business",
            baseUrl: resolveWeeklyPackageBaseUrl(),
          },
          input.supabase
        );
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.APPROVAL_PACKAGE,
          "completed"
        );
        detail = {
          mode: "sync",
          itemCount: pkg.items.length,
          isEmpty: pkg.isEmpty,
        };
        break;
      }
      case PilotManualActionKeys.PUBLISHING: {
        if (!input.publishingJobId?.trim()) {
          throw new Error("publishingJobId is required for publishing action.");
        }
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.PUBLISHING,
          "running"
        );
        const jobResult = await executePublishingJobById(
          input.publishingJobId.trim(),
          pilot.user_id,
          input.supabase
        );
        const ok = !jobResult.error;
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.PUBLISHING,
          ok ? "completed" : "failed",
          ok ? null : String(jobResult.error ?? "publish_failed")
        );
        detail = { mode: "sync", publishingJobId: input.publishingJobId };
        if (!ok) {
          throw new Error(String(jobResult.error ?? "Publish failed."));
        }
        break;
      }
      case PilotManualActionKeys.ANALYTICS_CAPTURE: {
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.ANALYTICS,
          "running"
        );
        const handle = await tasks.trigger<typeof analyticsCaptureForTenantTask>(
          "analytics-capture-for-tenant",
          {
            userId: pilot.user_id,
            businessProfileId: pilot.business_profile_id,
            reason: "manual_trigger",
          }
        );
        detail = { mode: "trigger", triggerRunId: handle.id };
        break;
      }
      case PilotManualActionKeys.OUTCOME_RECONCILIATION: {
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.LEARNING_UPDATE,
          "running"
        );
        const recon = await reconcileRecommendationOutcomesForUser(
          input.supabase,
          pilot.user_id,
          pilot.business_profile_id
        );
        await updateChecklistStage(
          input.supabase,
          pilot.id,
          PilotChecklistStageKeys.LEARNING_UPDATE,
          "completed"
        );
        detail = {
          mode: "sync",
          eventsInserted: recon.eventsInserted,
          eventsSkippedExisting: recon.eventsSkippedExisting,
        };
        break;
      }
      case PilotManualActionKeys.HEALTH_REFRESH: {
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
        detail = {
          mode: "sync",
          overall: health.overall,
          scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
        };
        break;
      }
      default:
        throw new Error(`Unsupported manual action: ${input.actionKey}`);
    }

    const finished = await finishManualActionRun(input.supabase, run.id, "success", null, detail);
    logWorkflow({
      correlationId,
      tenantUserId: pilot.user_id,
      businessProfileId: pilot.business_profile_id,
      pipelineStage: `assisted_pilot.${input.actionKey}`,
      durationMs: Date.now() - started,
      result: "success",
    });

    return {
      runId: finished.id,
      actionKey: input.actionKey,
      result: "success",
      durationMs: finished.durationMs,
      errorMessage: null,
      detail,
    };
  } catch (error) {
    const message = toSafeUserErrorMessage(error, "Manual action failed.");
    const finished = await finishManualActionRun(input.supabase, run.id, "failure", message);
    logWorkflow({
      correlationId,
      tenantUserId: pilot.user_id,
      businessProfileId: pilot.business_profile_id,
      pipelineStage: `assisted_pilot.${input.actionKey}`,
      durationMs: Date.now() - started,
      result: "failure",
      failureCategory: "manual_action",
      message,
    });
    return {
      runId: finished.id,
      actionKey: input.actionKey,
      result: "failure",
      durationMs: finished.durationMs,
      errorMessage: message,
    };
  }
}
