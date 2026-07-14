import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCorrelationId } from "@/lib/observability/workflowLogger";
import { evaluateOpsAlerts } from "@/lib/production-alerts/evaluate";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";
import type { OpsDashboardSummary, OpsQueueCounts, OpsSectionSummary } from "@/lib/ops-dashboard/types";

function emptyCounts(): OpsQueueCounts {
  return { pending: 0, running: 0, failed: 0, completed: 0, retrying: 0 };
}

function section(
  id: string,
  title: string,
  counts: OpsQueueCounts,
  extras?: Partial<OpsSectionSummary>
): OpsSectionSummary {
  return {
    id,
    title,
    counts,
    lastExecutionAt: extras?.lastExecutionAt ?? null,
    lastError: extras?.lastError ?? null,
    averageDurationMs: extras?.averageDurationMs ?? null,
    queueDepth:
      extras?.queueDepth ??
      counts.pending + counts.running + counts.retrying + counts.failed,
    notes: extras?.notes,
  };
}

async function countWhere(
  supabase: SupabaseClient,
  table: string,
  filters: Array<{ column: string; value: string | number | boolean }>
): Promise<number> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const filter of filters) {
    query = query.eq(filter.column, filter.value);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function countWhereIn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[]
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in(column, values);
  if (error) return 0;
  return count ?? 0;
}

async function recentAudit(
  supabase: SupabaseClient,
  actionPrefix: string,
  sinceIso: string
): Promise<{ failures: number; successes: number; lastAt: string | null; lastError: string | null }> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("status, created_at, metadata, action")
    .gte("created_at", sinceIso)
    .ilike("action", `${actionPrefix}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    return { failures: 0, successes: 0, lastAt: null, lastError: null };
  }

  const failures = data.filter((row) => row.status === "failure").length;
  const successes = data.filter((row) => row.status === "success").length;
  const last = data[0] ?? null;
  const meta = (last?.metadata ?? {}) as Record<string, unknown>;
  const lastError =
    typeof meta.error === "string"
      ? meta.error.slice(0, 200)
      : typeof meta.message === "string"
        ? meta.message.slice(0, 200)
        : null;

  return {
    failures,
    successes,
    lastAt: typeof last?.created_at === "string" ? last.created_at : null,
    lastError: last?.status === "failure" ? lastError : null,
  };
}

/**
 * Aggregates operational signals for the admin ops dashboard.
 * Uses existing tables; avoids Trigger.dev polling unless credentials are present later.
 */
export async function buildOpsDashboardSummary(
  supabase: SupabaseClient
): Promise<OpsDashboardSummary> {
  const correlationId = createCorrelationId();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    pendingApprovals,
    approvedApprovals,
    rejectedApprovals,
    publishedApprovals,
    jobsQueued,
    jobsPublishing,
    jobsFailed,
    jobsCompleted,
    jobsRetrying,
    highRetryJobs,
    oauthConnected,
    oauthOther,
    pipelineAudit,
    publishingAudit,
    analyticsAudit,
    emailActionAudit,
  ] = await Promise.all([
    countWhere(supabase, "content_approvals", [{ column: "status", value: "pending" }]),
    countWhere(supabase, "content_approvals", [{ column: "status", value: "approved" }]),
    countWhere(supabase, "content_approvals", [{ column: "status", value: "rejected" }]),
    countWhere(supabase, "content_approvals", [{ column: "status", value: "published" }]),
    countWhere(supabase, "publishing_jobs", [{ column: "status", value: "queued" }]),
    countWhere(supabase, "publishing_jobs", [{ column: "status", value: "publishing" }]),
    countWhere(supabase, "publishing_jobs", [{ column: "status", value: "failed" }]),
    countWhereIn(supabase, "publishing_jobs", "status", ["published", "verified"]),
    countWhere(supabase, "publishing_jobs", [{ column: "status", value: "retrying" }]),
    // retry_count >= 3 approximated via filter when column exists; soft-fail to 0
    (async () => {
      const { count, error } = await supabase
        .from("publishing_jobs")
        .select("id", { count: "exact", head: true })
        .gte("retry_count", 3);
      return error ? 0 : (count ?? 0);
    })(),
    countWhere(supabase, "google_business_profile_connections", [
      { column: "connection_status", value: "connected" },
    ]).catch(() => 0),
    (async () => {
      const { count, error } = await supabase
        .from("google_business_profile_connections")
        .select("id", { count: "exact", head: true })
        .neq("connection_status", "connected");
      return error ? 0 : (count ?? 0);
    })(),
    recentAudit(supabase, "recommendation_pipeline", since),
    recentAudit(supabase, "publishing", since),
    recentAudit(supabase, "analytics", since),
    recentAudit(supabase, "email_action", since),
  ]);

  const recommendationCounts = emptyCounts();
  recommendationCounts.completed = Math.max(0, approvedApprovals + publishedApprovals);
  recommendationCounts.failed = pipelineAudit.failures;
  recommendationCounts.pending = pendingApprovals;

  const publishingCounts: OpsQueueCounts = {
    pending: jobsQueued,
    running: jobsPublishing,
    failed: jobsFailed,
    completed: jobsCompleted,
    retrying: jobsRetrying,
  };

  const approvalCounts: OpsQueueCounts = {
    pending: pendingApprovals,
    running: 0,
    failed: rejectedApprovals,
    completed: approvedApprovals + publishedApprovals,
    retrying: 0,
  };

  const analyticsCounts = emptyCounts();
  analyticsCounts.failed = analyticsAudit.failures;
  analyticsCounts.completed = analyticsAudit.successes;

  const emailCounts = emptyCounts();
  emailCounts.failed = emailActionAudit.failures;
  emailCounts.completed = emailActionAudit.successes;

  const oauthCounts = emptyCounts();
  oauthCounts.completed = oauthConnected;
  oauthCounts.failed = oauthOther;

  const learningCounts = emptyCounts();

  const sections: OpsSectionSummary[] = [
    section("recommendation_pipeline", "Recommendation Pipeline", recommendationCounts, {
      lastExecutionAt: pipelineAudit.lastAt,
      lastError: pipelineAudit.lastError,
      notes: "Aggregated from approvals + recommendation_pipeline audit events (24h).",
    }),
    section("publishing_queue", "Publishing Queue", publishingCounts, {
      lastExecutionAt: publishingAudit.lastAt,
      lastError: publishingAudit.lastError,
    }),
    section(
      "publishing_failures",
      "Publishing Failures",
      { ...emptyCounts(), failed: jobsFailed, retrying: jobsRetrying },
      {
        lastError: publishingAudit.lastError,
        notes: "Failed + retrying jobs require operator attention before schedule activation.",
      }
    ),
    section("analytics_queue", "Analytics Queue", analyticsCounts, {
      lastExecutionAt: analyticsAudit.lastAt,
      lastError: analyticsAudit.lastError,
      notes: "Cron attachment gated; capture can still be run via admin trigger.",
    }),
    section("weekly_email", "Weekly Email Generation", emailCounts, {
      notes: "Generator + preview exist; outbound provider send is not activated.",
    }),
    section("approval_activity", "Approval Activity", approvalCounts, {
      lastExecutionAt: emailActionAudit.lastAt,
      lastError: emailActionAudit.lastError,
    }),
    section("trigger_health", "Trigger.dev Task Health", emptyCounts(), {
      notes: ATTACH_DECLARATIVE_PRODUCTION_CRONS
        ? "Cron gate OPEN."
        : "Cron gate closed (ATTACH_DECLARATIVE_PRODUCTION_CRONS=false). No production schedules attached.",
    }),
    section("oauth_health", "OAuth Connection Health", oauthCounts, {
      notes: `${oauthConnected} connected; ${oauthOther} non-connected.`,
    }),
    section(
      "retry_queue",
      "Retry Queue",
      { ...emptyCounts(), retrying: jobsRetrying, failed: highRetryJobs },
      {
        notes: `${highRetryJobs} job(s) with retry_count >= 3.`,
      }
    ),
    section("outcome_learning", "Outcome Learning", learningCounts, {
      notes: "Inspect via /api/admin/recommendation-learning-debug when diagnosing adaptive updates.",
    }),
  ];

  const alerts = evaluateOpsAlerts({
    publishingFailedCount: jobsFailed,
    publishingRetryingCount: jobsRetrying,
    oauthDisconnectedCount: oauthOther,
    recommendationExecutionFailures24h: pipelineAudit.failures,
    analyticsBacklogCount: 0,
    emailGenerationFailures24h: emailActionAudit.failures,
    approvalFailures24h: emailActionAudit.failures,
    highRetryJobCount: highRetryJobs,
  });

  return {
    generatedAt: new Date().toISOString(),
    correlationId,
    scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
    sections,
    alertCounts: alerts.counts,
  };
}
