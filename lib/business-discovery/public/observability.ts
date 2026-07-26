/**
 * Privacy-conscious observability for the public snapshot path.
 *
 * Reuses the existing structured workflow logger (lib/observability/
 * workflowLogger.ts) rather than inventing a parallel logging convention —
 * `tenantUserId` is always null here (there is no tenant), and
 * `sanitizeWorkflowMetadata` already strips secrets/tokens/content/html keys
 * before anything reaches a log line. This module adds the specific,
 * anonymous-funnel event vocabulary this feature needs on top of that.
 *
 * Never logged: the fetched page's HTML/text content, AI prompts or
 * completions, the visitor's IP address (rate limiting uses it in memory
 * only — see rateLimit.ts — and never writes it to a log line here).
 */

import { createCorrelationId, logWorkflow, type WorkflowLogResult } from "@/lib/observability/workflowLogger";

export type PublicSnapshotEvent =
  | "scan_requested"
  | "validation_rejected"
  | "rate_limited"
  | "cache_hit"
  | "cache_miss"
  | "discovery_completed"
  | "discovery_partial"
  | "discovery_failed"
  | "timeout"
  | "blocked_url";

const EVENT_RESULT: Record<PublicSnapshotEvent, WorkflowLogResult> = {
  scan_requested: "success",
  validation_rejected: "skipped",
  rate_limited: "skipped",
  cache_hit: "success",
  cache_miss: "success",
  discovery_completed: "success",
  discovery_partial: "success",
  discovery_failed: "failure",
  timeout: "failure",
  blocked_url: "skipped",
};

const counts: Record<PublicSnapshotEvent, number> = {
  scan_requested: 0,
  validation_rejected: 0,
  rate_limited: 0,
  cache_hit: 0,
  cache_miss: 0,
  discovery_completed: 0,
  discovery_partial: 0,
  discovery_failed: 0,
  timeout: 0,
  blocked_url: 0,
};

export function trackPublicSnapshotEvent(
  event: PublicSnapshotEvent,
  options: { correlationId?: string; durationMs?: number; failureCategory?: string } = {}
): void {
  counts[event] += 1;
  logWorkflow({
    correlationId: options.correlationId ?? createCorrelationId(),
    tenantUserId: null,
    businessProfileId: null,
    pipelineStage: `public_business_discovery.${event}`,
    durationMs: options.durationMs,
    result: EVENT_RESULT[event],
    failureCategory: options.failureCategory ?? null,
  });
}

export function getPublicSnapshotEventCounts(): Record<PublicSnapshotEvent, number> {
  return { ...counts };
}

/** Test helper — resets in-memory counters between test files. */
export function resetPublicSnapshotEventCounts(): void {
  for (const key of Object.keys(counts) as PublicSnapshotEvent[]) {
    counts[key] = 0;
  }
}
