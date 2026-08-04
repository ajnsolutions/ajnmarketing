#!/usr/bin/env node
/**
 * Reconciles any stale "in_progress" task in .ai/queue/QUEUE_STATUS.json
 * against real GitHub state, without running the queue itself. Run:
 * `npm run ai:queue:reconcile`.
 *
 * `npm run ai:queue` already does this automatically at startup — this
 * standalone command exists for when you want to fix a stale state (e.g.
 * right after noticing it via `npm run ai:queue:status`) without also
 * kicking off a new task immediately afterward. See
 * scripts/ai/reconcile.ts's header comment for the full root-cause story
 * this exists to fix, and .ai/DECISIONS.md ADR-0014.
 *
 * Safe to run anytime: it only ever moves a task OUT of "in_progress", and
 * only based on a real, verified `gh pr list` lookup — it never fabricates
 * a branch, commit, PR, or timestamp, and it never touches a task that
 * isn't currently "in_progress".
 */
import { pathToFileURL } from "node:url";
import { loadRunQueue, loadQueueState, saveQueueState, computeResumeEligible, QueueFileError } from "./queueIO.ts";
import { isQueueProcessRunning, lookupPrForBranch, reconcileQueueState, reconcileFailedMemoryChecks, resolveGitRef } from "./reconcile.ts";
import { validateProjectMemoryUpdate } from "./projectMemory.ts";
import type { RunQueue } from "./queueTypes.ts";

function main(): void {
  const repoRoot = process.cwd();
  let queue: RunQueue;
  try {
    queue = loadRunQueue(repoRoot) as RunQueue;
  } catch (error) {
    if (error instanceof QueueFileError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const state = loadQueueState(repoRoot);
  const running = isQueueProcessRunning(repoRoot);
  if (running) {
    console.log("A queue process appears to be actively running right now (a live run-lock PID was found) — no in_progress task will be touched.");
  }

  const { state: reconciledState, changes } = reconcileQueueState(queue, state, lookupPrForBranch(repoRoot), running);

  // Second, independent reconciliation pass: any task "failed" specifically
  // by the known Project Memory false-failure pattern (see
  // scripts/ai/projectMemory.ts and .ai/DECISIONS.md ADR-0017), with a real
  // PR whose actual base branch re-validates as genuinely containing a
  // valid memory update. Runs against reconciledState so both passes
  // compose correctly in one invocation.
  const memoryReconciliation = reconcileFailedMemoryChecks(repoRoot, queue, reconciledState, lookupPrForBranch(repoRoot), validateProjectMemoryUpdate, resolveGitRef(repoRoot));
  const finalState = memoryReconciliation.state;
  const allChanges = [...changes, ...memoryReconciliation.changes];

  if (allChanges.length === 0) {
    console.log("--- confirmed clean ---");
    console.log("No stale in_progress task state or Project-Memory false-failure found — nothing to reconcile.");
    return;
  }

  finalState.resume_eligible = computeResumeEligible(finalState);
  saveQueueState(repoRoot, finalState);

  console.log(`Reconciled ${allChanges.length} task(s):`);
  for (const change of allChanges) {
    console.log(`  ${change.taskId}: ${change.before} -> ${change.after}`);
    console.log(`    ${change.reason}`);
  }
  console.log("\n.ai/queue/QUEUE_STATUS.json updated. Run `npm run ai:queue:status` to see the full picture.");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
