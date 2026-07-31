#!/usr/bin/env node
/**
 * Validates .ai/queue/RUN_QUEUE.yaml. Run directly: `npm run ai:queue:validate`
 * (or `node --experimental-strip-types scripts/ai/validate-queue.ts`).
 *
 * Exit code 0 = valid queue, safe to run. Exit code 1 = invalid, prints every
 * problem found (does not stop at the first one) so a human can fix them all
 * in one pass.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BRANCH_STRATEGIES,
  SUPPORTED_AGENTS,
  TASK_STATUSES,
  type QueueTask,
  type RunQueue,
  type ValidationIssue,
  type ValidationResult,
} from "./queueTypes.ts";
import { loadRunQueue, QUEUE_DIR, QueueFileError } from "./queueIO.ts";

const SCHEDULE_ACTIVATION_FILE = "lib/trigger/scheduleActivation.ts";
const SCHEDULE_ACTIVATION_FLAG = "ATTACH_DECLARATIVE_PRODUCTION_CRONS";

/** A conservative safe-branch-name check — not full `git check-ref-format` parity, but enough to catch obviously broken values. */
function isValidBranchName(name: unknown): name is string {
  if (typeof name !== "string" || name.length === 0) return false;
  if (name.startsWith("-") || name.startsWith("/") || name.endsWith("/") || name.endsWith(".")) return false;
  if (name.includes("..") || name.includes(" ") || name.includes("~") || name.includes("^") || name.includes(":") || name.includes("?") || name.includes("*") || name.includes("[")) {
    return false;
  }
  return /^[A-Za-z0-9._/-]+$/.test(name);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function pushError(errors: ValidationIssue[], scope: string, message: string): void {
  errors.push({ scope, message });
}

/**
 * Cross-checks the queue's own safety promise against the repository's real,
 * code-level production-schedule gate — so the queue can't be "safe on
 * paper" while the actual gate has drifted to true. See
 * lib/trigger/scheduleActivation.ts (ADR-0004 in .ai/DECISIONS.md).
 */
function checkRealScheduleGate(repoRoot: string, errors: ValidationIssue[]): void {
  const path = join(repoRoot, SCHEDULE_ACTIVATION_FILE);
  if (!existsSync(path)) {
    pushError(
      errors,
      "queue",
      `Could not find ${SCHEDULE_ACTIVATION_FILE} to verify the real production-schedule gate. Refusing to run until this can be confirmed.`
    );
    return;
  }
  const contents = readFileSync(path, "utf8");
  const match = contents.match(new RegExp(`${SCHEDULE_ACTIVATION_FLAG}\\s*=\\s*(true|false)`));
  if (!match) {
    pushError(
      errors,
      "queue",
      `Could not find a "${SCHEDULE_ACTIVATION_FLAG} = true|false" assignment in ${SCHEDULE_ACTIVATION_FILE}. Refusing to run until the real gate state can be confirmed.`
    );
    return;
  }
  if (match[1] === "true") {
    pushError(
      errors,
      "queue",
      `Production schedule gate appears ENABLED in the repository itself (${SCHEDULE_ACTIVATION_FILE} has ${SCHEDULE_ACTIVATION_FLAG} = true). This is a repository-level production-safety issue outside the queue's control — resolve it directly before running any queue task.`
    );
  }
}

function validateQueueMeta(queue: Partial<RunQueue["queue"]> | undefined, errors: ValidationIssue[]): void {
  if (!queue || typeof queue !== "object") {
    pushError(errors, "queue", "Missing top-level `queue:` block.");
    return;
  }
  for (const field of ["name", "project", "execution_mode", "branch_strategy", "base_branch", "default_agent"] as const) {
    if (!isNonEmptyString(queue[field])) {
      pushError(errors, "queue", `queue.${field} is required and must be a non-empty string.`);
    }
  }
  if (!isBoolean(queue.stop_on_failure)) {
    pushError(errors, "queue", "queue.stop_on_failure is required and must be a boolean.");
  } else if (queue.stop_on_failure !== true) {
    pushError(errors, "queue", "queue.stop_on_failure must be true — unattended queue runs in this version require stopping on the first failure.");
  }
  if (isNonEmptyString(queue.execution_mode) && queue.execution_mode !== "sequential") {
    pushError(errors, "queue", `queue.execution_mode "${queue.execution_mode}" is not supported — only "sequential" is implemented in this version.`);
  }
  if (isNonEmptyString(queue.branch_strategy) && !(BRANCH_STRATEGIES as readonly string[]).includes(queue.branch_strategy)) {
    pushError(errors, "queue", `queue.branch_strategy "${queue.branch_strategy}" is not supported — must be one of: ${BRANCH_STRATEGIES.join(", ")}.`);
  }
  if (isNonEmptyString(queue.default_agent) && !(SUPPORTED_AGENTS as readonly string[]).includes(queue.default_agent)) {
    pushError(
      errors,
      "queue",
      `queue.default_agent "${queue.default_agent}" is not a supported agent — only ${SUPPORTED_AGENTS.join(", ")} can actually execute tasks in this version. See scripts/ai/adapters/cursor-placeholder.ts.`
    );
  }
}

function validateSafety(safety: Partial<RunQueue["safety"]> | undefined, errors: ValidationIssue[]): void {
  if (!safety || typeof safety !== "object") {
    pushError(errors, "queue", "Missing top-level `safety:` block.");
    return;
  }
  const keys = [
    "allow_merge",
    "allow_deploy",
    "allow_production_migrations",
    "allow_secret_changes",
    "allow_production_schedule_activation",
  ] as const;
  for (const key of keys) {
    if (!isBoolean(safety[key])) {
      pushError(errors, "queue", `safety.${key} is required and must be a boolean.`);
    } else if (safety[key] !== false) {
      pushError(
        errors,
        "queue",
        `safety.${key} is true — this queue implementation refuses to run unless every safety flag is false. Merge, deploy, production migrations, secret changes, and production-schedule activation all remain human-only actions.`
      );
    }
  }
}

function validateTaskShape(task: Partial<QueueTask>, index: number, repoRoot: string, errors: ValidationIssue[]): void {
  const scope = isNonEmptyString(task.id) ? task.id : `tasks[${index}]`;

  if (!isNonEmptyString(task.id)) pushError(errors, scope, "task.id is required and must be a non-empty string.");
  if (!isNonEmptyString(task.name)) pushError(errors, scope, "task.name is required and must be a non-empty string.");
  if (!isNonEmptyString(task.prompt)) {
    pushError(errors, scope, "task.prompt is required and must be a non-empty string.");
  } else {
    const promptPath = join(repoRoot, QUEUE_DIR, task.prompt);
    if (!existsSync(promptPath)) {
      pushError(errors, scope, `task.prompt file does not exist: ${QUEUE_DIR}/${task.prompt}`);
    }
  }
  if (!isValidBranchName(task.branch)) {
    pushError(errors, scope, `task.branch is missing or not a valid branch name: ${JSON.stringify(task.branch)}`);
  }
  if (!isNonEmptyString(task.agent) || !(SUPPORTED_AGENTS as readonly string[]).includes(task.agent)) {
    pushError(errors, scope, `task.agent "${task.agent}" is not a supported agent — only ${SUPPORTED_AGENTS.join(", ")} can actually execute tasks in this version.`);
  }
  if (!Array.isArray(task.depends_on) || !task.depends_on.every((d) => typeof d === "string")) {
    pushError(errors, scope, "task.depends_on is required and must be an array of task-id strings (use [] for none).");
  }
  for (const field of ["requires_migration", "requires_deployment", "requires_secret_change", "activates_production_schedule"] as const) {
    if (!isBoolean(task[field])) {
      pushError(errors, scope, `task.${field} is required and must be a boolean.`);
    } else if (task[field] !== false) {
      pushError(
        errors,
        scope,
        `task.${field} is true. No task in this queue may require a production migration, a deployment, a secret change, or production-schedule activation — those remain human-only actions outside the queue entirely.`
      );
    }
  }
  if (!isBoolean(task.stop_if_ambiguous)) {
    pushError(errors, scope, "task.stop_if_ambiguous is required and must be a boolean.");
  } else if (task.stop_if_ambiguous !== true) {
    pushError(errors, scope, "task.stop_if_ambiguous must be true — every queue task must stop rather than guess when requirements are ambiguous.");
  }
  if (!isNonEmptyString(task.status) || !(TASK_STATUSES as readonly string[]).includes(task.status)) {
    pushError(errors, scope, `task.status "${task.status}" is invalid — must be one of: ${TASK_STATUSES.join(", ")}.`);
  }
}

function validateTaskGraph(tasks: QueueTask[], errors: ValidationIssue[]): void {
  const idCounts = new Map<string, number>();
  const branchCounts = new Map<string, number>();
  for (const task of tasks) {
    if (!isNonEmptyString(task.id)) continue;
    idCounts.set(task.id, (idCounts.get(task.id) ?? 0) + 1);
    if (isNonEmptyString(task.branch)) branchCounts.set(task.branch, (branchCounts.get(task.branch) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) pushError(errors, id, `task id "${id}" is used ${count} times — task ids must be unique.`);
  }
  for (const [branch, count] of branchCounts) {
    if (count > 1) pushError(errors, "queue", `branch "${branch}" is used by ${count} tasks — each task must have a unique branch.`);
  }

  const knownIds = new Set(tasks.map((t) => t.id).filter(isNonEmptyString));
  for (const task of tasks) {
    if (!isNonEmptyString(task.id) || !Array.isArray(task.depends_on)) continue;
    for (const dep of task.depends_on) {
      if (!knownIds.has(dep)) {
        pushError(errors, task.id, `depends_on references unknown task id "${dep}".`);
      }
      if (dep === task.id) {
        pushError(errors, task.id, `depends_on references itself.`);
      }
    }
  }

  // Cycle detection (DFS, three-color).
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const byId = new Map(tasks.filter((t) => isNonEmptyString(t.id)).map((t) => [t.id, t]));
  for (const id of byId.keys()) color.set(id, WHITE);

  const stack: string[] = [];
  function visit(id: string): boolean {
    color.set(id, GRAY);
    stack.push(id);
    const task = byId.get(id);
    for (const dep of task?.depends_on ?? []) {
      if (!byId.has(dep)) continue; // already reported as a missing reference above
      if (color.get(dep) === GRAY) {
        const cycleStart = stack.indexOf(dep);
        const cycle = [...stack.slice(cycleStart), dep].join(" -> ");
        pushError(errors, id, `dependency cycle detected: ${cycle}`);
        return true;
      }
      if (color.get(dep) === WHITE && visit(dep)) return true;
    }
    stack.pop();
    color.set(id, BLACK);
    return false;
  }
  for (const id of byId.keys()) {
    if (color.get(id) === WHITE) visit(id);
  }

  // A pending task can never legitimately run if any dependency is permanently disabled.
  for (const task of tasks) {
    if (task.status !== "pending") continue;
    for (const dep of task.depends_on ?? []) {
      const depTask = byId.get(dep);
      if (depTask?.status === "disabled") {
        pushError(errors, task.id, `depends on "${dep}", which is status: disabled — this task could never become eligible. Enable "${dep}" first, or mark this task disabled too.`);
      }
    }
  }
}

export function validateQueue(parsed: unknown, repoRoot: string): ValidationResult {
  const errors: ValidationIssue[] = [];

  if (typeof parsed !== "object" || parsed === null) {
    return { valid: false, errors: [{ scope: "queue", message: "RUN_QUEUE.yaml did not parse to an object." }] };
  }
  const queue = parsed as Partial<RunQueue>;

  validateQueueMeta(queue.queue, errors);
  validateSafety(queue.safety, errors);
  checkRealScheduleGate(repoRoot, errors);

  if (!Array.isArray(queue.tasks) || queue.tasks.length === 0) {
    pushError(errors, "queue", "tasks must be a non-empty array.");
  } else {
    queue.tasks.forEach((task, index) => validateTaskShape(task as Partial<QueueTask>, index, repoRoot, errors));
    // Only attempt graph-level checks once every task has the minimum shape needed to reason about the graph.
    const structurallySound = queue.tasks.every(
      (t) => isNonEmptyString((t as Partial<QueueTask>).id) && Array.isArray((t as Partial<QueueTask>).depends_on)
    );
    if (structurallySound) validateTaskGraph(queue.tasks as QueueTask[], errors);
  }

  return { valid: errors.length === 0, errors };
}

function printResult(result: ValidationResult): void {
  if (result.valid) {
    console.log("--- confirmed clean ---");
    console.log(".ai/queue/RUN_QUEUE.yaml is valid.");
    return;
  }
  console.error(`.ai/queue/RUN_QUEUE.yaml is INVALID — ${result.errors.length} problem(s) found:\n`);
  for (const issue of result.errors) {
    console.error(`  [${issue.scope}] ${issue.message}`);
  }
  console.error("\nFix every problem above, then re-run: npm run ai:queue:validate");
}

function main(): void {
  const repoRoot = process.cwd();
  let parsed: unknown;
  try {
    parsed = loadRunQueue(repoRoot);
  } catch (error) {
    if (error instanceof QueueFileError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const result = validateQueue(parsed, repoRoot);
  printResult(result);
  process.exit(result.valid ? 0 : 1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
