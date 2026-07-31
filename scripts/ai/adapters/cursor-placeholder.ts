/**
 * Placeholder adapter for a future Grok/Cursor headless execution backend.
 *
 * This is an interface sketch, not a working implementation. It exists so
 * the queue's agent-selection code has something concrete to import and
 * type-check against when this backend is eventually built — nothing more.
 *
 * Do not remove the "unavailable" behavior below until a real implementation
 * has been built AND verified end-to-end (per docs/AI_OVERNIGHT_QUEUE.md's
 * daytime-dry-run standard, the same one claude.ts is held to). Until then,
 * "cursor" and "grok" are not in queueTypes.ts's SUPPORTED_AGENTS, and
 * scripts/ai/validate-queue.ts rejects any task that names them as its
 * agent — this placeholder being unavailable is a second, independent layer
 * of the same protection, not the only one.
 */
import type { AgentAdapter, AgentCapability, AgentTaskResult } from "./types.ts";

export const cursorPlaceholderAdapter: AgentAdapter = {
  name: "cursor",

  async checkAvailability(): Promise<AgentCapability> {
    return {
      available: false,
      reason:
        "Cursor/Grok headless execution is not implemented. This adapter is a placeholder for future work only — see this file's header comment.",
    };
  },

  async runTask(): Promise<AgentTaskResult> {
    throw new Error(
      "cursorPlaceholderAdapter.runTask() was called, but this adapter is not implemented. checkAvailability() should have been checked first and would have returned available: false."
    );
  },
};
