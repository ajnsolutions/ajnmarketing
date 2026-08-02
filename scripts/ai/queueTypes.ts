/**
 * Shared types for the .ai/queue/ system. Imported by validate-queue.ts,
 * run-queue.ts, queue-status.ts, and reset-queue.ts so the schema is
 * defined exactly once.
 */

export const SUPPORTED_AGENTS = ["claude"] as const;
export type SupportedAgent = (typeof SUPPORTED_AGENTS)[number];

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "blocked",
  "disabled",
  "skipped",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const BRANCH_STRATEGIES = ["independent", "stacked"] as const;
export type BranchStrategy = (typeof BRANCH_STRATEGIES)[number];

export interface QueueSafety {
  allow_merge: boolean;
  allow_deploy: boolean;
  allow_production_migrations: boolean;
  allow_secret_changes: boolean;
  allow_production_schedule_activation: boolean;
}

export interface QueueTask {
  id: string;
  name: string;
  prompt: string;
  branch: string;
  agent: string;
  depends_on: string[];
  requires_migration: boolean;
  requires_deployment: boolean;
  requires_secret_change: boolean;
  activates_production_schedule: boolean;
  stop_if_ambiguous: boolean;
  status: string;
}

export interface QueueMeta {
  name: string;
  project: string;
  execution_mode: string;
  stop_on_failure: boolean;
  branch_strategy: string;
  base_branch: string;
  default_agent: string;
  /**
   * Queue v2 (baseline-aware quality gates). How many times run-queue.ts
   * will re-invoke the agent with a narrow repair prompt when a task's
   * quality-gate comparison finds new regressions, before giving up and
   * failing the task. Optional — DEFAULT_MAX_REPAIR_ATTEMPTS applies when
   * absent, so a queue file written before this field existed stays valid.
   */
  max_repair_attempts?: number;
}

/** Applied when queue.max_repair_attempts is absent from RUN_QUEUE.yaml. */
export const DEFAULT_MAX_REPAIR_ATTEMPTS = 3;

export interface RunQueue {
  queue: QueueMeta;
  safety: QueueSafety;
  tasks: QueueTask[];
}

export interface ValidationIssue {
  /** Which task id this issue belongs to, or "queue" for a queue-level issue. */
  scope: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

// --- QUEUE_STATUS.json ---

export interface TaskState {
  id: string;
  name: string;
  status: TaskStatus | string;
  branch: string | null;
  commit: string | null;
  pr: string | null;
  started_at: string | null;
  completed_at: string | null;
  tests: string | null;
  blocker: string | null;
}

export interface QueueState {
  queue_name: string;
  generated_at: string;
  generated_by: string;
  current_task: string | null;
  last_run_id: string | null;
  resume_eligible: boolean;
  tasks: TaskState[];
}
