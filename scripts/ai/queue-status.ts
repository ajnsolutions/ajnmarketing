#!/usr/bin/env node
/**
 * Prints a clear status report for .ai/queue/RUN_QUEUE.yaml +
 * .ai/queue/QUEUE_STATUS.json. Run: `npm run ai:queue:status`.
 */
import { pathToFileURL } from "node:url";
import { loadRunQueue, loadQueueState, computeResumeEligible, QueueFileError } from "./queueIO.ts";
import type { QueueState, RunQueue } from "./queueTypes.ts";

export function formatQueueStatusReport(queue: RunQueue, state: QueueState): string {
  const lines: string[] = [];
  lines.push(`Queue: ${state.queue_name}`);
  lines.push(`Current task: ${state.current_task ?? "(none)"}`);
  lines.push(`Last run: ${state.last_run_id ?? "(never run)"}`);
  lines.push("");

  const byStatus = (status: string) => state.tasks.filter((t) => t.status === status);
  const completed = byStatus("completed");
  const pending = byStatus("pending");
  const failed = byStatus("failed");
  const disabled = byStatus("disabled");
  const inProgress = byStatus("in_progress");

  lines.push(`Completed (${completed.length}): ${completed.map((t) => t.id).join(", ") || "(none)"}`);
  lines.push(`Pending (${pending.length}): ${pending.map((t) => t.id).join(", ") || "(none)"}`);
  lines.push(`In progress (${inProgress.length}): ${inProgress.map((t) => t.id).join(", ") || "(none)"}`);
  lines.push(`Failed (${failed.length}): ${failed.map((t) => t.id).join(", ") || "(none)"}`);
  lines.push(`Disabled/example (${disabled.length}): ${disabled.map((t) => t.id).join(", ") || "(none)"}`);
  lines.push("");

  lines.push("Detail:");
  for (const task of queue.tasks) {
    const s = state.tasks.find((t) => t.id === task.id);
    if (!s) continue;
    lines.push(`  [${s.status}] ${task.id} — ${task.name}`);
    if (s.branch) lines.push(`      branch: ${s.branch}`);
    if (s.commit) lines.push(`      commit: ${s.commit}`);
    if (s.pr) lines.push(`      PR: ${s.pr}`);
    if (s.tests) lines.push(`      tests: ${s.tests}`);
    if (s.blocker) lines.push(`      blocker: ${s.blocker}`);
  }

  lines.push("");
  const resumeEligible = computeResumeEligible(state);
  lines.push(`Resume eligible: ${resumeEligible ? "yes — npm run ai:queue will continue from here" : "no"}`);
  if (!resumeEligible && inProgress.length > 0) {
    lines.push(`  Reason: task(s) ${inProgress.map((t) => t.id).join(", ")} are stuck "in_progress" — a previous run likely crashed mid-task. Inspect before re-running.`);
  }

  return lines.join("\n");
}

function main(): void {
  const repoRoot = process.cwd();
  try {
    const queue = loadRunQueue(repoRoot) as RunQueue;
    const state = loadQueueState(repoRoot);
    console.log(formatQueueStatusReport(queue, state));
  } catch (error) {
    if (error instanceof QueueFileError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
