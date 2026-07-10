import "server-only";

/**
 * Read-only health/status visibility for the analytics-capture-sweep and
 * analytics-capture-for-tenant Trigger.dev tasks, independent of the Trigger.dev
 * dashboard. Not wired into any route or UI yet (out of scope for this branch) — this
 * exists so a future ops surface (or a manual debugging session) has a typed, testable
 * function to call rather than hand-rolling API calls against the Trigger.dev runs API.
 *
 * Accepts an injected runs client (matching this codebase's established dependency-
 * injection pattern) so it can be unit tested without a real TRIGGER_SECRET_KEY or
 * network access; defaults to the real `runs` client from @trigger.dev/sdk.
 */

export type AnalyticsCaptureRunSummary = {
  id: string;
  status: string;
  createdAt: Date;
  taskIdentifier: string;
  isSuccess: boolean;
  isFailed: boolean;
};

export type RunsListClient = {
  list: (params: Record<string, unknown>) => AsyncIterable<{
    id: string;
    status: string;
    createdAt: Date;
    taskIdentifier: string;
    isSuccess: boolean;
    isFailed: boolean;
  }>;
};

const TASK_IDENTIFIERS = ["analytics-capture-sweep", "analytics-capture-for-tenant"] as const;

async function loadDefaultRunsClient(): Promise<RunsListClient> {
  const { runs } = await import("@trigger.dev/sdk");
  return runs as unknown as RunsListClient;
}

/**
 * Returns the most recent runs of the analytics capture sweep and per-tenant tasks,
 * newest first, for basic health visibility ("did the last sweep run, did it succeed").
 * Never mutates anything — read-only against the Trigger.dev runs API.
 */
export async function getRecentAnalyticsCaptureRuns(
  limit = 20,
  runsClient?: RunsListClient
): Promise<AnalyticsCaptureRunSummary[]> {
  const client = runsClient ?? (await loadDefaultRunsClient());
  const results: AnalyticsCaptureRunSummary[] = [];

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
