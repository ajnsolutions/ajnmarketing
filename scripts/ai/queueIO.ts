/**
 * Shared filesystem I/O for the .ai/queue/ system: loading RUN_QUEUE.yaml
 * and reading/writing QUEUE_STATUS.json. Kept separate from validation and
 * orchestration logic so both can be unit tested without touching disk.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { QueueState, RunQueue } from "./queueTypes.ts";

export const QUEUE_DIR = ".ai/queue";
export const RUN_QUEUE_PATH = join(QUEUE_DIR, "RUN_QUEUE.yaml");
export const QUEUE_STATUS_PATH = join(QUEUE_DIR, "QUEUE_STATUS.json");
export const RUNS_DIR = ".ai/runs";

export class QueueFileError extends Error {}

/** Reads and parses RUN_QUEUE.yaml. Throws QueueFileError on missing file or invalid YAML syntax. */
export function loadRunQueue(repoRoot: string): unknown {
  const path = join(repoRoot, RUN_QUEUE_PATH);
  if (!existsSync(path)) {
    throw new QueueFileError(`${RUN_QUEUE_PATH} does not exist at ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  try {
    return parseYaml(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new QueueFileError(`${RUN_QUEUE_PATH} is not valid YAML: ${detail}`);
  }
}

/** Type-narrows a parsed value to RunQueue's rough shape without throwing — callers must still run validateQueue(). */
export function asRunQueueShape(parsed: unknown): Partial<RunQueue> {
  if (typeof parsed !== "object" || parsed === null) return {};
  return parsed as Partial<RunQueue>;
}

export function loadQueueState(repoRoot: string): QueueState {
  const path = join(repoRoot, QUEUE_STATUS_PATH);
  if (!existsSync(path)) {
    throw new QueueFileError(`${QUEUE_STATUS_PATH} does not exist at ${path}. Run "npm run ai:queue:reset -- --confirm" to initialize it.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as QueueState;
}

export function saveQueueState(repoRoot: string, state: QueueState): void {
  const path = join(repoRoot, QUEUE_STATUS_PATH);
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

/** True when the queue can be safely re-run with `npm run ai:queue` and it will pick up where it left off — false when a task is stuck in_progress (a previous run crashed mid-task and needs manual inspection first) or nothing pending remains. */
export function computeResumeEligible(state: QueueState): boolean {
  const anyInProgress = state.tasks.some((t) => t.status === "in_progress");
  const anyPending = state.tasks.some((t) => t.status === "pending");
  return !anyInProgress && anyPending;
}

/** Builds a fresh QueueState from a validated RunQueue, preserving nothing — used by reset-queue.ts. */
export function buildInitialQueueState(queue: RunQueue): QueueState {
  return {
    queue_name: queue.queue.name,
    generated_at: new Date().toISOString(),
    generated_by: "scripts/ai/reset-queue.ts",
    current_task: null,
    last_run_id: null,
    resume_eligible: false,
    tasks: queue.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      branch: null,
      commit: null,
      pr: null,
      started_at: null,
      completed_at: null,
      tests: null,
      blocker: null,
    })),
  };
}
