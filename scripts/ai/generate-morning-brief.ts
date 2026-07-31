#!/usr/bin/env node
/**
 * Builds .ai/exports/MORNING_BRIEF.md — a short, non-technical summary of
 * the most recent overnight queue run, meant for a project owner who
 * doesn't want to read logs. Run: `npm run ai:morning-brief`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { redactSecrets } from "./redact.ts";
import { loadRunQueue, QueueFileError } from "./queueIO.ts";
import type { RunQueue } from "./queueTypes.ts";

interface RunTaskStatus {
  id: string;
  name: string;
  status: string;
  branch: string | null;
  commit: string | null;
  pr: string | null;
  blocker: string | null;
}

interface RunStatusFile {
  run_id: string;
  started_at: string;
  finished_at: string;
  stop_reason: string;
  tasks: RunTaskStatus[];
}

export function buildMorningBriefMarkdown(queue: RunQueue | null, run: RunStatusFile | null): string {
  if (!run) {
    return "# Morning Brief\n\nNo overnight queue run has occurred yet. Nothing to report.\n";
  }

  const dependsOnById = new Map((queue?.tasks ?? []).map((t) => [t.id, t.depends_on]));
  const byStatus = (status: string) => run.tasks.filter((t) => t.status === status);
  const completed = byStatus("completed");
  const failed = byStatus("failed");
  const notStarted = run.tasks.filter((t) => !["completed", "failed"].includes(t.status));

  const lines: string[] = [];
  lines.push("# Morning Brief");
  lines.push("");
  lines.push(`Overnight queue: **${queue?.queue.name ?? "(unknown)"}**`);
  lines.push(`Run: ${run.run_id} (started ${run.started_at}, finished ${run.finished_at})`);
  lines.push(`Why it stopped: ${run.stop_reason}`);
  lines.push("");

  lines.push(`## Tasks completed (${completed.length})`);
  if (completed.length === 0) lines.push("None.");
  for (const t of completed) lines.push(`- **${t.id} — ${t.name}** — branch \`${t.branch}\`, commit \`${t.commit?.slice(0, 12)}\`, PR: ${t.pr}`);
  lines.push("");

  lines.push(`## Tasks failed (${failed.length})`);
  if (failed.length === 0) lines.push("None.");
  for (const t of failed) lines.push(`- **${t.id} — ${t.name}** — ${t.blocker ?? "failed, no blocker detail recorded"}`);
  lines.push("");

  lines.push(`## Tasks not started (${notStarted.length})`);
  if (notStarted.length === 0) lines.push("None — every task in this run reached a final state.");
  for (const t of notStarted) lines.push(`- ${t.id} — ${t.name}`);
  lines.push("");

  lines.push("## Quality gates");
  lines.push(failed.length === 0 && completed.length > 0 ? "All quality gates passed for every completed task (lint, typecheck, unit tests)." : "See each task above — a failed task's blocker line states which gate (or step) stopped it.");
  lines.push("");

  lines.push("## Blockers");
  const blockers = failed.filter((t) => t.blocker);
  if (blockers.length === 0) lines.push("None.");
  for (const t of blockers) lines.push(`- ${t.id}: ${t.blocker}`);
  lines.push("");

  lines.push("## Safe recommended next action");
  if (failed.length > 0) {
    lines.push(`Review the blocker for task ${failed[0].id} above, fix it by hand, then re-run \`npm run ai:queue\` — it will resume from where it stopped. Nothing has been merged or deployed; it's safe to take your time.`);
  } else if (completed.length > 0) {
    lines.push("Review the pull request(s) listed above in the order shown under \"Merge order\" below, then merge by hand when satisfied. Nothing has been merged or deployed automatically.");
  } else {
    lines.push("No tasks ran. Check that the queue has pending, non-disabled tasks (`npm run ai:queue:status`).");
  }
  lines.push("");

  if (completed.length > 1) {
    lines.push("## Merge order");
    lines.push("Dependent tasks must be merged in this order (a later task's branch was built on an earlier one's):");
    for (const t of completed) {
      const deps = dependsOnById.get(t.id) ?? [];
      lines.push(deps.length > 0 ? `- ${t.id} (after: ${deps.join(", ")})` : `- ${t.id} (no dependencies — can merge independently)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function findLatestRun(repoRoot: string): RunStatusFile | null {
  const runsDir = join(repoRoot, ".ai", "runs");
  if (!existsSync(runsDir)) return null;
  const entries = readdirSync(runsDir).filter((name) => statSync(join(runsDir, name)).isDirectory());
  if (entries.length === 0) return null;
  const latest = entries.sort().at(-1)!;
  const statusPath = join(runsDir, latest, "RUN_STATUS.json");
  if (!existsSync(statusPath)) return null;
  return JSON.parse(readFileSync(statusPath, "utf8")) as RunStatusFile;
}

function main(): void {
  const repoRoot = process.cwd();
  let queue: RunQueue | null = null;
  try {
    queue = loadRunQueue(repoRoot) as RunQueue;
  } catch (error) {
    if (!(error instanceof QueueFileError)) throw error;
    // Missing/invalid RUN_QUEUE.yaml shouldn't block reporting on a past run — just omit queue-name/merge-order context.
  }
  const run = findLatestRun(repoRoot);
  const markdown = redactSecrets(buildMorningBriefMarkdown(queue, run));

  const outDir = join(repoRoot, ".ai", "exports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "MORNING_BRIEF.md");
  writeFileSync(outPath, markdown, "utf8");
  console.log(`Wrote ${outPath}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
