/**
 * Claude Code CLI adapter.
 *
 * --- Live incident this design responds to (2026-08-02, run 2026-08-02T065749882Z) ---
 * The first real, unattended invocation of this adapter (before this fix) ran
 * `claude -p --output-format json` with no permission-mode flag. Claude
 * correctly tried to use its Write/Edit/Bash tools, correctly triggered this
 * CLI's normal interactive permission-approval flow for each one, and — with
 * no human present to approve anything in an unattended session — every one
 * of those approvals sat pending and was eventually given up on. Claude then
 * exited 0 with a text explanation of what happened, having made zero file
 * changes. The adapter's old logic only checked the process exit code, saw
 * 0, and reported success. The queue's own repair loop then ran a second,
 * identical invocation that hit the exact same wall and self-diagnosed the
 * root cause in its own response text (see
 * .ai/runs/2026-08-02T065749882Z/task-001.log, preserved as evidence).
 *
 * Two fixes below, both required:
 *   1. Pass --dangerously-skip-permissions so tool calls don't block on an
 *      approval that can never come. This is a deliberate, security-relevant
 *      choice, not an oversight — see "Why this is an acceptable tradeoff"
 *      below.
 *   2. Never trust exit code 0 alone again. Parse the JSON result and treat
 *      a non-empty `permission_denials` array or `is_error: true` as a real
 *      failure, regardless of exit code — this is the layer that would have
 *      caught the incident above even if the flag had been missing or
 *      silently stopped working in some future CLI version.
 *
 * Why this is an acceptable tradeoff: the thing that actually keeps an
 * unattended queue run safe was never "a human approves each tool call" —
 * that's incompatible with "unattended" by definition. It's
 * scripts/ai/validate-queue.ts (rejects any task that requests merge,
 * deploy, a production migration, a secret change, or production-schedule
 * activation, independent of what the task claims) plus run-queue.ts's own
 * code path, which simply never calls any of those operations. Skipping
 * *interactive tool-call approval* removes a layer that couldn't function
 * unattended anyway; it does not remove the layers that actually enforce
 * this repo's safety boundaries. A human still reviews every PR before
 * merging.
 *
 * checkAvailability() does a real, live capability probe for both the
 * non-interactive flag and the permission-bypass flag, and fails with an
 * actionable message rather than assuming either exists — this is the same
 * "don't guess silently" posture as before, just extended to cover the
 * flag this incident showed was missing.
 */
import { spawn } from "node:child_process";
import type { AgentAdapter, AgentCapability, AgentTaskInput, AgentTaskResult } from "./types.ts";

const REQUIRED_FLAG_HINTS = ["-p", "--print"];
const PERMISSION_BYPASS_FLAG = "--dangerously-skip-permissions";
const PERMISSION_FLAG_HINTS = ["--dangerously-skip-permissions", "--permission-mode"];

interface ClaudeCliJsonResult {
  is_error?: boolean;
  result?: string;
  permission_denials?: unknown[];
  session_id?: string;
}

function run(command: string, args: string[], opts: { cwd?: string; input?: string; timeoutMs?: number } = {}): Promise<{ code: number | null; stdout: string; stderr: string; error?: NodeJS.ErrnoException }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = opts.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : undefined;

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code: null, stdout, stderr, error: error as NodeJS.ErrnoException });
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });

    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
    }
    child.stdin.end();
  });
}

/** The exact argv this adapter invokes claude with — exported so tests can assert on it without spawning a real process. */
export function buildClaudeArgs(): string[] {
  return ["-p", "--output-format", "json", PERMISSION_BYPASS_FLAG];
}

/**
 * Inspects a parsed claude -p --output-format json result for the failure
 * signature this adapter's header comment describes: exit code 0 but no
 * real work done because every tool call was silently permission-blocked.
 * Exported so this specific, previously-invisible failure mode has direct
 * test coverage.
 */
export function detectSilentPermissionFailure(parsed: ClaudeCliJsonResult): string | null {
  if (parsed.is_error) {
    return `claude reported is_error: true — result: ${(parsed.result ?? "(no result text)").slice(0, 500)}`;
  }
  if (Array.isArray(parsed.permission_denials) && parsed.permission_denials.length > 0) {
    return `claude exited successfully but ${parsed.permission_denials.length} tool call(s) were permission-denied — this is the exact silent-no-op failure mode this adapter was fixed for after the 2026-08-02 live incident. Result text: ${(parsed.result ?? "(no result text)").slice(0, 500)}`;
  }
  return null;
}

export const claudeAdapter: AgentAdapter = {
  name: "claude",

  async checkAvailability(): Promise<AgentCapability> {
    const versionCheck = await run("claude", ["--version"], { timeoutMs: 10_000 });
    if (versionCheck.error?.code === "ENOENT") {
      return {
        available: false,
        reason:
          'The "claude" CLI was not found on PATH. Install the Claude Code CLI (see https://docs.claude.com/claude-code) and confirm `claude --version` works before running this queue.',
      };
    }
    if (versionCheck.code !== 0) {
      return {
        available: false,
        reason: `"claude --version" exited with code ${versionCheck.code}. stderr: ${versionCheck.stderr.slice(0, 500) || "(empty)"}`,
      };
    }

    const helpCheck = await run("claude", ["--help"], { timeoutMs: 10_000 });
    const helpText = `${helpCheck.stdout}\n${helpCheck.stderr}`;

    const supportsNonInteractive = REQUIRED_FLAG_HINTS.some((flag) => helpText.includes(flag));
    if (!supportsNonInteractive) {
      return {
        available: false,
        reason:
          `This installed "claude" CLI's --help output does not mention ${REQUIRED_FLAG_HINTS.join(" or ")}. ` +
          "This queue requires a Claude Code CLI version that supports non-interactive/print mode. Update the CLI, or update this adapter if the flag has been renamed — do not assume it works.",
      };
    }

    const supportsPermissionBypass = PERMISSION_FLAG_HINTS.some((flag) => helpText.includes(flag));
    if (!supportsPermissionBypass) {
      return {
        available: false,
        reason:
          `This installed "claude" CLI's --help output does not mention ${PERMISSION_FLAG_HINTS.join(" or ")}. ` +
          "Without a permission-bypass flag, every tool call in an unattended run will block on an approval no one is present to give, and claude will exit 0 having done nothing (this exact failure happened live on 2026-08-02 — see this file's header comment). Update the CLI, or update this adapter if the flag has been renamed — do not run the queue against a CLI that can't unblock this.",
      };
    }

    return { available: true };
  },

  async runTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    const args = buildClaudeArgs();
    const result = await run("claude", args, {
      cwd: input.cwd,
      input: input.prompt,
      // Generous ceiling for an unattended overnight task; run-queue.ts's own
      // per-task timeout (if configured) takes precedence in practice.
      timeoutMs: 55 * 60 * 1000,
    });

    const log = `$ claude ${args.join(" ")}\n\n--- stdout ---\n${result.stdout}\n\n--- stderr ---\n${result.stderr}\n`;

    if (result.error) {
      return { success: false, summary: `claude invocation failed to start: ${result.error.message}`, log };
    }
    if (result.code !== 0) {
      return { success: false, summary: `claude exited with code ${result.code}`, log };
    }

    let parsed: ClaudeCliJsonResult | null = null;
    try {
      parsed = JSON.parse(result.stdout) as ClaudeCliJsonResult;
    } catch {
      // Non-JSON stdout on exit 0 is unexpected but not itself proof of
      // failure — fall through to the exit-code-based success below rather
      // than guessing. The full raw output is in `log` either way.
    }
    if (parsed) {
      const silentFailure = detectSilentPermissionFailure(parsed);
      if (silentFailure) {
        return { success: false, summary: silentFailure, log };
      }
    }

    return { success: true, summary: "claude completed (exit 0, no permission denials reported) — see run-queue.ts's own quality-gate step for pass/fail of the actual task.", log };
  },
};
