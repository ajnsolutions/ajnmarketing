export type PipelineStageName =
  | "website_analysis"
  | "ai_marketing_profile"
  | "market_context"
  | "opportunity_detection"
  | "decision_engine"
  | "content_execution";

/** Fixed execution order — every result array from the orchestrator follows this order. */
export const PIPELINE_STAGE_ORDER: PipelineStageName[] = [
  "website_analysis",
  "ai_marketing_profile",
  "market_context",
  "opportunity_detection",
  "decision_engine",
  "content_execution",
];

export type PipelineStageStatus = "completed" | "skipped" | "failed";

export type PipelineStageResult = {
  stage: PipelineStageName;
  status: PipelineStageStatus;
  reason: string;
  details?: Record<string, unknown>;
};

/**
 * Aggregate pipeline outcome. Matches the product's need to distinguish full success,
 * mixed outcomes, and total failure — without inventing a new audit-log status enum
 * (DB still only allows started|success|failure; see mapPipelineStatusToAuditStatus).
 */
export const PipelineOverallStatuses = {
  SUCCESS: "success",
  PARTIAL_SUCCESS: "partial_success",
  FAILURE: "failure",
} as const;

export type PipelineOverallStatus =
  (typeof PipelineOverallStatuses)[keyof typeof PipelineOverallStatuses];

export type PipelineStageSummary = {
  completed: number;
  skipped: number;
  failed: number;
  completedStages: PipelineStageName[];
  skippedStages: PipelineStageName[];
  failedStages: PipelineStageName[];
  /** Flat operator-readable line, e.g. "partial_success: 3 completed, 1 skipped, 1 failed". */
  label: string;
};

export type RecommendationPipelineResult = {
  userId: string;
  businessProfileId: string | null;
  status: PipelineOverallStatus;
  stages: PipelineStageResult[];
  summary: PipelineStageSummary;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

/**
 * Derive overall status from per-stage results.
 * - SUCCESS: no failures (all completed and/or legitimately skipped)
 * - PARTIAL_SUCCESS: at least one completed and at least one failed
 * - FAILURE: one or more failures and zero completions (no useful work finished)
 */
export function derivePipelineOverallStatus(
  stages: PipelineStageResult[]
): PipelineOverallStatus {
  const completed = stages.filter((s) => s.status === "completed").length;
  const failed = stages.filter((s) => s.status === "failed").length;

  if (failed === 0) return PipelineOverallStatuses.SUCCESS;
  if (completed > 0) return PipelineOverallStatuses.PARTIAL_SUCCESS;
  return PipelineOverallStatuses.FAILURE;
}

export function buildPipelineStageSummary(
  stages: PipelineStageResult[],
  status: PipelineOverallStatus
): PipelineStageSummary {
  const completedStages = stages
    .filter((s) => s.status === "completed")
    .map((s) => s.stage);
  const skippedStages = stages.filter((s) => s.status === "skipped").map((s) => s.stage);
  const failedStages = stages.filter((s) => s.status === "failed").map((s) => s.stage);

  return {
    completed: completedStages.length,
    skipped: skippedStages.length,
    failed: failedStages.length,
    completedStages,
    skippedStages,
    failedStages,
    label: `${status}: ${completedStages.length} completed, ${skippedStages.length} skipped, ${failedStages.length} failed`,
  };
}

/** Map pipeline overall status onto the existing audit_logs.status check constraint. */
export function mapPipelineStatusToAuditStatus(
  status: PipelineOverallStatus
): "success" | "failure" {
  // partial_success is still a completed run with usable work — mirror Google Business
  // sync's convention (domain "partial" -> audit status "success" + flat outcome field).
  return status === PipelineOverallStatuses.FAILURE ? "failure" : "success";
}

export function buildPipelineAuditMetadata(result: {
  status: PipelineOverallStatus;
  summary: PipelineStageSummary;
  durationMs: number;
  stages: PipelineStageResult[];
}): Record<string, unknown> {
  return {
    // Flat top-level fields so operators need not dig into nested stage arrays.
    pipelineStatus: result.status,
    summary: result.summary.label,
    completed: result.summary.completed,
    skipped: result.summary.skipped,
    failed: result.summary.failed,
    completedStages: result.summary.completedStages,
    skippedStages: result.summary.skippedStages,
    failedStages: result.summary.failedStages,
    durationMs: result.durationMs,
    stages: result.stages.map((s) => ({
      stage: s.stage,
      status: s.status,
      reason: s.reason,
    })),
  };
}
