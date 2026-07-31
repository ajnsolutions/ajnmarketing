#!/usr/bin/env node
/**
 * Resets .ai/queue/QUEUE_STATUS.json to a fresh state derived from
 * .ai/queue/RUN_QUEUE.yaml. Run: `npm run ai:queue:reset -- --confirm`.
 *
 * This is LOCAL QUEUE STATE ONLY. It never deletes a remote branch, never
 * closes a PR, never removes a commit, never rewrites Git history, and
 * never deletes anything under .ai/runs/. If you need any of those, do it
 * by hand, deliberately, outside this script.
 */
import { pathToFileURL } from "node:url";
import { validateQueue } from "./validate-queue.ts";
import { loadRunQueue, saveQueueState, buildInitialQueueState, QueueFileError } from "./queueIO.ts";
import type { RunQueue } from "./queueTypes.ts";

function main(): void {
  const repoRoot = process.cwd();
  const confirmed = process.argv.includes("--confirm");

  if (!confirmed) {
    console.error(
      "Refusing to reset without confirmation.\n\n" +
        "This resets .ai/queue/QUEUE_STATUS.json only — it does NOT delete remote branches, close PRs, remove commits, rewrite history, or delete .ai/runs/ logs.\n\n" +
        "Re-run with: npm run ai:queue:reset -- --confirm"
    );
    process.exit(1);
  }

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
    console.error("Refusing to reset: RUN_QUEUE.yaml is currently invalid. Fix it first (npm run ai:queue:validate), then reset.");
    process.exit(1);
  }

  const state = buildInitialQueueState(parsed as RunQueue);
  saveQueueState(repoRoot, state);
  console.log("--- confirmed clean ---");
  console.log(".ai/queue/QUEUE_STATUS.json reset — all tasks set back to their RUN_QUEUE.yaml status (pending/disabled).");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
