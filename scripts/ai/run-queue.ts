#!/usr/bin/env node
/**
 * Runs .ai/queue/RUN_QUEUE.yaml to completion or first failure. Validates
 * first, then executes eligible tasks strictly in dependency order, one at
 * a time (execution_mode: sequential is the only mode this version
 * implements). See docs/AI_OVERNIGHT_QUEUE.md for the full walkthrough.
 *
 * Never merges, never deploys, never applies a production migration, never
 * changes a secret, never activates a production schedule — none of those
 * actions appear anywhere in this file's code path. The safety validator
 * (validate-queue.ts) also refuses to run a queue that asks for any of them.
 *
 * Queue v2 — baseline-aware quality gates. v1 required every task's
 * lint/typecheck/unit-test run to be perfectly clean, which meant this
 * repository's own small set of documented, pre-existing baseline issues
 * (see .ai/OPEN_ITEMS.md) stopped the queue even on a task that introduced
 * zero regressions of its own — a design flaw, not a task failure. v2
 * captures one QualitySnapshot of the repository before this run's first
 * task begins (the "baseline", persisted to .ai/runs/<run>/baseline.json)
 * and compares every task's own after-state against that same baseline:
 * existing debt that's still present and unchanged never fails a task;
 * anything newly broken always does. See scripts/ai/qualityGates.ts.
 *
 * Reliability hardening (2026-08-02) — this run-queue.ts's first real
 * unattended execution (run 2026-08-02T065749882Z, evidence preserved in
 * .ai/runs/2026-08-02T065749882Z/) surfaced two classes of problem this
 * version fixes:
 *   1. The agent adapter itself could report success while having done
 *      nothing (see scripts/ai/adapters/claude.ts's header comment) — fixed
 *      there, not here, but it's why every task attempt below is now
 *      wrapped so a bad adapter result is caught and recorded cleanly
 *      rather than assumed benign.
 *   2. Nothing in this file had a timeout. Every git/gh/quality-gate
 *      subprocess call now goes through scripts/ai/subprocess.ts, which
 *      requires an explicit timeout at every call site. QUEUE_STATUS.json
 *      writes are now atomic (queueIO.ts). The whole run now has a
 *      wall-clock ceiling (queue.max_run_duration_minutes). A crash partway
 *      through a task's attempt no longer disappears silently — it's caught,
 *      recorded as that task's failure, and still produces a normal
 *      RUN_SUMMARY.md/RUN_STATUS.json so a human checking in the morning
 *      has something to read regardless of how the run ended.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { validateQueue } from "./validate-queue.ts";
import { loadRunQueue, loadQueueState, saveQueueState, computeResumeEligible, QUEUE_DIR, RUNS_DIR, QueueFileError } from "./queueIO.ts";
import type { QueueState, QueueTask, RunQueue, TaskState } from "./queueTypes.ts";
import { DEFAULT_MAX_REPAIR_ATTEMPTS, DEFAULT_MAX_RUN_DURATION_MINUTES } from "./queueTypes.ts";
import { claudeAdapter } from "./adapters/claude.ts";
import type { AgentAdapter } from "./adapters/types.ts";
import { sh, runCommand } from "./subprocess.ts";
import {
  captureQualitySnapshot,
  compareQualitySnapshots,
  buildRepairPrompt,
  formatQualityComparisonMarkdown,
  type QualitySnapshot,
  type QualityComparisonResult,
} from "./qualityGates.ts";

const ADAPTERS: Record<string, AgentAdapter> = {
  claude: claudeAdapter,
};

// Per-command timeout budgets. Generous enough for normal operation, bounded
// enough that a hang can never stall an unattended run indefinitely — see
// subprocess.ts's header comment.
const GIT_FETCH_TIMEOUT_MS = 5 * 60 * 1000;
const GIT_CHECKOUT_TIMEOUT_MS = 2 * 60 * 1000;
const GIT_QUICK_TIMEOUT_MS = 2 * 60 * 1000;
const GIT_PUSH_TIMEOUT_MS = 5 * 60 * 1000;
const GH_PR_CREATE_TIMEOUT_MS = 3 * 60 * 1000;

interface StopCondition {
  reason: string;
}

interface AttemptedTask {
  task: QueueTask;
  state: TaskState;
  log: string;
  comparison?: QualityComparisonResult;
  repairAttempts?: number;
}

/** Picks the next task eligible to run: status pending in both the queue file and live state, not disabled, all dependencies completed. Returns null when nothing is currently eligible (queue finished or blocked). */
export function selectNextEligibleTask(queue: RunQueue, state: QueueState): QueueTask | null {
  const stateById = new Map(state.tasks.map((t) => [t.id, t]));
  for (const task of queue.tasks) {
    if (task.status === "disabled") continue;
    const liveState = stateById.get(task.id);
    if (!liveState || liveState.status !== "pending") continue;
    const depsComplete = task.depends_on.every((dep) => stateById.get(dep)?.status === "completed");
    if (depsComplete) return task;
  }
  return null;
}

/** True only if every non-disabled task has reached a terminal state (completed/failed/skipped). */
function queueIsExhausted(queue: RunQueue, state: QueueState): boolean {
  const stateById = new Map(state.tasks.map((t) => [t.id, t]));
  return queue.tasks
    .filter((t) => t.status !== "disabled")
    .every((t) => ["completed", "failed", "skipped"].includes(stateById.get(t.id)?.status ?? ""));
}

export function determineBranchBase(queue: RunQueue, task: QueueTask, state: QueueState): string {
  if (queue.queue.branch_strategy === "stacked" && task.depends_on.length > 0) {
    const stateById = new Map(state.tasks.map((t) => [t.id, t]));
    // Stacked: base on the last dependency's own branch so its changes are present.
    const lastDep = task.depends_on[task.depends_on.length - 1];
    const depBranch = stateById.get(lastDep)?.branch;
    if (depBranch) return depBranch;
  }
  return `origin/${queue.queue.base_branch}`;
}

/** Pure — exported for testing. True once `elapsedMs` has reached the configured ceiling. */
export function runExceedsWallClockBudget(startedAtMs: number, nowMs: number, maxRunDurationMinutes: number): boolean {
  return nowMs - startedAtMs >= maxRunDurationMinutes * 60 * 1000;
}

function checkPrerequisites(repoRoot: string): StopCondition | null {
  const gitStatus = sh("git status --porcelain", repoRoot, GIT_QUICK_TIMEOUT_MS);
  if (gitStatus.timedOut) {
    return { reason: "`git status` timed out — the working tree or git itself may be in a bad state. Investigate before running the queue." };
  }
  if (gitStatus.output.trim().length > 0) {
    return { reason: "Working tree is not clean. Commit or stash local changes before running the queue." };
  }

  const gh = runCommand("gh", ["--version"], repoRoot, GIT_QUICK_TIMEOUT_MS);
  if (!gh.ok) {
    return { reason: "GitHub CLI (`gh`) is not available or not authenticated. Install/auth `gh` before running the queue." };
  }

  return null;
}

function nowRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "").replace("Z", "Z");
}

function formatSnapshotOneLine(label: string, snapshot: QualitySnapshot): string {
  return `${label}: TypeScript ${snapshot.typescriptErrorCount} error(s), ESLint ${snapshot.eslintErrorCount} error(s)/${snapshot.eslintWarningCount} warning(s), unit tests ${snapshot.unitTestFailureCount} failure(s), Playwright ${snapshot.playwrightFailureCount} failure(s), build ${snapshot.buildSucceeded ? "succeeded" : "FAILED"}.`;
}

function writeRunArtifacts(
  repoRoot: string,
  runId: string,
  startedAt: string,
  finishedAt: string,
  stopReason: string,
  baseline: QualitySnapshot | null,
  attempted: AttemptedTask[]
): void {
  const runDir = join(repoRoot, RUNS_DIR, runId);
  mkdirSync(runDir, { recursive: true });

  for (const { task, log } of attempted) {
    writeFileSync(join(runDir, `task-${task.id}.log`), log, "utf8");
  }

  const summaryLines = [
    `# Run ${runId}`,
    "",
    `Started: ${startedAt}`,
    `Finished: ${finishedAt}`,
    `Stop reason: ${stopReason}`,
    "",
  ];

  if (baseline) {
    summaryLines.push("## Repository baseline (captured before this run's first task)", "", formatSnapshotOneLine("Baseline", baseline), "");
  } else {
    summaryLines.push("## Repository baseline", "", "No baseline captured this run — no task was eligible to run.", "");
  }

  summaryLines.push("## Tasks attempted this run", "");
  for (const { task, state } of attempted) {
    summaryLines.push(`- **${task.id} — ${task.name}**: ${state.status}${state.pr ? ` (PR: ${state.pr})` : ""}${state.blocker ? ` — blocker: ${state.blocker}` : ""}`);
  }
  summaryLines.push("");

  for (const { task, comparison, repairAttempts } of attempted) {
    if (!comparison) continue;
    summaryLines.push(formatQualityComparisonMarkdown(`${task.id} — ${task.name}`, comparison, repairAttempts ?? 0), "");
  }

  writeFileSync(join(runDir, "RUN_SUMMARY.md"), summaryLines.join("\n") + "\n", "utf8");

  const statusJson = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    stop_reason: stopReason,
    baseline,
    tasks: attempted.map(({ task, state, comparison, repairAttempts }) => ({
      id: task.id,
      name: task.name,
      status: state.status,
      branch: state.branch,
      commit: state.commit,
      pr: state.pr,
      blocker: state.blocker,
      quality_gate: comparison
        ? {
            overall_status: comparison.overallStatus,
            new_regressions: comparison.newRegressions,
            fixed_regressions: comparison.fixedRegressions,
            remaining_historical_debt: comparison.remainingHistoricalDebt,
            repair_attempts: repairAttempts ?? 0,
          }
        : null,
    })),
  };
  writeFileSync(join(runDir, "RUN_STATUS.json"), JSON.stringify(statusJson, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const runId = nowRunId();
  const runStartedAtMs = Date.now();
  const startedAt = new Date(runStartedAtMs).toISOString();
  const attempted: AttemptedTask[] = [];
  let state: QueueState | null = null;
  let baseline: QualitySnapshot | null = null;
  let stopReason = "queue exhausted — no eligible tasks remain";

  // Reliability hardening: if anything below throws unexpectedly (a bug, an
  // OOM, a truly unforeseen error), this still writes whatever run artifacts
  // it can from the state captured so far, rather than vanishing with only
  // an uncaught-exception line in a terminal no one is watching overnight.
  try {
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

    const validation = validateQueue(parsed, repoRoot);
    if (!validation.valid) {
      console.error(`Refusing to run: .ai/queue/RUN_QUEUE.yaml failed validation (${validation.errors.length} problem(s)).`);
      for (const issue of validation.errors) console.error(`  [${issue.scope}] ${issue.message}`);
      console.error("Run `npm run ai:queue:validate` for the full report.");
      process.exit(1);
    }
    const queue = parsed as RunQueue;
    const maxRepairAttempts = queue.queue.max_repair_attempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS;
    const maxRunDurationMinutes = queue.queue.max_run_duration_minutes ?? DEFAULT_MAX_RUN_DURATION_MINUTES;

    const prereqStop = checkPrerequisites(repoRoot);
    if (prereqStop) {
      console.error(`Refusing to run: ${prereqStop.reason}`);
      process.exit(1);
    }

    const adapter = ADAPTERS[queue.queue.default_agent];
    const availability = await adapter.checkAvailability();
    if (!availability.available) {
      console.error(`Refusing to run: agent "${queue.queue.default_agent}" is not available.\n${availability.reason}`);
      process.exit(1);
    }

    try {
      state = loadQueueState(repoRoot);
    } catch (error) {
      if (error instanceof QueueFileError) {
        console.error(error.message);
        process.exit(1);
      }
      throw error;
    }

    // Only pay for a baseline capture (a full lint/typecheck/unit/Playwright/
    // build pass) if a task is actually eligible to run this invocation.
    if (selectNextEligibleTask(queue, state)) {
      console.log("Capturing repository quality baseline before this run's first task (Queue v2)...");
      baseline = captureQualitySnapshot(repoRoot);
      const runDir = join(repoRoot, RUNS_DIR, runId);
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(runDir, "baseline.json"), JSON.stringify(baseline, null, 2) + "\n", "utf8");
      console.log(formatSnapshotOneLine("Baseline captured", baseline));
    }

    while (true) {
      if (runExceedsWallClockBudget(runStartedAtMs, Date.now(), maxRunDurationMinutes)) {
        stopReason = `run exceeded its maximum wall-clock budget (${maxRunDurationMinutes} minutes) — stopping for safety; remaining tasks are left pending for the next invocation`;
        break;
      }

      const next = selectNextEligibleTask(queue, state);
      if (!next) {
        stopReason = queueIsExhausted(queue, state)
          ? "queue exhausted — all tasks reached a terminal state"
          : "no eligible task — remaining pending tasks are blocked on incomplete dependencies";
        break;
      }

      const taskOutcome = await attemptTask({
        repoRoot,
        runId,
        queue,
        state,
        task: next,
        baseline: baseline!,
        maxRepairAttempts,
        adapter,
      });
      attempted.push(taskOutcome.attempted);
      saveQueueState(repoRoot, state);
      if (!taskOutcome.ok) {
        stopReason = taskOutcome.stopReason;
        break;
      }
      console.log(`Task ${next.id} completed. PR: ${taskOutcome.attempted.state.pr}`);
    }
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    console.error("run-queue.ts crashed unexpectedly:", message);
    stopReason = `run crashed unexpectedly: ${message.split("\n")[0]}`;
    // If a task was mid-flight when this happened, its stateEntry is
    // already "in_progress" in `state` — attemptTask() catches its own
    // errors internally and returns a normal failed outcome, so reaching
    // this outer catch means the crash happened outside any single task's
    // attempt (e.g. during setup or baseline capture). Nothing further to
    // reconcile in `attempted` here; state/attempted are used as-is below.
  }

  if (state) {
    state.current_task = null;
    state.resume_eligible = computeResumeEligible(state);
    saveQueueState(repoRoot, state);
  }
  const finishedAt = new Date().toISOString();
  writeRunArtifacts(repoRoot, runId, startedAt, finishedAt, stopReason, baseline, attempted);
  console.log(`\nRun ${runId} finished: ${stopReason}`);
  console.log(`Details: .ai/runs/${runId}/RUN_SUMMARY.md`);

  const anyFailed = attempted.some(({ state: s }) => s.status === "failed");
  process.exit(anyFailed ? 1 : 0);
}

interface AttemptTaskParams {
  repoRoot: string;
  runId: string;
  queue: RunQueue;
  state: QueueState;
  task: QueueTask;
  baseline: QualitySnapshot;
  maxRepairAttempts: number;
  adapter: AgentAdapter;
}

interface AttemptTaskOutcome {
  ok: boolean;
  stopReason: string;
  attempted: AttemptedTask;
}

/**
 * Runs one task end to end (branch, invoke agent, quality gate + repair
 * loop, memory-update check, commit/push/PR) and always returns a normal
 * outcome rather than throwing — any exception raised anywhere in this
 * function is caught and turned into a failed-task outcome, so a single
 * task's unexpected crash can never take down run-queue.ts's own artifact
 * writing with it (see main()'s outer try/catch for the remaining, much
 * narrower class of crash this doesn't cover: one during setup, before any
 * task has started).
 */
async function attemptTask(params: AttemptTaskParams): Promise<AttemptTaskOutcome> {
  const { repoRoot, runId, queue, state, task: next, baseline, maxRepairAttempts, adapter } = params;
  const stateEntry = state.tasks.find((t) => t.id === next.id)!;
  stateEntry.status = "in_progress";
  stateEntry.started_at = new Date().toISOString();
  state.current_task = next.id;
  state.last_run_id = runId;
  saveQueueState(repoRoot, state);
  console.log(`--- Task ${next.id}: ${next.name} ---`);

  try {
    const branchBase = determineBranchBase(queue, next, state);
    const fetchBase = sh(`git fetch origin ${queue.queue.base_branch}`, repoRoot, GIT_FETCH_TIMEOUT_MS);
    if (!fetchBase.ok) {
      return fail(next, stateEntry, `git fetch origin ${queue.queue.base_branch} failed:\n${fetchBase.output}`, fetchBase.output, `task ${next.id} failed: could not fetch base branch`);
    }
    const checkout = sh(`git checkout -b ${next.branch} ${branchBase}`, repoRoot, GIT_CHECKOUT_TIMEOUT_MS);
    if (!checkout.ok) {
      return fail(next, stateEntry, `git checkout -b ${next.branch} ${branchBase} failed:\n${checkout.output}`, checkout.output, `task ${next.id} failed: could not create branch`);
    }
    stateEntry.branch = next.branch;

    const promptPath = join(repoRoot, QUEUE_DIR, next.prompt);
    const promptBody = readFileSync(promptPath, "utf8");
    const prompt = [
      promptBody,
      "",
      "---",
      "Standing instructions (do not skip): read AGENTS.md and every file under .ai/ before starting, per this repository's rules. Before finishing, update the relevant .ai/ memory files (at minimum CURRENT_STATUS.md, STATUS.json, and HANDOFF.md) and commit them in this same branch. Never merge, deploy, change secrets, apply a production migration, or activate a production schedule.",
    ].join("\n");

    const taskResult = await adapter.runTask({ prompt, cwd: repoRoot });
    if (!taskResult.success) {
      return fail(next, stateEntry, taskResult.summary, taskResult.log, `task ${next.id} failed: agent invocation did not succeed`);
    }

    // Queue v2: baseline-aware quality gate, with a bounded auto-repair loop
    // for genuinely new regressions only. Pre-existing baseline debt never
    // blocks completion — see scripts/ai/qualityGates.ts.
    let taskLog = taskResult.log;
    let currentSnapshot = captureQualitySnapshot(repoRoot);
    let comparison = compareQualitySnapshots(baseline, currentSnapshot);
    let repairAttempts = 0;
    while (comparison.overallStatus === "fail" && repairAttempts < maxRepairAttempts) {
      repairAttempts++;
      console.log(`Task ${next.id}: new regression(s) found, attempting auto-repair ${repairAttempts}/${maxRepairAttempts}...`);
      const repairPrompt = buildRepairPrompt(comparison, repairAttempts, maxRepairAttempts);
      const repairResult = await adapter.runTask({ prompt: repairPrompt, cwd: repoRoot });
      taskLog += `\n\n--- Auto-repair attempt ${repairAttempts} ---\n${repairResult.log}`;
      if (!repairResult.success) break;
      currentSnapshot = captureQualitySnapshot(repoRoot);
      comparison = compareQualitySnapshots(baseline, currentSnapshot);
    }

    const runDir = join(repoRoot, RUNS_DIR, runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, `task-${next.id}-quality.json`),
      JSON.stringify({ baseline, current: currentSnapshot, comparison, repairAttempts }, null, 2) + "\n",
      "utf8"
    );

    if (comparison.overallStatus === "fail") {
      stateEntry.tests = "failed";
      return fail(
        next,
        stateEntry,
        `quality gate failed after ${repairAttempts} auto-repair attempt(s) — new regression(s): ${comparison.newRegressions.join("; ")}`,
        taskLog,
        `task ${next.id} failed: new regressions could not be repaired within ${maxRepairAttempts} attempt(s)`,
        comparison,
        repairAttempts
      );
    }
    stateEntry.tests = "passed";

    const memoryDiff = sh(
      "git status --porcelain -- .ai/CURRENT_STATUS.md .ai/STATUS.json .ai/HANDOFF.md .ai/ROADMAP.md .ai/ARCHITECTURE.md .ai/DECISIONS.md .ai/OPEN_ITEMS.md",
      repoRoot,
      GIT_QUICK_TIMEOUT_MS
    );
    if (memoryDiff.output.trim().length === 0) {
      return fail(
        next,
        stateEntry,
        "task completed and passed quality gates, but did not update any .ai/ memory file — AGENTS.md requires this before completing work.",
        taskLog,
        `task ${next.id} failed: no project-memory update`,
        comparison,
        repairAttempts
      );
    }

    sh("git add -A", repoRoot, GIT_QUICK_TIMEOUT_MS);
    const commitMessage = `${next.name}\n\nQueue task ${next.id} from .ai/queue/RUN_QUEUE.yaml.\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
    const commit = sh(`git commit -m ${JSON.stringify(commitMessage)}`, repoRoot, GIT_QUICK_TIMEOUT_MS);
    if (!commit.ok) {
      return fail(next, stateEntry, `git commit failed:\n${commit.output}`, taskLog + "\n\n" + commit.output, `task ${next.id} failed: commit failed (nothing to commit, or a git error)`, comparison, repairAttempts);
    }
    const commitSha = sh("git rev-parse HEAD", repoRoot, GIT_QUICK_TIMEOUT_MS).output.trim();
    stateEntry.commit = commitSha;

    const push = sh(`git push -u origin ${next.branch}`, repoRoot, GIT_PUSH_TIMEOUT_MS);
    if (!push.ok) {
      return fail(next, stateEntry, `git push failed:\n${push.output}`, taskLog + "\n\n" + push.output, `task ${next.id} failed: push failed`, comparison, repairAttempts);
    }

    const prBaseBranch = branchBase.startsWith("origin/") ? branchBase.slice("origin/".length) : branchBase;
    const prBody = [
      `Queue task \`${next.id}\` from \`.ai/queue/RUN_QUEUE.yaml\`.`,
      "",
      `Prompt: \`.ai/queue/${next.prompt}\``,
      "",
      "Quality gate (Queue v2, baseline-aware): PASS.",
      comparison.remainingHistoricalDebt.length > 0
        ? `Remaining historical debt (pre-existing, unrelated to this task): ${comparison.remainingHistoricalDebt.join("; ")}`
        : "No historical debt remains.",
      repairAttempts > 0 ? `Auto-repair attempts used: ${repairAttempts}.` : "",
      "",
      "This PR was opened by the unattended overnight queue (`npm run ai:queue`). It has not been merged, deployed, or otherwise activated automatically — see AGENTS.md.",
    ]
      .filter((line) => line !== "")
      .join("\n");
    const prCreate = runCommand("gh", ["pr", "create", "--base", prBaseBranch, "--head", next.branch, "--title", next.name, "--body", prBody], repoRoot, GH_PR_CREATE_TIMEOUT_MS);
    if (!prCreate.ok) {
      return fail(next, stateEntry, `gh pr create failed:\n${prCreate.output}`, taskLog + "\n\n" + prCreate.output, `task ${next.id} failed: PR creation failed (commit and push already succeeded — the branch exists on origin)`, comparison, repairAttempts);
    }

    stateEntry.pr = prCreate.stdout.trim();
    stateEntry.status = "completed";
    stateEntry.completed_at = new Date().toISOString();
    state.current_task = null;
    return { ok: true, stopReason: "", attempted: { task: next, state: stateEntry, log: taskLog, comparison, repairAttempts } };
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    return fail(next, stateEntry, `task crashed unexpectedly: ${message}`, message, `task ${next.id} failed: unexpected crash during execution`);
  }
}

function fail(
  task: QueueTask,
  stateEntry: TaskState,
  blocker: string,
  log: string,
  stopReason: string,
  comparison?: QualityComparisonResult,
  repairAttempts?: number
): AttemptTaskOutcome {
  stateEntry.status = "failed";
  stateEntry.blocker = blocker;
  return { ok: false, stopReason, attempted: { task, state: stateEntry, log, comparison, repairAttempts } };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error("run-queue.ts crashed unexpectedly outside main()'s own recovery path:", error);
    process.exit(1);
  });
}
