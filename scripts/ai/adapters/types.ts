/**
 * The adapter interface every agent backend implements. This first version
 * ships exactly one working adapter (claude.ts) — cursor-placeholder.ts
 * exists to define the shape future Grok/Cursor headless execution would
 * need, without claiming that execution works. Do not add a new agent to
 * queueTypes.ts's SUPPORTED_AGENTS until its adapter has actually been
 * verified end-to-end, not just implemented.
 */

export interface AgentCapability {
  available: boolean;
  /** Human-readable reason when available is false — must be actionable, not just "no". */
  reason?: string;
}

export interface AgentTaskInput {
  /** Full prompt text to hand to the agent (already resolved from the task's prompt file). */
  prompt: string;
  /** Working directory the agent should operate in — the checked-out task branch. */
  cwd: string;
}

export interface AgentTaskResult {
  success: boolean;
  /** Short human-readable outcome, suitable for RUN_SUMMARY.md. */
  summary: string;
  /** Full raw output, written to the task's .ai/runs/<run-id>/task-NNN.log. */
  log: string;
}

export interface AgentAdapter {
  name: string;
  /** Must perform a real, live capability check — never assume availability. */
  checkAvailability(): Promise<AgentCapability>;
  /** Only ever called after checkAvailability() reports available: true. */
  runTask(input: AgentTaskInput): Promise<AgentTaskResult>;
}
