#!/usr/bin/env node
/**
 * Prints a clear status report for .ai/queue/RUN_QUEUE.yaml +
 * .ai/queue/QUEUE_STATUS.json. Run: `npm run ai:queue:status`.
 *
 * For any task stuck "in_progress", this distinguishes three genuinely
 * different situations (2026-08-02 fix — see .ai/DECISIONS.md ADR-0014):
 * an actively running queue process still owns it; it's stale with no
 * evidence of ever finishing (a real crash); or it's stale but GitHub shows
 * its PR actually merged (a bookkeeping lag, not a failure) — reporting all
 * three as plain "in_progress" was exactly what let a genuinely-completed
 * task look indistinguishable from a crashed one.
 */
import { pathToFileURL } from "node:url";
import { loadRunQueue, loadQueueState, computeResumeEligible, QueueFileError } from "./queueIO.ts";
import { classifyTaskState, isQueueProcessRunning, lookupPrForBranch, type TaskClassification } from "./reconcile.ts";
import type { QueueState, RunQueue } from "./queueTypes.ts";

function describeClassification(c: TaskClassification): string {
  switch (c.classification) {
    case "running":
      return "RUNNING — an active queue process currently owns this task";
    case "stale_pr_merged":
      return `STALE, but PR #${c.pr!.number} is MERGED — this task actually succeeded; run \`npm run ai:queue:reconcile\` or \`npm run ai:queue\` to correct the recorded state`;
    case "stale_pr_open":
      return `STALE — PR #${c.pr!.number} exists but is still open; not verifiably complete, left as-is rather than guessed`;
    case "stale_pr_closed":
      return `STALE — PR #${c.pr!.number} was closed without merging; this task did not complete`;
    case "stale_no_evidence":
      return "STALE — no PR found for this task's branch; likely crashed before ever pushing";
    case "not_applicable":
      return "";
  }
}

export function formatQueueStatusReport(queue: RunQueue, state: QueueState, classifications: Map<string, TaskClassification> = new Map()): string {
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
    if (s.status === "in_progress") {
      const classification = classifications.get(task.id);
      if (classification && classification.classification !== "not_applicable") {
        lines.push(`      live status: ${describeClassification(classification)}`);
      }
    }
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
    const staleWithMergedPr = inProgress.filter((t) => classifications.get(t.id)?.classification === "stale_pr_merged");
    if (staleWithMergedPr.length > 0) {
      lines.push(
        `  Reason: task(s) ${inProgress.map((t) => t.id).join(", ")} show "in_progress", but ${staleWithMergedPr.map((t) => t.id).join(", ")} actually merged already — run \`npm run ai:queue:reconcile\` to correct this before resuming.`
      );
    } else {
      lines.push(`  Reason: task(s) ${inProgress.map((t) => t.id).join(", ")} are stuck "in_progress" — a previous run likely crashed mid-task. Inspect before re-running.`);
    }
  }

  return lines.join("\n");
}

function main(): void {
  const repoRoot = process.cwd();
  try {
    const queue = loadRunQueue(repoRoot) as RunQueue;
    const state = loadQueueState(repoRoot);

    const running = isQueueProcessRunning(repoRoot);
    const lookupPr = lookupPrForBranch(repoRoot);
    const classifications = new Map(
      state.tasks
        .filter((s) => s.status === "in_progress")
        .map((s) => {
          const task = queue.tasks.find((t) => t.id === s.id);
          return [s.id, task ? classifyTaskState(task, s, lookupPr, running) : { classification: "not_applicable" as const, pr: null }];
        })
    );

    console.log(formatQueueStatusReport(queue, state, classifications));
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
