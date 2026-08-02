import test from "node:test";
import assert from "node:assert/strict";
import { buildClaudeArgs, detectSilentPermissionFailure } from "../scripts/ai/adapters/claude.ts";

/**
 * Regression coverage for the 2026-08-02 live incident: the queue's first
 * real unattended task invocation exited 0 having done zero work, because
 * every Write/Edit/Bash tool call silently blocked on a permission approval
 * no one was present to give (see claude.ts's header comment and
 * .ai/runs/2026-08-02T065749882Z/task-001.log). These tests cover the two
 * fixes directly: the invocation now requests a permission bypass, and the
 * adapter now inspects the response body instead of trusting exit code 0
 * alone.
 */

test("buildClaudeArgs includes the permission-bypass flag", () => {
  const args = buildClaudeArgs();
  assert.ok(args.includes("--dangerously-skip-permissions"), "without this flag, every tool call blocks on an approval that can never come in an unattended run");
  assert.ok(args.includes("-p"));
  assert.ok(args.includes("--output-format"));
  assert.ok(args.includes("json"));
});

test("detectSilentPermissionFailure returns null for a normal successful result", () => {
  const result = detectSilentPermissionFailure({ is_error: false, result: "done", permission_denials: [] });
  assert.equal(result, null);
});

test("detectSilentPermissionFailure returns null when permission_denials is absent entirely (older CLI response shape)", () => {
  const result = detectSilentPermissionFailure({ is_error: false, result: "done" });
  assert.equal(result, null);
});

test("detectSilentPermissionFailure flags a non-empty permission_denials array even though is_error is false — the exact 2026-08-02 incident shape", () => {
  const result = detectSilentPermissionFailure({
    is_error: false,
    result: "I attempted to write the migration file but the tool call needs your explicit approval.",
    permission_denials: [{ tool_name: "Write" }, { tool_name: "Bash" }],
  });
  assert.notEqual(result, null);
  assert.match(result!, /2 tool call\(s\) were permission-denied/);
  assert.match(result!, /needs your explicit approval/);
});

test("detectSilentPermissionFailure flags is_error: true regardless of permission_denials", () => {
  const result = detectSilentPermissionFailure({ is_error: true, result: "something else went wrong", permission_denials: [] });
  assert.notEqual(result, null);
  assert.match(result!, /is_error: true/);
});
