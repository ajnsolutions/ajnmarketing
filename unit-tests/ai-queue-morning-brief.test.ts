import test from "node:test";
import assert from "node:assert/strict";
import { buildMorningBriefMarkdown } from "../scripts/ai/generate-morning-brief.ts";
import type { RunQueue } from "../scripts/ai/queueTypes.ts";

/**
 * Part 6 requirement (2026-08-03, ADR-0017): the morning brief must
 * identify the EXACT missing-memory failure, not just a generic "task
 * failed" line — a human reading it before coffee should immediately know
 * this was a Project Memory problem, which files were involved, and
 * whether a repair was already attempted, without having to go dig through
 * RUN_STATUS.json or the raw task log themselves.
 */

function fakeQueue(): RunQueue {
  return {
    queue: { name: "ajnmarketing-overnight-queue", project: "p", execution_mode: "sequential", stop_on_failure: true, branch_strategy: "stacked", base_branch: "main", default_agent: "claude" },
    safety: { allow_merge: false, allow_deploy: false, allow_production_migrations: false, allow_secret_changes: false, allow_production_schedule_activation: false },
    tasks: [
      { id: "003", name: "Competitor Observation Engine", prompt: "prompts/003.md", branch: "ai-queue/003", agent: "claude", depends_on: [], requires_migration: false, requires_deployment: false, requires_secret_change: false, activates_production_schedule: false, stop_if_ambiguous: true, status: "pending" },
    ],
  };
}

test("no run yet: a calm, explicit 'nothing to report' message", () => {
  const md = buildMorningBriefMarkdown(fakeQueue(), null);
  assert.match(md, /No overnight queue run has occurred yet/);
});

test("morning brief identifies the exact missing-memory failure, not just a generic blocker line", () => {
  const md = buildMorningBriefMarkdown(fakeQueue(), {
    run_id: "2026-08-03T051052683Z",
    started_at: "2026-08-03T05:10:52.684Z",
    finished_at: "2026-08-03T05:28:01.275Z",
    stop_reason: "task 003 failed: no valid project-memory update",
    tasks: [
      {
        id: "003",
        name: "Competitor Observation Engine",
        status: "failed",
        branch: "ai-queue/003-competitor-observation-engine",
        commit: null,
        pr: null,
        blocker: "task completed and passed quality gates, but its Project Memory update is invalid after 3 repair attempt(s): .ai/HANDOFF.md was not updated",
        memory_validation: {
          passed: false,
          changed_files: [],
          reasons: [".ai/HANDOFF.md was not updated — required for every completed task.", ".ai/CURRENT_STATUS.md was not updated — required for every completed task."],
          repair_attempts: 3,
        },
      },
    ],
  });

  assert.match(md, /Tasks failed \(1\)/);
  // The generic blocker line must still be present...
  assert.match(md, /Project Memory update is invalid/);
  // ...but the brief must ALSO surface the specific, structured reasons —
  // not just the one-line summary — so a human knows exactly which files
  // and why, without opening RUN_STATUS.json.
  assert.match(md, /Project Memory check failed \(3 repair attempt\(s\) tried\)/);
  assert.match(md, /HANDOFF\.md was not updated/);
  assert.match(md, /CURRENT_STATUS\.md was not updated/);
});

test("a task that failed for a reason OTHER than memory validation does not print a spurious Project Memory line", () => {
  const md = buildMorningBriefMarkdown(fakeQueue(), {
    run_id: "run",
    started_at: "t0",
    finished_at: "t1",
    stop_reason: "task 003 failed: new regressions could not be repaired",
    tasks: [
      {
        id: "003",
        name: "Competitor Observation Engine",
        status: "failed",
        branch: "ai-queue/003",
        commit: null,
        pr: null,
        blocker: "quality gate failed after 3 auto-repair attempt(s) — new regression(s): typescript",
        memory_validation: null,
      },
    ],
  });
  assert.doesNotMatch(md, /Project Memory check failed/);
});

test("a completed task lists branch/commit/PR and the safe-next-action points at reviewing the PR, never at merging automatically", () => {
  const md = buildMorningBriefMarkdown(fakeQueue(), {
    run_id: "run",
    started_at: "t0",
    finished_at: "t1",
    stop_reason: "queue exhausted — all tasks reached a terminal state",
    tasks: [
      { id: "003", name: "Competitor Observation Engine", status: "completed", branch: "ai-queue/003", commit: "8261a20", pr: "https://github.com/x/y/pull/107", blocker: null },
    ],
  });
  assert.match(md, /Tasks completed \(1\)/);
  assert.match(md, /pull\/107/);
  assert.match(md, /merge by hand when satisfied/);
  assert.doesNotMatch(md, /merged automatically/i);
});
