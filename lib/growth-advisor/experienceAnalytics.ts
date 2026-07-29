import "server-only";

/**
 * Your Growth Advisor — product telemetry. Reuses lib/observability/workflowLogger.ts,
 * exactly like the First Impression funnel (lib/snapshot-ui/experienceAnalytics.ts).
 *
 * Metadata is deliberately narrow — a section name and/or a recommendation
 * id only, never conversation content, recommendation titles, or any other
 * free text. The API route that calls this
 * (app/api/growth-advisor/events/route.ts) enforces the same allowlist
 * before this function is ever reached.
 */

import { createCorrelationId, logWorkflow, type WorkflowLogResult } from "@/lib/observability/workflowLogger";

export const GROWTH_ADVISOR_EVENTS = [
  "growth_advisor_viewed",
  "recommendation_expanded",
  "recommendation_accepted",
  "recommendation_dismissed",
  "tell_me_more",
  "primary_action_selected",
] as const;

export type GrowthAdvisorEvent = (typeof GROWTH_ADVISOR_EVENTS)[number];

export type GrowthAdvisorEventMetadata = {
  /** A supporting-context section name, e.g. "marketing_health" | "recent_activity" — never content. */
  section?: string;
  /** The recommendation id a recommendation_* event refers to — never its title or copy. */
  recommendationId?: string;
};

const EVENT_RESULT: Record<GrowthAdvisorEvent, WorkflowLogResult> = {
  growth_advisor_viewed: "success",
  recommendation_expanded: "success",
  recommendation_accepted: "success",
  recommendation_dismissed: "success",
  tell_me_more: "success",
  primary_action_selected: "success",
};

export function trackGrowthAdvisorEvent(
  event: GrowthAdvisorEvent,
  context: { tenantUserId: string | null; businessProfileId: string | null },
  metadata: GrowthAdvisorEventMetadata = {},
): void {
  logWorkflow({
    correlationId: createCorrelationId(),
    tenantUserId: context.tenantUserId,
    businessProfileId: context.businessProfileId,
    pipelineStage: `growth_advisor.${event}`,
    result: EVENT_RESULT[event],
    metadata,
  });
}
