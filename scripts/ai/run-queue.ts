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
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { validateQueue } from "./validate-queue.ts";
import { loadRunQueue, loadQueueState, saveQueueState, computeResumeEligible, QUEUE_DIR, RUNS_DIR, QueueFileError } from "./queueIO.ts";
import type { QueueState, QueueTask, RunQueue, TaskState } from "./queueTypes.ts";
import { claudeAdapter } from "./adapters/claude.ts";
import type { AgentAdapter } from "./adapters/types.ts";

const ADAPTERS: Record<string, AgentAdapter> = {
  claude: claudeAdapter,
};

const QUALITY_GATE_COMMANDS = ["npm run lint", "npm run typecheck", "npm run test:unit"];

interface StopCondition {
  reason: string;
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

function runCommand(command: string, args: string[], opts: { cwd: string }): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { cwd: opts.cwd, encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: result.status === 0, output };
}

function sh(command: string, cwd: string): { ok: boolean; output: string } {
  const result = spawnSync(command, { cwd, encoding: "utf8", shell: true });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: result.status === 0, output };
}

function checkPrerequisites(repoRoot: string): StopCondition | null {
  const gitStatus = sh("git status --porcelain", repoRoot);
  if (gitStatus.output.trim().length > 0) {
    return { reason: "Working tree is not clean. Commit or stash local changes before running the queue." };
  }

  const gh = runCommand("gh", ["--version"], { cwd: repoRoot });
  if (!gh.ok) {
    return { reason: "GitHub CLI (`gh`) is not available or not authenticated. Install/auth `gh` before running the queue." };
  }

  return null;
}

function nowRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "").replace("Z", "Z");
}

function writeRunArtifacts(
  repoRoot: string,
  runId: string,
  startedAt: string,
  finishedAt: string,
  stopReason: string,
  attempted: { task: QueueTask; state: TaskState; log: string }[]
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
    "## Tasks attempted this run",
    "",
  ];
  for (const { task, state } of attempted) {
    summaryLines.push(`- **${task.id} — ${task.name}**: ${state.status}${state.pr ? ` (PR: ${state.pr})` : ""}${state.blocker ? ` — blocker: ${state.blocker}` : ""}`);
  }
  writeFileSync(join(runDir, "RUN_SUMMARY.md"), summaryLines.join("\n") + "\n", "utf8");

  const statusJson = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    stop_reason: stopReason,
    tasks: attempted.map(({ task, state }) => ({ id: task.id, name: task.name, status: state.status, branch: state.branch, commit: state.commit, pr: state.pr, blocker: state.blocker })),
  };
  writeFileSync(join(runDir, "RUN_STATUS.json"), JSON.stringify(statusJson, null, 2) + "\n", "utf8");
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const runId = nowRunId();
  const startedAt = new Date().toISOString();
  const attempted: { task: QueueTask; state: TaskState; log: string }[] = [];

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

  let state: QueueState;
  try {
    state = loadQueueState(repoRoot);
  } catch (error) {
    if (error instanceof QueueFileError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  let stopReason = "queue exhausted — no eligible tasks remain";

  while (true) {
    const next = selectNextEligibleTask(queue, state);
    if (!next) {
      stopReason = queueIsExhausted(queue, state)
        ? "queue exhausted — all tasks reached a terminal state"
        : "no eligible task — remaining pending tasks are blocked on incomplete dependencies";
      break;
    }

    const stateEntry = state.tasks.find((t) => t.id === next.id)!;
    stateEntry.status = "in_progress";
    stateEntry.started_at = new Date().toISOString();
    state.current_task = next.id;
    state.last_run_id = runId;
    saveQueueState(repoRoot, state);
    console.log(`--- Task ${next.id}: ${next.name} ---`);

    const branchBase = determineBranchBase(queue, next, state);
    const fetchBase = sh(`git fetch origin ${queue.queue.base_branch}`, repoRoot);
    if (!fetchBase.ok) {
      stateEntry.status = "failed";
      stateEntry.blocker = `git fetch origin ${queue.queue.base_branch} failed:\n${fetchBase.output}`;
      attempted.push({ task: next, state: stateEntry, log: fetchBase.output });
      stopReason = `task ${next.id} failed: could not fetch base branch`;
      break;
    }
    const checkout = sh(`git checkout -b ${next.branch} ${branchBase}`, repoRoot);
    if (!checkout.ok) {
      stateEntry.status = "failed";
      stateEntry.blocker = `git checkout -b ${next.branch} ${branchBase} failed:\n${checkout.output}`;
      attempted.push({ task: next, state: stateEntry, log: checkout.output });
      stopReason = `task ${next.id} failed: could not create branch`;
      break;
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
      stateEntry.status = "failed";
      stateEntry.blocker = taskResult.summary;
      attempted.push({ task: next, state: stateEntry, log: taskResult.log });
      stopReason = `task ${next.id} failed: agent invocation did not succeed`;
      break;
    }

    let gateFailed = false;
    let gateLog = "";
    for (const gate of QUALITY_GATE_COMMANDS) {
      const gateResult = sh(gate, repoRoot);
      gateLog += `$ ${gate}\n${gateResult.output}\n\n`;
      if (!gateResult.ok) {
        gateFailed = true;
        break;
      }
    }
    if (gateFailed) {
      stateEntry.status = "failed";
      stateEntry.blocker = "a quality gate failed — see task log";
      stateEntry.tests = "failed";
      attempted.push({ task: next, state: stateEntry, log: taskResult.log + "\n\n" + gateLog });
      stopReason = `task ${next.id} failed: quality gate did not pass`;
      break;
    }
    stateEntry.tests = "passed";

    const memoryDiff = sh("git status --porcelain -- .ai/CURRENT_STATUS.md .ai/STATUS.json .ai/HANDOFF.md .ai/ROADMAP.md .ai/ARCHITECTURE.md .ai/DECISIONS.md .ai/OPEN_ITEMS.md", repoRoot);
    if (memoryDiff.output.trim().length === 0) {
      stateEntry.status = "failed";
      stateEntry.blocker = "task completed and passed quality gates, but did not update any .ai/ memory file — AGENTS.md requires this before completing work.";
      attempted.push({ task: next, state: stateEntry, log: taskResult.log + "\n\n" + gateLog });
      stopReason = `task ${next.id} failed: no project-memory update`;
      break;
    }

    sh("git add -A", repoRoot);
    const commitMessage = `${next.name}\n\nQueue task ${next.id} from .ai/queue/RUN_QUEUE.yaml.\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
    const commit = sh(`git commit -m ${JSON.stringify(commitMessage)}`, repoRoot);
    if (!commit.ok) {
      stateEntry.status = "failed";
      stateEntry.blocker = `git commit failed:\n${commit.output}`;
      attempted.push({ task: next, state: stateEntry, log: taskResult.log + "\n\n" + gateLog + "\n\n" + commit.output });
      stopReason = `task ${next.id} failed: commit failed (nothing to commit, or a git error)`;
      break;
    }
    const commitSha = sh("git rev-parse HEAD", repoRoot).output.trim();
    stateEntry.commit = commitSha;

    const push = sh(`git push -u origin ${next.branch}`, repoRoot);
    if (!push.ok) {
      stateEntry.status = "failed";
      stateEntry.blocker = `git push failed:\n${push.output}`;
      attempted.push({ task: next, state: stateEntry, log: taskResult.log + "\n\n" + gateLog + "\n\n" + push.output });
      stopReason = `task ${next.id} failed: push failed`;
      break;
    }

    const prBaseBranch = branchBase.startsWith("origin/") ? branchBase.slice("origin/".length) : branchBase;
    const prBody = `Queue task \`${next.id}\` from \`.ai/queue/RUN_QUEUE.yaml\`.\n\nPrompt: \`.ai/queue/${next.prompt}\`\n\nQuality gates run: ${QUALITY_GATE_COMMANDS.join(", ")} — all passed.\n\nThis PR was opened by the unattended overnight queue (\`npm run ai:queue\`). It has not been merged, deployed, or otherwise activated automatically — see AGENTS.md.`;
    const prResult = execFileSync(
      "gh",
      ["pr", "create", "--base", prBaseBranch, "--head", next.branch, "--title", next.name, "--body", prBody],
      { cwd: repoRoot, encoding: "utf8" }
    ).trim();
    stateEntry.pr = prResult;
    stateEntry.status = "completed";
    stateEntry.completed_at = new Date().toISOString();
    state.current_task = null;
    saveQueueState(repoRoot, state);
    attempted.push({ task: next, state: stateEntry, log: taskResult.log + "\n\n" + gateLog });

    console.log(`Task ${next.id} completed. PR: ${prResult}`);
  }

  state.current_task = null;
  state.resume_eligible = computeResumeEligible(state);
  saveQueueState(repoRoot, state);
  const finishedAt = new Date().toISOString();
  writeRunArtifacts(repoRoot, runId, startedAt, finishedAt, stopReason, attempted);
  console.log(`\nRun ${runId} finished: ${stopReason}`);
  console.log(`Details: .ai/runs/${runId}/RUN_SUMMARY.md`);

  const anyFailed = attempted.some(({ state: s }) => s.status === "failed");
  process.exit(anyFailed ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error("run-queue.ts crashed unexpectedly:", error);
    process.exit(1);
  });
}
