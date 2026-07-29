/**
 * Privacy-conscious observability for the snapshot continuation flow. Reuses
 * lib/observability/workflowLogger.ts (same convention as
 * lib/business-discovery/public/observability.ts) rather than inventing a
 * parallel one.
 *
 * Never logged: snapshot result bodies, page content, AI prompts/completions,
 * auth tokens, or a snapshot reference in plaintext. Where a reference needs
 * to be correlated across log lines, only its sha256 hash is used — the same
 * low-sensitivity, one-way technique already used for the cache key itself
 * (lib/business-discovery/public/cache.ts).
 */

import { createHash } from "node:crypto";
import { createCorrelationId, logWorkflow, type WorkflowLogResult } from "@/lib/observability/workflowLogger";

export type ContinuationEvent =
  | "continuation_requested"
  | "reference_resolved"
  | "invalid_reference"
  | "expired_reference"
  | "claim_succeeded"
  | "claim_conflict"
  | "confirmation_submitted"
  | "continuation_completed"
  | "continuation_failed"
  | "dns_pinning_rejected";

const EVENT_RESULT: Record<ContinuationEvent, WorkflowLogResult> = {
  continuation_requested: "success",
  reference_resolved: "success",
  invalid_reference: "skipped",
  expired_reference: "skipped",
  claim_succeeded: "success",
  claim_conflict: "skipped",
  confirmation_submitted: "success",
  continuation_completed: "success",
  continuation_failed: "failure",
  dns_pinning_rejected: "skipped",
};

/** A short, non-reversible-to-the-original-URL correlation hash — never the raw reference. */
export function hashReferenceForLogging(reference: string): string {
  return createHash("sha256").update(reference).digest("hex").slice(0, 16);
}

export function trackContinuationEvent(
  event: ContinuationEvent,
  options: { userId?: string | null; referenceHash?: string; durationMs?: number; failureCategory?: string } = {}
): void {
  logWorkflow({
    correlationId: createCorrelationId(),
    tenantUserId: options.userId ?? null,
    businessProfileId: null,
    pipelineStage: `snapshot_continuation.${event}`,
    durationMs: options.durationMs,
    result: EVENT_RESULT[event],
    failureCategory: options.failureCategory ?? null,
    metadata: options.referenceHash ? { referenceHash: options.referenceHash } : undefined,
  });
}
