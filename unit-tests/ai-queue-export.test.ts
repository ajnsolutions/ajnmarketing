import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectMemoryMarkdown, type MemoryInputs } from "../scripts/ai/export-memory.ts";
import { buildMorningBriefMarkdown } from "../scripts/ai/generate-morning-brief.ts";
import { redactSecrets } from "../scripts/ai/redact.ts";
import type { RunQueue } from "../scripts/ai/queueTypes.ts";

function memoryInputs(overrides: Partial<MemoryInputs> = {}): MemoryInputs {
  return {
    currentStatus: "# Current Status\n\nAll good.",
    roadmap: "# Roadmap\n\nShipped stuff.",
    architecture: "# Architecture\n\nNext.js.",
    decisions: "# Decisions\n\nADR-0001.",
    openItems: "# Open Items\n\nNone.",
    handoff: "# Handoff\n\nDone.",
    statusJson: '{"project":"AJN Marketing"}',
    latestRunSummary: null,
    ...overrides,
  };
}

test("buildProjectMemoryMarkdown combines every section in a stable, readable order", () => {
  const markdown = buildProjectMemoryMarkdown(memoryInputs(), "2026-07-31T00:00:00Z");
  assert.match(markdown, /^# Project Memory — AJN Marketing/);
  assert.match(markdown, /## Current Status[\s\S]*## Roadmap[\s\S]*## Architecture[\s\S]*## Decisions[\s\S]*## Open Items[\s\S]*## Handoff[\s\S]*## Machine-readable status/);
  assert.match(markdown, /```json\n\{"project":"AJN Marketing"\}\n```/);
});

test("buildProjectMemoryMarkdown omits the latest-run section entirely when there is no run yet", () => {
  const markdown = buildProjectMemoryMarkdown(memoryInputs({ latestRunSummary: null }), "2026-07-31T00:00:00Z");
  assert.doesNotMatch(markdown, /## Latest overnight queue run/);
});

test("buildProjectMemoryMarkdown includes the latest-run section when a run summary is provided", () => {
  const markdown = buildProjectMemoryMarkdown(memoryInputs({ latestRunSummary: "Task 001 completed." }), "2026-07-31T00:00:00Z");
  assert.match(markdown, /## Latest overnight queue run\n\nTask 001 completed\./);
});

test("redactSecrets removes an OpenAI-shaped key but leaves ordinary text untouched", () => {
  const input = "config uses sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD for auth, everything else is fine.";
  const redacted = redactSecrets(input);
  assert.doesNotMatch(redacted, /sk-abcdefghijklmnopqrstuvwxyz/);
  assert.match(redacted, /\[REDACTED\]/);
  assert.match(redacted, /everything else is fine\./);
});

function fakeQueue(): RunQueue {
  return {
    queue: {
      name: "ajnmarketing-overnight-queue",
      project: "ajnmarketing",
      execution_mode: "sequential",
      stop_on_failure: true,
      branch_strategy: "stacked",
      base_branch: "main",
      default_agent: "claude",
    },
    safety: {
      allow_merge: false,
      allow_deploy: false,
      allow_production_migrations: false,
      allow_secret_changes: false,
      allow_production_schedule_activation: false,
    },
    tasks: [
      {
        id: "001",
        name: "First task",
        prompt: "prompts/001.md",
        branch: "ai-queue/001",
        agent: "claude",
        depends_on: [],
        requires_migration: false,
        requires_deployment: false,
        requires_secret_change: false,
        activates_production_schedule: false,
        stop_if_ambiguous: true,
        status: "pending",
      },
      {
        id: "002",
        name: "Second task",
        prompt: "prompts/002.md",
        branch: "ai-queue/002",
        agent: "claude",
        depends_on: ["001"],
        requires_migration: false,
        requires_deployment: false,
        requires_secret_change: false,
        activates_production_schedule: false,
        stop_if_ambiguous: true,
        status: "pending",
      },
    ],
  };
}

test("buildMorningBriefMarkdown reports 'no run yet' when there is no run to summarize", () => {
  const markdown = buildMorningBriefMarkdown(fakeQueue(), null);
  assert.match(markdown, /No overnight queue run has occurred yet/);
});

test("buildMorningBriefMarkdown lists completed/failed/not-started tasks and a merge order for dependent completed tasks", () => {
  const run = {
    run_id: "2026-07-31T020000Z",
    started_at: "2026-07-31T02:00:00Z",
    finished_at: "2026-07-31T02:45:00Z",
    stop_reason: "queue exhausted — all tasks reached a terminal state",
    tasks: [
      { id: "001", name: "First task", status: "completed", branch: "ai-queue/001", commit: "aaaaaaaaaaaa1111", pr: "https://github.com/x/y/pull/1", blocker: null },
      { id: "002", name: "Second task", status: "completed", branch: "ai-queue/002", commit: "bbbbbbbbbbbb2222", pr: "https://github.com/x/y/pull/2", blocker: null },
    ],
  };
  const markdown = buildMorningBriefMarkdown(fakeQueue(), run);
  assert.match(markdown, /Tasks completed \(2\)/);
  assert.match(markdown, /Tasks failed \(0\)/);
  assert.match(markdown, /Tasks not started \(0\)/);
  assert.match(markdown, /## Merge order/);
  assert.match(markdown, /- 001 \(no dependencies — can merge independently\)/);
  assert.match(markdown, /- 002 \(after: 001\)/);
});

test("buildMorningBriefMarkdown surfaces a failed task's blocker as the recommended next action", () => {
  const run = {
    run_id: "2026-07-31T020000Z",
    started_at: "2026-07-31T02:00:00Z",
    finished_at: "2026-07-31T02:10:00Z",
    stop_reason: "task 001 failed: quality gate did not pass",
    tasks: [{ id: "001", name: "First task", status: "failed", branch: "ai-queue/001", commit: null, pr: null, blocker: "npm run lint failed" }],
  };
  const markdown = buildMorningBriefMarkdown(fakeQueue(), run);
  assert.match(markdown, /Tasks failed \(1\)/);
  assert.match(markdown, /npm run lint failed/);
  assert.match(markdown, /Review the blocker for task 001/);
});
