/**
 * Claude Code CLI adapter.
 *
 * IMPORTANT — read .ai/OPEN_ITEMS.md's "This build's own limitation" entry
 * before trusting this for an unattended overnight run. The `claude` binary
 * was not present on PATH in the sandbox this adapter was built in, so only
 * the failure path (claude missing) has actually been exercised live. The
 * success path is implemented against documented Claude Code CLI
 * non-interactive conventions (`-p`/`--print` for a single non-interactive
 * turn, `--output-format json` for structured output) but has NOT been
 * run end-to-end. Run docs/AI_OVERNIGHT_QUEUE.md's daytime dry run before
 * any unattended use.
 *
 * This adapter deliberately does not guess silently: checkAvailability()
 * does a real, live capability probe and returns a specific, actionable
 * reason on any failure rather than assuming success.
 */
import { spawn } from "node:child_process";
import type { AgentAdapter, AgentCapability, AgentTaskInput, AgentTaskResult } from "./types.ts";

const REQUIRED_FLAG_HINTS = ["-p", "--print"];

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

    return { available: true };
  },

  async runTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    const result = await run("claude", ["-p", "--output-format", "json"], {
      cwd: input.cwd,
      input: input.prompt,
      // Generous ceiling for an unattended overnight task; run-queue.ts's own
      // per-task timeout (if configured) takes precedence in practice.
      timeoutMs: 55 * 60 * 1000,
    });

    const log = `$ claude -p --output-format json\n\n--- stdout ---\n${result.stdout}\n\n--- stderr ---\n${result.stderr}\n`;

    if (result.error) {
      return { success: false, summary: `claude invocation failed to start: ${result.error.message}`, log };
    }
    if (result.code !== 0) {
      return { success: false, summary: `claude exited with code ${result.code}`, log };
    }
    return { success: true, summary: "claude completed (exit 0) — see run-queue.ts's own quality-gate step for pass/fail of the actual task.", log };
  },
};
