import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateQueue } from "../scripts/ai/validate-queue.ts";
import type { RunQueue, QueueTask } from "../scripts/ai/queueTypes.ts";

/**
 * validateQueue() reads two things off disk: the real production-schedule
 * gate file (lib/trigger/scheduleActivation.ts) and each task's prompt
 * file. Rather than depend on the real repository tree, each test gets its
 * own throwaway temp directory with a minimal, correct version of both, so
 * these tests are fully isolated from repo state and from each other.
 */
function makeFixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "ai-queue-test-"));
  mkdirSync(join(root, "lib", "trigger"), { recursive: true });
  writeFileSync(join(root, "lib", "trigger", "scheduleActivation.ts"), "export const ATTACH_DECLARATIVE_PRODUCTION_CRONS = false;\n");
  mkdirSync(join(root, ".ai", "queue", "prompts"), { recursive: true });
  writeFileSync(join(root, ".ai", "queue", "prompts", "task.md"), "# A test task\n\nDo something safe.\n");
  return root;
}

function baseTask(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: "001",
    name: "Test task",
    prompt: "prompts/task.md",
    branch: "ai-queue/001-test-task",
    agent: "claude",
    depends_on: [],
    requires_migration: false,
    requires_deployment: false,
    requires_secret_change: false,
    activates_production_schedule: false,
    stop_if_ambiguous: true,
    status: "pending",
    ...overrides,
  };
}

function baseQueue(tasks: QueueTask[]): RunQueue {
  return {
    queue: {
      name: "test-queue",
      project: "ajnmarketing",
      execution_mode: "sequential",
      stop_on_failure: true,
      branch_strategy: "independent",
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
    tasks,
  };
}

test("a well-formed queue with one safe task validates cleanly", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask()]), root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects duplicate task IDs", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ id: "001" }), baseTask({ id: "001", branch: "ai-queue/001-other" })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("used 2 times")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a dependency that references a missing task id", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ id: "001", depends_on: ["999"] })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes('unknown task id "999"')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a dependency cycle", () => {
  const root = makeFixtureRepo();
  try {
    const tasks = [
      baseTask({ id: "001", branch: "ai-queue/001", depends_on: ["002"] }),
      baseTask({ id: "002", branch: "ai-queue/002", depends_on: ["001"] }),
    ];
    const result = validateQueue(baseQueue(tasks), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("dependency cycle detected")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a task whose prompt file does not exist", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ prompt: "prompts/does-not-exist.md" })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("does not exist")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a task that requires a production migration", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ requires_migration: true })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("requires_migration")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a task that requires deployment", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ requires_deployment: true })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("requires_deployment")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a task that requires a secret change", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ requires_secret_change: true })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("requires_secret_change")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a task that activates a production schedule", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ activates_production_schedule: true })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("activates_production_schedule")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects the queue outright when the safety block allows merge, deploy, migrations, secrets, or schedule activation", () => {
  const root = makeFixtureRepo();
  try {
    const queue = baseQueue([baseTask()]);
    queue.safety.allow_deploy = true;
    const result = validateQueue(queue, root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("safety.allow_deploy is true")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects the queue when the real repository schedule gate is flipped true", () => {
  const root = makeFixtureRepo();
  try {
    writeFileSync(join(root, "lib", "trigger", "scheduleActivation.ts"), "export const ATTACH_DECLARATIVE_PRODUCTION_CRONS = true;\n");
    const result = validateQueue(baseQueue([baseTask()]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("appears ENABLED")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects an unsupported agent", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ agent: "cursor" })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("not a supported agent")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects an invalid task status", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ status: "in-flight" })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes('task.status "in-flight" is invalid')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a missing required field (task.name)", () => {
  const root = makeFixtureRepo();
  try {
    const task = baseTask();
    // @ts-expect-error deliberately constructing an invalid task for the test
    delete task.name;
    const result = validateQueue(baseQueue([task]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("task.name is required")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a task with an invalid branch name", () => {
  const root = makeFixtureRepo();
  try {
    const result = validateQueue(baseQueue([baseTask({ branch: "-bad branch name" })]), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("not a valid branch name")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects two tasks that share the same branch name", () => {
  const root = makeFixtureRepo();
  try {
    const tasks = [baseTask({ id: "001", branch: "ai-queue/shared" }), baseTask({ id: "002", branch: "ai-queue/shared" })];
    const result = validateQueue(baseQueue(tasks), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes('branch "ai-queue/shared" is used by 2 tasks')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a pending task that depends on a permanently disabled task", () => {
  const root = makeFixtureRepo();
  try {
    const tasks = [
      baseTask({ id: "001", branch: "ai-queue/001", status: "disabled" }),
      baseTask({ id: "002", branch: "ai-queue/002", depends_on: ["001"], status: "pending" }),
    ];
    const result = validateQueue(baseQueue(tasks), root);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.message.includes("could never become eligible")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the real .ai/queue/RUN_QUEUE.yaml in this repository is itself valid", async () => {
  const { parse } = await import("yaml");
  const { readFileSync } = await import("node:fs");
  const repoRoot = join(import.meta.dirname, "..");
  const raw = readFileSync(join(repoRoot, ".ai", "queue", "RUN_QUEUE.yaml"), "utf8");
  const result = validateQueue(parse(raw), repoRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});
