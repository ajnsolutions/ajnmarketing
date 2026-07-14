import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeCompletionPercentage,
  countManualActionsRemaining,
} from "@/lib/assisted-pilot/checklist";
import {
  createPilotIssue,
  getPilotBusinessById,
  listChecklistItems,
  listPilotBusinesses,
  listPilotIssues,
  listRecentManualRuns,
  type PilotBusinessRow,
  updateChecklistStage,
  updatePilotIssue,
  upsertPilotBusiness,
} from "@/lib/assisted-pilot/persistence";
import {
  computePilotMetrics,
  computePilotReadinessScore,
  emptyMetrics,
} from "@/lib/assisted-pilot/readiness";
import type {
  AssistedPilotDashboardData,
  PilotBusinessSummary,
  PilotChecklistStageKey,
  PilotIssue,
  PilotIssueCategory,
  PilotIssueSeverity,
  PilotIssueStatus,
  PilotStageStatus,
} from "@/lib/assisted-pilot/types";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

async function latestAuditAt(
  supabase: SupabaseClient,
  userId: string,
  actionPrefix: string
): Promise<string | null> {
  const { data } = await supabase
    .from("audit_logs")
    .select("created_at")
    .eq("user_id", userId)
    .ilike("action", `${actionPrefix}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return typeof data?.created_at === "string" ? data.created_at : null;
}

async function countEq(
  supabase: SupabaseClient,
  table: string,
  filters: Array<{ column: string; value: string }>
): Promise<number> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const filter of filters) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function computeMetricsForPilot(
  supabase: SupabaseClient,
  pilot: PilotBusinessRow
) {
  const userId = pilot.user_id;
  const profileId = pilot.business_profile_id;

  const [
    recommendationsCreated,
    approved,
    rejected,
    editedEvents,
    publishSucceeded,
    publishRetrying,
    publishFailed,
    analyticsSuccess,
    manualInterventions,
    workflowFailures,
  ] = await Promise.all([
    countEq(supabase, "marketing_recommendations", [
      { column: "user_id", value: userId },
      { column: "business_profile_id", value: profileId },
    ]),
    countEq(supabase, "content_approvals", [
      { column: "user_id", value: userId },
      { column: "business_profile_id", value: profileId },
      { column: "status", value: "approved" },
    ]),
    countEq(supabase, "content_approvals", [
      { column: "user_id", value: userId },
      { column: "business_profile_id", value: profileId },
      { column: "status", value: "rejected" },
    ]),
    countEq(supabase, "recommendation_outcome_events", [
      { column: "user_id", value: userId },
      { column: "business_profile_id", value: profileId },
      { column: "event_type", value: "draft_edited" },
    ]),
    countEq(supabase, "publishing_jobs", [
      { column: "user_id", value: userId },
      { column: "business_profile_id", value: profileId },
      { column: "status", value: "published" },
    ]),
    countEq(supabase, "publishing_jobs", [
      { column: "user_id", value: userId },
      { column: "business_profile_id", value: profileId },
      { column: "status", value: "retrying" },
    ]),
    countEq(supabase, "publishing_jobs", [
      { column: "user_id", value: userId },
      { column: "business_profile_id", value: profileId },
      { column: "status", value: "failed" },
    ]),
    (async () => {
      const { count } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "success")
        .ilike("action", "analytics%");
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabase
        .from("pilot_manual_action_runs")
        .select("id", { count: "exact", head: true })
        .eq("pilot_business_id", pilot.id);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "failure");
      return count ?? 0;
    })(),
  ]);

  // Confidence: average of marketing_recommendations.confidence when present.
  let averageRecommendationConfidence: number | null = null;
  const { data: confRows } = await supabase
    .from("marketing_recommendations")
    .select("confidence")
    .eq("user_id", userId)
    .eq("business_profile_id", profileId)
    .not("confidence", "is", null)
    .limit(50);
  if (confRows && confRows.length > 0) {
    const values = confRows
      .map((r) => Number((r as { confidence?: number }).confidence))
      .filter((n) => Number.isFinite(n));
    if (values.length > 0) {
      averageRecommendationConfidence = values.reduce((a, b) => a + b, 0) / values.length;
      if (averageRecommendationConfidence > 1) {
        averageRecommendationConfidence = averageRecommendationConfidence / 100;
      }
    }
  }

  const publishAttempts = publishSucceeded + publishRetrying + publishFailed;

  return computePilotMetrics({
    recommendationsCreated,
    recommendationsApproved: approved,
    recommendationsRejected: rejected,
    recommendationsEdited: editedEvents,
    publishSucceeded,
    publishRetryingOrFailed: publishRetrying + publishFailed,
    publishAttempts,
    analyticsSuccess,
    averageApprovalTimeHours: null,
    averagePublishTimeHours: null,
    averageRecommendationConfidence,
    manualInterventions,
    workflowFailures,
  });
}

async function buildPilotSummary(
  supabase: SupabaseClient,
  pilot: PilotBusinessRow,
  issues: PilotIssue[]
): Promise<PilotBusinessSummary> {
  const checklist = await listChecklistItems(supabase, pilot.id);
  const completionPercentage = computeCompletionPercentage(checklist);
  const manualActionsRemaining = countManualActionsRemaining(checklist);
  const outstanding = issues.filter(
    (i) =>
      i.pilotBusinessId === pilot.id && (i.status === "open" || i.status === "in_progress")
  );

  const [
    lastRecommendationRunAt,
    lastApprovalPackageAt,
    lastApprovalAt,
    lastPublishAt,
    lastAnalyticsCaptureAt,
    metrics,
    recentManualRuns,
  ] = await Promise.all([
    latestAuditAt(supabase, pilot.user_id, "recommendation_pipeline"),
    latestAuditAt(supabase, pilot.user_id, "email_action").catch(() => null),
    latestAuditAt(supabase, pilot.user_id, "content."),
    latestAuditAt(supabase, pilot.user_id, "publishing."),
    latestAuditAt(supabase, pilot.user_id, "analytics."),
    computeMetricsForPilot(supabase, pilot),
    listRecentManualRuns(supabase, pilot.id),
  ]);

  // Prefer weekly package audit if present; otherwise leave package time nullish from email actions.
  const weeklyPackageAt = await latestAuditAt(supabase, pilot.user_id, "weekly");

  const readiness = computePilotReadinessScore({
    metrics,
    openIssues: outstanding,
    completionPercentage,
    documentationComplete: true,
    scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
  });

  let currentHealth: PilotBusinessSummary["currentHealth"] = "healthy";
  if (outstanding.some((i) => i.severity === "critical") || readiness.total < 40) {
    currentHealth = "critical";
  } else if (outstanding.length > 0 || readiness.total < 65) {
    currentHealth = "warning";
  }

  return {
    id: pilot.id,
    userId: pilot.user_id,
    businessProfileId: pilot.business_profile_id,
    displayName: pilot.display_name,
    status: pilot.status,
    startDate: pilot.start_date,
    currentCycle: pilot.current_cycle,
    notes: pilot.notes,
    lastRecommendationRunAt,
    lastApprovalPackageAt: weeklyPackageAt ?? lastApprovalPackageAt,
    lastApprovalAt,
    lastPublishAt,
    lastAnalyticsCaptureAt,
    currentHealth,
    outstandingIssueCount: outstanding.length,
    manualActionsRemaining,
    completionPercentage,
    checklist,
    metrics,
    readiness,
    recentManualRuns,
  };
}

export async function buildAssistedPilotDashboard(
  supabase: SupabaseClient
): Promise<AssistedPilotDashboardData> {
  let pilots: PilotBusinessRow[] = [];
  let openIssues: PilotIssue[] = [];

  try {
    pilots = await listPilotBusinesses(supabase);
    openIssues = (await listPilotIssues(supabase)).filter(
      (i) => i.status === "open" || i.status === "in_progress"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missingTable =
      /relation .* does not exist/i.test(message) ||
      /Could not find the table/i.test(message) ||
      message.includes("42P01");
    if (!missingTable) {
      console.error("[AssistedPilot] Failed to load pilot dashboard:", message.slice(0, 200));
      throw error;
    }
    // Tables may not be migrated yet in local/dev — return empty pilot frame.
    return {
      generatedAt: new Date().toISOString(),
      scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
      pilots: [],
      openIssues: [],
      aggregateReadiness: computePilotReadinessScore({
        metrics: emptyMetrics(),
        openIssues: [],
        completionPercentage: 0,
        documentationComplete: true,
        scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
      }),
      launchRecommendation: computePilotReadinessScore({
        metrics: emptyMetrics(),
        openIssues: [],
        completionPercentage: 0,
        documentationComplete: true,
        scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
      }).launchRecommendation,
    };
  }

  const summaries = await Promise.all(
    pilots.map((pilot) => buildPilotSummary(supabase, pilot, openIssues))
  );

  const aggregateMetrics = summaries.reduce((acc, pilot) => {
    acc.recommendationsCreated += pilot.metrics.recommendationsCreated;
    acc.recommendationsApproved += pilot.metrics.recommendationsApproved;
    acc.publishSuccess += pilot.metrics.publishSuccess;
    acc.analyticsSuccess += pilot.metrics.analyticsSuccess;
    acc.manualInterventions += pilot.metrics.manualInterventions;
    acc.workflowFailures += pilot.metrics.workflowFailures;
    return acc;
  }, emptyMetrics());

  const avgCompletion =
    summaries.length === 0
      ? 0
      : Math.round(
          summaries.reduce((sum, p) => sum + p.completionPercentage, 0) / summaries.length
        );

  const aggregateReadiness = computePilotReadinessScore({
    metrics: aggregateMetrics,
    openIssues,
    completionPercentage: avgCompletion,
    documentationComplete: true,
    scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
  });

  return {
    generatedAt: new Date().toISOString(),
    scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
    pilots: summaries,
    openIssues,
    aggregateReadiness,
    launchRecommendation: aggregateReadiness.launchRecommendation,
  };
}

export async function registerPilotBusiness(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    displayName: string;
    notes?: string | null;
  }
) {
  // Tenant ownership check: profile must belong to userId.
  const { data: profile, error } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", input.businessProfileId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Business profile not found for this user.");

  return upsertPilotBusiness(supabase, {
    userId: input.userId,
    businessProfileId: input.businessProfileId,
    displayName: input.displayName,
    notes: input.notes ?? null,
  });
}

export async function setPilotChecklistStage(
  supabase: SupabaseClient,
  pilotBusinessId: string,
  stageKey: PilotChecklistStageKey,
  status: PilotStageStatus,
  errorMessage?: string | null
) {
  const pilot = await getPilotBusinessById(supabase, pilotBusinessId);
  if (!pilot) throw new Error("Pilot business not found.");
  await updateChecklistStage(supabase, pilotBusinessId, stageKey, status, errorMessage ?? null);
  return listChecklistItems(supabase, pilotBusinessId);
}

export async function addPilotIssueRecord(
  supabase: SupabaseClient,
  input: {
    pilotBusinessId?: string | null;
    severity: PilotIssueSeverity;
    category: PilotIssueCategory;
    workflowStage?: string | null;
    description: string;
    owner?: string | null;
  }
) {
  if (input.pilotBusinessId) {
    const pilot = await getPilotBusinessById(supabase, input.pilotBusinessId);
    if (!pilot) throw new Error("Pilot business not found.");
  }
  return createPilotIssue(supabase, input);
}

export async function patchPilotIssueRecord(
  supabase: SupabaseClient,
  id: string,
  patch: {
    status?: PilotIssueStatus;
    owner?: string | null;
    resolution?: string | null;
    severity?: PilotIssueSeverity;
  }
) {
  return updatePilotIssue(supabase, id, patch);
}
