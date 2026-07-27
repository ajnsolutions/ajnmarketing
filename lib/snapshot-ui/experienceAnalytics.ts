import "server-only";

/**
 * First Impression funnel analytics — server-side tracker, reusing
 * lib/observability/workflowLogger.ts exactly like PR #74/#75's own
 * observability modules. A separate, small event vocabulary from
 * lib/business-discovery/public/observability.ts's scan-lifecycle events
 * and lib/business-discovery/continuation/observability.ts's continuation
 * events — this one is specifically the *UX funnel*.
 *
 * The metadata shape accepted here (SnapshotFunnelEventMetadata) is
 * intentionally narrow — section names and insight *keys* only, never a
 * value, correction text, or snapshot content of any kind. The API route
 * that calls this (app/api/business-discovery/snapshot-events/route.ts)
 * enforces the same allowlist before this function is ever reached.
 */

import { createCorrelationId, logWorkflow, type WorkflowLogResult } from "@/lib/observability/workflowLogger";

export const SNAPSHOT_FUNNEL_EVENTS = [
  "scan_form_viewed",
  "scan_submitted",
  "validation_failed",
  "scan_started",
  "scan_completed",
  "partial_result_shown",
  "result_section_viewed",
  "explanation_opened",
  "insight_confirmed",
  "insight_corrected",
  "insight_rejected",
  "insight_deferred",
  "signup_selected",
  "signin_selected",
  "continuation_resolved",
  "continuation_expired",
  "onboarding_review_completed",
] as const;

export type SnapshotFunnelEvent = (typeof SNAPSHOT_FUNNEL_EVENTS)[number];

export type SnapshotFunnelEventMetadata = {
  /** A result-section name, e.g. "identity" | "presence" | "growth" — never content. */
  section?: string;
  /** An InsightKey literal, e.g. "primaryServices" — never the insight's value. */
  insightKey?: string;
  /** A structured error code from the public/continuation contracts, e.g. "blocked_url". */
  errorCode?: string;
};

const EVENT_RESULT: Record<SnapshotFunnelEvent, WorkflowLogResult> = {
  scan_form_viewed: "success",
  scan_submitted: "success",
  validation_failed: "skipped",
  scan_started: "success",
  scan_completed: "success",
  partial_result_shown: "success",
  result_section_viewed: "success",
  explanation_opened: "success",
  insight_confirmed: "success",
  insight_corrected: "success",
  insight_rejected: "success",
  insight_deferred: "success",
  signup_selected: "success",
  signin_selected: "success",
  continuation_resolved: "success",
  continuation_expired: "skipped",
  onboarding_review_completed: "success",
};

export function trackSnapshotFunnelEvent(event: SnapshotFunnelEvent, metadata: SnapshotFunnelEventMetadata = {}): void {
  logWorkflow({
    correlationId: createCorrelationId(),
    tenantUserId: null,
    businessProfileId: null,
    pipelineStage: `snapshot_experience.${event}`,
    result: EVENT_RESULT[event],
    metadata,
  });
}
