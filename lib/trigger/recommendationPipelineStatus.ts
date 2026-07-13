import "server-only";

/**
 * Read-only health/status visibility for the recommendation-pipeline-for-tenant
 * Trigger.dev task, independent of the Trigger.dev dashboard. Not wired into any route
 * or UI yet — exists so a future ops surface (or a manual debugging session) has a typed,
 * testable function to call rather than hand-rolling API calls against the Trigger.dev
 * runs API.
 *
 * Mirrors lib/trigger/analyticsCaptureStatus.ts.
 */

export type RecommendationPipelineRunSummary = {
  id: string;
  status: string;
  createdAt: Date;
  taskIdentifier: string;
  isSuccess: boolean;
  isFailed: boolean;
};

export type RecommendationPipelineRunsListClient = {
  list: (params: Record<string, unknown>) => AsyncIterable<{
    id: string;
    status: string;
    createdAt: Date;
    taskIdentifier: string;
    isSuccess: boolean;
    isFailed: boolean;
  }>;
};

const TASK_IDENTIFIERS = ["recommendation-pipeline-for-tenant"] as const;

async function loadDefaultRunsClient(): Promise<RecommendationPipelineRunsListClient> {
  const { runs } = await import("@trigger.dev/sdk");
  return runs as unknown as RecommendationPipelineRunsListClient;
}

/**
 * Returns the most recent recommendation-pipeline runs, newest first, for basic health
 * visibility ("last run / last success / last failure"). Never mutates anything —
 * read-only against the Trigger.dev runs API.
 */
export async function getRecentRecommendationPipelineRuns(
  limit = 20,
  runsClient?: RecommendationPipelineRunsListClient
): Promise<RecommendationPipelineRunSummary[]> {
  const client = runsClient ?? (await loadDefaultRunsClient());
  const results: RecommendationPipelineRunSummary[] = [];

  for (const taskIdentifier of TASK_IDENTIFIERS) {
    for await (const run of client.list({ taskIdentifier, limit })) {
      results.push({
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        taskIdentifier: run.taskIdentifier,
        isSuccess: run.isSuccess,
        isFailed: run.isFailed,
      });
    }
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return results.slice(0, limit);
}

export type RecommendationPipelineHealth = {
  lastRun: RecommendationPipelineRunSummary | null;
  lastSuccess: RecommendationPipelineRunSummary | null;
  lastFailure: RecommendationPipelineRunSummary | null;
  /** Coarse current status derived from the newest run, or "idle" when none exist. */
  currentStatus: string;
};

/**
 * Operator-facing summary of pipeline task health. Pure projection over
 * getRecentRecommendationPipelineRuns — no extra network calls when a runs client is
 * injected for tests.
 */
export async function getRecommendationPipelineHealth(
  limit = 20,
  runsClient?: RecommendationPipelineRunsListClient
): Promise<RecommendationPipelineHealth> {
  const recent = await getRecentRecommendationPipelineRuns(limit, runsClient);
  const lastRun = recent[0] ?? null;
  const lastSuccess = recent.find((r) => r.isSuccess) ?? null;
  const lastFailure = recent.find((r) => r.isFailed) ?? null;

  return {
    lastRun,
    lastSuccess,
    lastFailure,
    currentStatus: lastRun?.status ?? "idle",
  };
}
