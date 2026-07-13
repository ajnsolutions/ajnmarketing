import "server-only";

/**
 * Operator health for Phase 2D scheduled + per-tenant/job Trigger.dev tasks.
 * Distinguishes sweep runs from tenant/job runs. No UI — typed helpers only.
 */

export type ScheduledSubsystemRunSummary = {
  id: string;
  status: string;
  createdAt: Date;
  taskIdentifier: string;
  isSuccess: boolean;
  isFailed: boolean;
  /**
   * When present on completed runs, used for average duration. Trigger.dev run objects
   * expose finishedAt/createdAt; callers may leave undefined for in-flight runs.
   */
  durationMs?: number | null;
};

export type RunsListClient = {
  list: (params: Record<string, unknown>) => AsyncIterable<{
    id: string;
    status: string;
    createdAt: Date;
    taskIdentifier: string;
    isSuccess: boolean;
    isFailed: boolean;
    finishedAt?: Date | null;
    updatedAt?: Date | null;
  }>;
};

/** @deprecated Use RunsListClient — kept for Phase 2C test imports. */
export type RecommendationPipelineRunsListClient = RunsListClient;

export type SchedulesListClient = {
  list: (params?: Record<string, unknown>) => AsyncIterable<{
    id: string;
    task: string;
    active: boolean;
    deduplicationKey?: string | null;
    nextRun?: Date | null;
  }>;
};

const SWEEP_TASK_IDS = [
  "recommendation-pipeline-sweep",
  "analytics-capture-sweep",
  "publishing-due-sweep",
] as const;

const WORKER_TASK_IDS = [
  "recommendation-pipeline-for-tenant",
  "analytics-capture-for-tenant",
  "publishing-execute-job",
] as const;

const ALL_TASK_IDS = [...SWEEP_TASK_IDS, ...WORKER_TASK_IDS] as const;

const PIPELINE_TENANT_TASK = "recommendation-pipeline-for-tenant" as const;

async function loadDefaultRunsClient(): Promise<RunsListClient> {
  const { runs } = await import("@trigger.dev/sdk");
  return runs as unknown as RunsListClient;
}

async function loadDefaultSchedulesClient(): Promise<SchedulesListClient> {
  const { schedules } = await import("@trigger.dev/sdk");
  return schedules as unknown as SchedulesListClient;
}

function runDurationMs(run: {
  createdAt: Date;
  finishedAt?: Date | null;
  updatedAt?: Date | null;
}): number | null {
  const end = run.finishedAt ?? run.updatedAt;
  if (!end) return null;
  return Math.max(0, end.getTime() - run.createdAt.getTime());
}

/** Phase 2C helper — tenant pipeline runs only. */
export async function getRecentRecommendationPipelineRuns(
  limit = 20,
  runsClient?: RunsListClient
): Promise<ScheduledSubsystemRunSummary[]> {
  const client = runsClient ?? (await loadDefaultRunsClient());
  const results: ScheduledSubsystemRunSummary[] = [];

  for await (const run of client.list({ taskIdentifier: PIPELINE_TENANT_TASK, limit })) {
    results.push({
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      taskIdentifier: run.taskIdentifier,
      isSuccess: run.isSuccess,
      isFailed: run.isFailed,
      durationMs: runDurationMs(run),
    });
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return results.slice(0, limit);
}

export async function getRecentScheduledSubsystemRuns(
  limit = 40,
  runsClient?: RunsListClient
): Promise<ScheduledSubsystemRunSummary[]> {
  const client = runsClient ?? (await loadDefaultRunsClient());
  const results: ScheduledSubsystemRunSummary[] = [];

  for (const taskIdentifier of ALL_TASK_IDS) {
    for await (const run of client.list({ taskIdentifier, limit })) {
      results.push({
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        taskIdentifier: run.taskIdentifier,
        isSuccess: run.isSuccess,
        isFailed: run.isFailed,
        durationMs: runDurationMs(run),
      });
    }
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return results.slice(0, limit);
}

export type ScheduleHealthEntry = {
  scheduleId: string;
  taskIdentifier: string;
  active: boolean;
  nextRun: Date | null;
};

export type SubsystemHealth = {
  taskIdentifier: string;
  kind: "sweep" | "worker";
  lastRun: ScheduledSubsystemRunSummary | null;
  lastSuccess: ScheduledSubsystemRunSummary | null;
  lastFailure: ScheduledSubsystemRunSummary | null;
  averageDurationMs: number | null;
  currentStatus: string;
  /** True when newest run is still queued/executing. */
  currentlyExecutingOrQueued: boolean;
  nextScheduledRun: Date | null;
  lastScheduledRun: ScheduledSubsystemRunSummary | null;
};

const EXECUTING_OR_QUEUED = new Set([
  "QUEUED",
  "PENDING_VERSION",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED",
]);

function averageDuration(runs: ScheduledSubsystemRunSummary[]): number | null {
  const samples = runs
    .filter((r) => r.isSuccess && typeof r.durationMs === "number" && r.durationMs >= 0)
    .map((r) => r.durationMs as number);
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

/**
 * Aggregate operator health across all Phase 2D Trigger.dev tasks + attached schedules.
 */
export async function getAutonomousSchedulingHealth(
  limit = 40,
  runsClient?: RunsListClient,
  schedulesClient?: SchedulesListClient
): Promise<{
  subsystems: SubsystemHealth[];
  schedules: ScheduleHealthEntry[];
}> {
  const recent = await getRecentScheduledSubsystemRuns(limit, runsClient);
  const schedClient = schedulesClient ?? (await loadDefaultSchedulesClient());
  const scheduleEntries: ScheduleHealthEntry[] = [];

  for await (const schedule of schedClient.list()) {
    if (!(ALL_TASK_IDS as readonly string[]).includes(schedule.task)) continue;
    scheduleEntries.push({
      scheduleId: schedule.id,
      taskIdentifier: schedule.task,
      active: schedule.active,
      nextRun: schedule.nextRun ?? null,
    });
  }

  const subsystems: SubsystemHealth[] = ALL_TASK_IDS.map((taskIdentifier) => {
    const forTask = recent.filter((r) => r.taskIdentifier === taskIdentifier);
    const lastRun = forTask[0] ?? null;
    const lastSuccess = forTask.find((r) => r.isSuccess) ?? null;
    const lastFailure = forTask.find((r) => r.isFailed) ?? null;
    const kind = (SWEEP_TASK_IDS as readonly string[]).includes(taskIdentifier)
      ? "sweep"
      : "worker";
    const nextScheduledRun =
      scheduleEntries.find((s) => s.taskIdentifier === taskIdentifier && s.active)?.nextRun ??
      null;
    const lastScheduledRun =
      kind === "sweep" ? lastRun : forTask.find((r) => r.taskIdentifier === taskIdentifier) ?? null;

    return {
      taskIdentifier,
      kind,
      lastRun,
      lastSuccess,
      lastFailure,
      averageDurationMs: averageDuration(forTask),
      currentStatus: lastRun?.status ?? "idle",
      currentlyExecutingOrQueued: lastRun
        ? EXECUTING_OR_QUEUED.has(lastRun.status)
        : false,
      nextScheduledRun,
      lastScheduledRun: kind === "sweep" ? lastScheduledRun : null,
    };
  });

  return { subsystems, schedules: scheduleEntries };
}

/** Back-compat wrappers used by Phase 2C callers. */
export async function getRecommendationPipelineHealth(
  limit = 20,
  runsClient?: RunsListClient
) {
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
