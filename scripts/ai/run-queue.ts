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
 *
 * Completion-state reconciliation (2026-08-02, second fix same day) — Task
 * 001's real run (PR #101) exposed a second, more damaging bug: a
 * successful task used to flip its in-memory status to "completed" only
 * AFTER `git commit`/`git push`/`gh pr create` had already run, but
 * `git add -A` (staging QUEUE_STATUS.json alongside the task's real files)
 * happened before that flip — so the commit that became the PR always
 * carried a stale "in_progress" snapshot, and merging that PR permanently
 * baked the lie into main. Fixed two ways: (1) attemptTask() now pushes a
 * second, final commit recording the true completed state onto the same
 * branch/PR before returning — see finalizeCompletionState() below; (2)
 * every invocation of this file now reconciles any stale "in_progress" task
 * against real GitHub state (scripts/ai/reconcile.ts) before selecting a
 * new task, as a defense-in-depth backstop that self-heals even if fix (1)
 * is ever bypassed. A run-lock file (scripts/ai/reconcile.ts's RUN_LOCK_PATH)
 * distinguishes "a queue process is genuinely still running" from "stale
 * and safe to reconcile" — see .ai/DECISIONS.md ADR-0014.
 *
 * Dependency-base resolution (2026-08-02, third fix same day) — Task 001
 * merged as PR #101 and its local branch was (correctly) deleted. Task 002
 * (depends_on: ["001"]) then failed outright trying to branch from Task
 * 001's *recorded branch name* directly: `git checkout -b ai-queue/002-...
 * ai-queue/001-market-radar-foundation` → "fatal:
 * 'ai-queue/001-market-radar-foundation' is not a commit". The old
 * determineBranchBase() unconditionally reused a completed dependency's
 * branch forever, which required merged dependency branches to survive
 * indefinitely — something no normal PR workflow (including this
 * repository's own habit of deleting merged branches) guarantees. Fixed by
 * scripts/ai/reconcile.ts's resolveDependencyBase(): a merged dependency
 * now resolves to the real, GitHub-verified merge target (normally
 * origin/main), with ancestry of the recorded merge commit checked before
 * trusting it; an open (unmerged) dependency still uses its own branch,
 * preferring the remote-tracking ref; and a dependency that's neither
 * verifiably merged nor has a resolvable branch stops the run with an
 * actionable error instead of guessing. This resolution now runs as a
 * cheap preflight step — before the expensive quality-gate baseline is
 * captured — so a resolution failure is caught in seconds, not minutes.
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
  writeRunLock,
  removeRunLock,
  isQueueProcessRunning,
  lookupPrForBranch,
  lookupPrByUrl,
  reconcileQueueState,
  reconcileFailedMemoryChecks,
  resolveDependencyBase,
  resolveGitRef,
  isAncestorRef,
  type BaseResolution,
} from "./reconcile.ts";
import {
  captureQualitySnapshot,
  compareQualitySnapshots,
  buildRepairPrompt,
  formatQualityComparisonMarkdown,
  type QualitySnapshot,
  type QualityComparisonResult,
} from "./qualityGates.ts";
import { validateProjectMemoryUpdate, runMemoryValidationWithRepair, formatMemoryValidationMarkdown, type MemoryValidationResult } from "./projectMemory.ts";

const ADAPTERS: Record<string, AgentAdapter> = {
  claude: claudeAdapter,
};

// Per-command timeout budgets. Generous enough for normal operation, bounded
// enough that a hang can never stall an unattended run indefinitely — see
// subprocess.ts's header comment.
const GIT_FETCH_ALL_TIMEOUT_MS = 5 * 60 * 1000;
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
  /** How the base ref for this task's branch was resolved — see resolveDependencyBase() in reconcile.ts. Recorded in task logs, RUN_SUMMARY.md, and RUN_STATUS.json (requirement: never leave this implicit). */
  baseResolution?: BaseResolution;
  /** Project Memory validation result — see scripts/ai/projectMemory.ts and .ai/DECISIONS.md ADR-0017. */
  memoryValidation?: MemoryValidationResult;
  memoryRepairAttempts?: number;
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
  for (const { task, state, baseResolution } of attempted) {
    summaryLines.push(`- **${task.id} — ${task.name}**: ${state.status}${state.pr ? ` (PR: ${state.pr})` : ""}${state.blocker ? ` — blocker: ${state.blocker}` : ""}`);
    if (baseResolution) {
      summaryLines.push(baseResolution.ok ? `  - Base: \`${baseResolution.ref}\` — ${baseResolution.reason}` : `  - Base resolution failed: ${baseResolution.error}`);
    }
  }
  summaryLines.push("");

  for (const { task, comparison, repairAttempts } of attempted) {
    if (!comparison) continue;
    summaryLines.push(formatQualityComparisonMarkdown(`${task.id} — ${task.name}`, comparison, repairAttempts ?? 0), "");
  }

  for (const { task, memoryValidation, memoryRepairAttempts } of attempted) {
    if (!memoryValidation) continue;
    summaryLines.push(formatMemoryValidationMarkdown(`${task.id} — ${task.name}`, memoryValidation, memoryRepairAttempts ?? 0), "");
  }

  writeFileSync(join(runDir, "RUN_SUMMARY.md"), summaryLines.join("\n") + "\n", "utf8");

  const statusJson = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    stop_reason: stopReason,
    baseline,
    tasks: attempted.map(({ task, state, comparison, repairAttempts, baseResolution, memoryValidation, memoryRepairAttempts }) => ({
      id: task.id,
      name: task.name,
      status: state.status,
      branch: state.branch,
      commit: state.commit,
      pr: state.pr,
      blocker: state.blocker,
      base_resolution: baseResolution ? { ok: baseResolution.ok, ref: baseResolution.ref, reason: baseResolution.reason, error: baseResolution.error } : null,
      quality_gate: comparison
        ? {
            overall_status: comparison.overallStatus,
            new_regressions: comparison.newRegressions,
            fixed_regressions: comparison.fixedRegressions,
            remaining_historical_debt: comparison.remainingHistoricalDebt,
            repair_attempts: repairAttempts ?? 0,
          }
        : null,
      memory_validation: memoryValidation
        ? {
            passed: memoryValidation.passed,
            changed_files: memoryValidation.changedFiles,
            reasons: memoryValidation.reasons,
            repair_attempts: memoryRepairAttempts ?? 0,
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

    // Reconcile any stale "in_progress" task against real GitHub state
    // before selecting anything new — the defense-in-depth half of the
    // 2026-08-02 completion-state fix (see this file's header comment and
    // .ai/DECISIONS.md ADR-0014). isQueueProcessRunning() checks BEFORE this
    // invocation's own lock is written, so a task left in_progress by a
    // still-running sibling process is correctly left alone, not reconciled
    // out from under it.
    const alreadyRunning = isQueueProcessRunning(repoRoot);
    const reconciliation = reconcileQueueState(queue, state, lookupPrForBranch(repoRoot), alreadyRunning);
    state = reconciliation.state;

    // Second pass: any task "failed" specifically by the known Project
    // Memory false-failure pattern (ADR-0017), with a real PR that
    // independently re-validates as containing a genuinely valid memory
    // update, is reconciled to completed here too — so a human doesn't
    // have to remember to run `npm run ai:queue:reconcile` by hand before
    // resuming a run that hit this exact failure mode.
    const memoryReconciliation = reconcileFailedMemoryChecks(repoRoot, queue, state, lookupPrForBranch(repoRoot), validateProjectMemoryUpdate, resolveGitRef(repoRoot));
    state = memoryReconciliation.state;

    const allStartupChanges = [...reconciliation.changes, ...memoryReconciliation.changes];
    if (allStartupChanges.length > 0) {
      console.log(`Reconciled ${allStartupChanges.length} stale task state(s) before starting:`);
      for (const change of allStartupChanges) {
        console.log(`  ${change.taskId}: ${change.before} -> ${change.after} (${change.reason})`);
      }
      saveQueueState(repoRoot, state);
    }

    // Claim this run with a lock file so a concurrent or later invocation's
    // reconciliation pass can tell "genuinely still running" apart from
    // "stale" — removed unconditionally on the way out via the process
    // "exit" event, which fires even from an early process.exit() call.
    writeRunLock(repoRoot, { pid: process.pid, startedAt, runId });
    process.once("exit", () => removeRunLock(repoRoot));

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

      // Dependency-base preflight (2026-08-02 fix): resolve and verify the
      // branch this task should build from BEFORE paying for an expensive
      // quality-gate baseline capture or invoking the agent — a resolution
      // failure (e.g. a merged dependency's branch was cleaned up and the
      // merge can't be verified) should surface in seconds, not minutes.
      // See resolveDependencyBase() in scripts/ai/reconcile.ts.
      console.log(`--- Task ${next.id}: resolving dependency base ---`);
      const fetchAll = sh("git fetch origin --prune", repoRoot, GIT_FETCH_ALL_TIMEOUT_MS);
      if (!fetchAll.ok) {
        const outcome = failPreflight(next, state, `git fetch origin --prune failed:\n${fetchAll.output}`, `task ${next.id} failed: could not fetch remote refs before resolving its base`);
        attempted.push(outcome.attempted);
        saveQueueState(repoRoot, state);
        stopReason = outcome.stopReason;
        break;
      }
      const baseResolution = resolveDependencyBase(queue, next, state, lookupPrByUrl(repoRoot), resolveGitRef(repoRoot), isAncestorRef(repoRoot));
      if (!baseResolution.ok) {
        const outcome = failPreflight(next, state, baseResolution.error ?? "dependency base could not be resolved", `task ${next.id} failed: dependency base resolution failed`, baseResolution);
        attempted.push(outcome.attempted);
        saveQueueState(repoRoot, state);
        stopReason = outcome.stopReason;
        break;
      }
      console.log(`Task ${next.id}: base resolved to ${baseResolution.ref} — ${baseResolution.reason}`);

      // Only pay for a baseline capture (a full lint/typecheck/unit/
      // Playwright/build pass) once we know at least one task is actually
      // resolvable and about to run — captured once per run, reused by
      // every task attempted in it.
      if (baseline === null) {
        console.log("Capturing repository quality baseline before this run's first task (Queue v2)...");
        baseline = captureQualitySnapshot(repoRoot);
        const runDir = join(repoRoot, RUNS_DIR, runId);
        mkdirSync(runDir, { recursive: true });
        writeFileSync(join(runDir, "baseline.json"), JSON.stringify(baseline, null, 2) + "\n", "utf8");
        console.log(formatSnapshotOneLine("Baseline captured", baseline));
      }

      const taskOutcome = await attemptTask({
        repoRoot,
        runId,
        state,
        task: next,
        baseline,
        maxRepairAttempts,
        adapter,
        baseResolution,
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
  state: QueueState;
  task: QueueTask;
  baseline: QualitySnapshot;
  maxRepairAttempts: number;
  adapter: AgentAdapter;
  /** Already resolved and verified by the preflight step in main() — see resolveDependencyBase() in reconcile.ts. */
  baseResolution: BaseResolution;
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
  const { repoRoot, runId, state, task: next, baseline, maxRepairAttempts, adapter, baseResolution } = params;
  const stateEntry = state.tasks.find((t) => t.id === next.id)!;
  stateEntry.status = "in_progress";
  stateEntry.started_at = new Date().toISOString();
  state.current_task = next.id;
  state.last_run_id = runId;
  saveQueueState(repoRoot, state);
  console.log(`--- Task ${next.id}: ${next.name} ---`);

  // Recorded in the task's own log (requirement: never leave base
  // resolution implicit) — remote refs were already fetched, and the base
  // already resolved and verified, by main()'s preflight step before this
  // function was even called.
  let taskLog = `Base resolution: ${baseResolution.ref}\nReason: ${baseResolution.reason}\n\n`;

  try {
    const branchBase = baseResolution.ref!;
    const checkout = sh(`git checkout -b ${next.branch} ${branchBase}`, repoRoot, GIT_CHECKOUT_TIMEOUT_MS);
    if (!checkout.ok) {
      return fail(next, stateEntry, `git checkout -b ${next.branch} ${branchBase} failed:\n${checkout.output}`, taskLog + checkout.output, `task ${next.id} failed: could not create branch`, undefined, undefined, baseResolution);
    }
    stateEntry.branch = next.branch;

    const promptPath = join(repoRoot, QUEUE_DIR, next.prompt);
    const promptBody = readFileSync(promptPath, "utf8");
    const prompt = [
      promptBody,
      "",
      "---",
      "Standing instructions (do not skip; see .ai/DECISIONS.md ADR-0017 for why every line below is load-bearing, not boilerplate):",
      "- Read AGENTS.md and every file under .ai/ before starting, per this repository's rules.",
      "- Before finishing, update the relevant .ai/ memory files — at minimum CURRENT_STATUS.md, STATUS.json, and HANDOFF.md (required every task), plus ROADMAP.md/ARCHITECTURE.md/DECISIONS.md/OPEN_ITEMS.md wherever actually applicable — with a truthful account of what you built, what you tested, and the real results. Never fabricate completion, invent test results, or write generic/boilerplate text in place of a real update.",
      "- .ai/STATUS.json must remain valid JSON. Leave no unresolved Git conflict markers in any file you touch.",
      "- HANDOFF.md is a snapshot, not a log — overwrite it wholesale with this task's own branch/status/tests/PR/blockers/recommended-next-step, per its own header instructions.",
      "- Commit your changes in this same branch (you may commit, push, and open the PR yourself — the queue's own post-task steps are idempotent and will not duplicate or fight your work either way).",
      "- Never edit .ai/queue/QUEUE_STATUS.json's status/commit/pr/completed_at fields yourself — queue state is recorded only through this orchestrator's own supported completion path, never by hand.",
      "- Never merge, deploy, change secrets, apply a production migration, or activate a production schedule.",
    ].join("\n");

    const taskResult = await adapter.runTask({ prompt, cwd: repoRoot });
    if (!taskResult.success) {
      return fail(next, stateEntry, taskResult.summary, taskLog + taskResult.log, `task ${next.id} failed: agent invocation did not succeed`, undefined, undefined, baseResolution);
    }

    // Queue v2: baseline-aware quality gate, with a bounded auto-repair loop
    // for genuinely new regressions only. Pre-existing baseline debt never
    // blocks completion — see scripts/ai/qualityGates.ts.
    taskLog += taskResult.log;
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
        repairAttempts,
        baseResolution
      );
    }
    stateEntry.tests = "passed";
    const testsSummary = formatSnapshotOneLine("Result", currentSnapshot);

    // Project Memory validation (ADR-0017): detects a real update whether
    // the agent left it uncommitted (for the commit step below to pick up)
    // or already committed it itself — the exact case that produced Task
    // 003's false "no project-memory update" failure. Bounded repair loop,
    // reusing the same maxRepairAttempts budget as the quality-gate loop
    // above (Part 3's "aligned with the existing repair architecture").
    const memoryOutcome = await runMemoryValidationWithRepair({
      repoRoot,
      baseRef: branchBase,
      taskId: next.id,
      taskName: next.name,
      branch: next.branch,
      testsSummary,
      maxAttempts: maxRepairAttempts,
      validateMemory: validateProjectMemoryUpdate,
      runRepairAgent: async (repairPrompt: string) => {
        const result = await adapter.runTask({ prompt: repairPrompt, cwd: repoRoot });
        return { success: result.success, log: result.log };
      },
    });
    taskLog += memoryOutcome.log;
    const memoryValidation = memoryOutcome.finalResult;
    const memoryRepairAttempts = memoryOutcome.attempts;

    if (!memoryValidation.passed) {
      return fail(
        next,
        stateEntry,
        `task completed and passed quality gates, but its Project Memory update is invalid after ${memoryRepairAttempts} repair attempt(s): ${memoryValidation.reasons.join("; ")}`,
        taskLog,
        `task ${next.id} failed: no valid project-memory update`,
        comparison,
        repairAttempts,
        baseResolution,
        memoryValidation,
        memoryRepairAttempts
      );
    }

    // Idempotent from here on: the agent may have already committed (and
    // even pushed and opened its own PR) as part of following its own
    // prompt's standing instructions — exactly what happened for Task 003.
    // Every step below checks real state first rather than assuming a
    // fixed "nothing has happened yet" starting point.
    const preCommitStatus = sh("git status --porcelain", repoRoot, GIT_QUICK_TIMEOUT_MS);
    if (preCommitStatus.output.trim().length > 0) {
      sh("git add -A", repoRoot, GIT_QUICK_TIMEOUT_MS);
      const commitMessage = `${next.name}\n\nQueue task ${next.id} from .ai/queue/RUN_QUEUE.yaml.\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
      const commit = runCommand("git", ["commit", "-m", commitMessage], repoRoot, GIT_QUICK_TIMEOUT_MS);
      if (!commit.ok) {
        return fail(
          next,
          stateEntry,
          `git commit failed:\n${commit.output}`,
          taskLog + "\n\n" + commit.output,
          `task ${next.id} failed: commit failed`,
          comparison,
          repairAttempts,
          baseResolution,
          memoryValidation,
          memoryRepairAttempts
        );
      }
    }
    const commitSha = sh("git rev-parse HEAD", repoRoot, GIT_QUICK_TIMEOUT_MS).output.trim();
    stateEntry.commit = commitSha;

    const push = sh(`git push -u origin ${next.branch}`, repoRoot, GIT_PUSH_TIMEOUT_MS);
    if (!push.ok) {
      return fail(
        next,
        stateEntry,
        `git push failed:\n${push.output}`,
        taskLog + "\n\n" + push.output,
        `task ${next.id} failed: push failed`,
        comparison,
        repairAttempts,
        baseResolution,
        memoryValidation,
        memoryRepairAttempts
      );
    }

    const prBaseBranch = branchBase.startsWith("origin/") ? branchBase.slice("origin/".length) : branchBase;
    // Check for a PR the agent may have already opened itself before
    // creating a new one — gh pr create errors on a duplicate, which would
    // otherwise fail an already-successful task a second, different way.
    const existingPr = lookupPrForBranch(repoRoot)(next.branch);
    let prUrl: string;
    if (existingPr && existingPr.state !== "CLOSED") {
      prUrl = existingPr.url;
      taskLog += `\n\nReused existing PR #${existingPr.number} (${existingPr.state}) already open for ${next.branch} — not creating a duplicate.`;
    } else {
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
        "Project Memory: verified.",
        memoryRepairAttempts > 0 ? `Memory repair attempts used: ${memoryRepairAttempts}.` : "",
        "",
        "This PR was opened by the unattended overnight queue (`npm run ai:queue`). It has not been merged, deployed, or otherwise activated automatically — see AGENTS.md.",
      ]
        .filter((line) => line !== "")
        .join("\n");
      const prCreate = runCommand("gh", ["pr", "create", "--base", prBaseBranch, "--head", next.branch, "--title", next.name, "--body", prBody], repoRoot, GH_PR_CREATE_TIMEOUT_MS);
      if (!prCreate.ok) {
        return fail(
          next,
          stateEntry,
          `gh pr create failed:\n${prCreate.output}`,
          taskLog + "\n\n" + prCreate.output,
          `task ${next.id} failed: PR creation failed (commit and push already succeeded — the branch exists on origin)`,
          comparison,
          repairAttempts,
          baseResolution,
          memoryValidation,
          memoryRepairAttempts
        );
      }
      prUrl = prCreate.stdout.trim();
    }

    stateEntry.pr = prUrl;
    stateEntry.status = "completed";
    stateEntry.completed_at = new Date().toISOString();
    stateEntry.tests = "passed";
    stateEntry.memory_validation = {
      passed: memoryValidation.passed,
      changed_files: memoryValidation.changedFiles,
      reasons: memoryValidation.reasons,
      repair_attempts: memoryRepairAttempts,
    };
    state.current_task = null;

    // Completion-state fix (see this file's header comment): the commit
    // that became the PR above still carries QUEUE_STATUS.json in its
    // "in_progress" shape, because git add -A ran before this status flip.
    // Push one final, small commit that records the true completed state
    // onto this same branch — the PR's own diff, and therefore what gets
    // merged, must never lie about whether this task actually finished.
    const finalize = finalizeCompletionState(repoRoot, state, next.branch);
    if (!finalize.ok) {
      // The PR is real and the work is real — do not discard either. Log
      // the discrepancy loudly rather than silently pretending the branch
      // is fully consistent; scripts/ai/reconcile.ts's automatic startup
      // check will correct QUEUE_STATUS.json from verified GitHub state on
      // the next queue invocation even if this immediate fix-up failed.
      taskLog += `\n\n--- Recording completed state back onto ${next.branch} failed (non-fatal — reconciliation will catch this on the next run) ---\n${finalize.output}`;
      console.error(`Task ${next.id}: warning — could not push the completed-state commit to ${next.branch}: ${finalize.output.slice(0, 500)}`);
    } else if (finalize.commitSha) {
      stateEntry.commit = finalize.commitSha;
    }

    return {
      ok: true,
      stopReason: "",
      attempted: { task: next, state: stateEntry, log: taskLog, comparison, repairAttempts, baseResolution, memoryValidation, memoryRepairAttempts },
    };
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    return fail(next, stateEntry, `task crashed unexpectedly: ${message}`, taskLog + message, `task ${next.id} failed: unexpected crash during execution`, undefined, undefined, baseResolution);
  }
}

function fail(
  task: QueueTask,
  stateEntry: TaskState,
  blocker: string,
  log: string,
  stopReason: string,
  comparison?: QualityComparisonResult,
  repairAttempts?: number,
  baseResolution?: BaseResolution,
  memoryValidation?: MemoryValidationResult,
  memoryRepairAttempts?: number
): AttemptTaskOutcome {
  stateEntry.status = "failed";
  stateEntry.blocker = blocker;
  if (memoryValidation) {
    stateEntry.memory_validation = {
      passed: memoryValidation.passed,
      changed_files: memoryValidation.changedFiles,
      reasons: memoryValidation.reasons,
      repair_attempts: memoryRepairAttempts ?? 0,
    };
  }
  return { ok: false, stopReason, attempted: { task, state: stateEntry, log, comparison, repairAttempts, baseResolution, memoryValidation, memoryRepairAttempts } };
}

/**
 * A cheap, pre-baseline failure path for when dependency-base resolution
 * itself fails (fetch, or resolveDependencyBase()) — before any quality
 * gate or agent invocation has run. Marks the task in_progress -> failed
 * directly, matching attemptTask()'s own start-of-attempt bookkeeping, so
 * this failure looks the same in QUEUE_STATUS.json/RUN_SUMMARY.md as any
 * other task failure, just without the wasted expensive work first.
 */
function failPreflight(task: QueueTask, state: QueueState, blocker: string, stopReason: string, baseResolution?: BaseResolution): AttemptTaskOutcome {
  const stateEntry = state.tasks.find((t) => t.id === task.id)!;
  stateEntry.status = "in_progress";
  stateEntry.started_at = new Date().toISOString();
  state.current_task = task.id;
  const outcome = fail(task, stateEntry, blocker, blocker, stopReason, undefined, undefined, baseResolution);
  state.current_task = null;
  return outcome;
}

interface FinalizeResult {
  ok: boolean;
  commitSha: string | null;
  output: string;
}

/**
 * Writes the current (already-updated-to-completed) `state` to
 * QUEUE_STATUS.json and pushes it as one small, final commit on the task's
 * own branch — see the completion-state fix in this file's header comment
 * for why this exists and what it fixes. Exported for direct testing of the
 * ordering (saveQueueState must happen before `git add`, which must happen
 * before `git commit`) without needing a real git repo.
 */
export function finalizeCompletionState(repoRoot: string, state: QueueState, branch: string): FinalizeResult {
  saveQueueState(repoRoot, state);
  const add = sh("git add .ai/queue/QUEUE_STATUS.json", repoRoot, GIT_QUICK_TIMEOUT_MS);
  if (!add.ok) return { ok: false, commitSha: null, output: `git add failed:\n${add.output}` };

  // runCommand (real argv, no shell) — not sh() — because this message has
  // embedded newlines: sh() runs the whole line through /bin/sh, where a
  // \n inside a JSON.stringify'd double-quoted string is NOT interpreted
  // as a real newline (that's bash's $'...' quoting, not plain "..."), so
  // the commit subject used to literally contain the two characters `\n`
  // instead of a line break. Discovered live during Task 003's recovery —
  // this exact line had never actually executed successfully before then.
  const commitMessage = `Record queue completion state\n\nUpdates .ai/queue/QUEUE_STATUS.json to reflect this branch's task as completed — see scripts/ai/run-queue.ts's completion-state fix.\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
  const commit = runCommand("git", ["commit", "-m", commitMessage], repoRoot, GIT_QUICK_TIMEOUT_MS);
  if (!commit.ok) {
    // "nothing to commit" is a real, if unlikely, possibility (e.g. this
    // exact state was already pushed by a prior attempt) — not itself an
    // error worth failing loudly over, since the branch is already correct
    // in that case. Any other commit failure is reported as a real problem.
    if (/nothing to commit/i.test(commit.output)) {
      return { ok: true, commitSha: null, output: commit.output };
    }
    return { ok: false, commitSha: null, output: `git commit failed:\n${commit.output}` };
  }

  const push = sh(`git push origin ${branch}`, repoRoot, GIT_PUSH_TIMEOUT_MS);
  if (!push.ok) return { ok: false, commitSha: null, output: `git push failed:\n${push.output}` };

  const sha = sh("git rev-parse HEAD", repoRoot, GIT_QUICK_TIMEOUT_MS).output.trim();
  return { ok: true, commitSha: sha || null, output: "" };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error("run-queue.ts crashed unexpectedly outside main()'s own recovery path:", error);
    process.exit(1);
  });
}
