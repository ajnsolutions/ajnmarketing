/**
 * Pure per-tenant health dimension classification — no I/O, deterministic. Split
 * out of tenantHealth.ts (which is server-only) so this logic is directly unit
 * testable, matching the lib/customer-setup/progress.ts vs service.ts split.
 */

import type { CustomerSetupSnapshot } from "@/lib/customer-setup/types";
import type { GoogleBusinessProfileConnectionStatus } from "@/lib/google-business-profile/types";

export const TenantHealthStates = {
  HEALTHY: "healthy",
  WARNING: "warning",
  BLOCKED: "blocked",
  UNAVAILABLE: "unavailable",
  INTENTIONALLY_UNUSED: "intentionally_unused",
  UNKNOWN: "unknown",
} as const;

export type TenantHealthState = (typeof TenantHealthStates)[keyof typeof TenantHealthStates];

export type TenantHealthDimension = {
  key: string;
  label: string;
  state: TenantHealthState;
  detail: string;
};

/** Pending content_approvals older than this are counted as "overdue" (documented threshold, not a guess). */
export const APPROVAL_OVERDUE_HOURS = 7 * 24;

export function worstTenantState(states: TenantHealthState[]): TenantHealthState {
  const order: TenantHealthState[] = [
    TenantHealthStates.BLOCKED,
    TenantHealthStates.WARNING,
    TenantHealthStates.UNKNOWN,
    TenantHealthStates.UNAVAILABLE,
    TenantHealthStates.INTENTIONALLY_UNUSED,
    TenantHealthStates.HEALTHY,
  ];
  for (const candidate of order) {
    if (states.includes(candidate)) return candidate;
  }
  return TenantHealthStates.HEALTHY;
}

export function classifyTenantDimensions(input: {
  setup: CustomerSetupSnapshot | null;
  gbp: GoogleBusinessProfileConnectionStatus | null;
  publishing: { failed: number; queued: number; retrying: number };
  approvals: { pending: number; overdue: number };
  jobFailures: number;
}): TenantHealthDimension[] {
  const { setup, gbp, publishing, approvals, jobFailures } = input;
  const dimensions: TenantHealthDimension[] = [];

  dimensions.push({
    key: "setup",
    label: "Customer setup",
    state: !setup
      ? TenantHealthStates.UNKNOWN
      : setup.needsAttentionStepKeys.length > 0
        ? TenantHealthStates.WARNING
        : setup.requiredComplete < setup.requiredTotal
          ? TenantHealthStates.WARNING
          : TenantHealthStates.HEALTHY,
    detail: setup
      ? `${setup.requiredComplete}/${setup.requiredTotal} required steps complete.`
      : "Setup snapshot unavailable.",
  });

  dimensions.push({
    key: "google_business",
    label: "Google Business connection",
    state: !gbp
      ? TenantHealthStates.UNKNOWN
      : gbp.setupRequired
        ? TenantHealthStates.UNAVAILABLE
        : gbp.connected && gbp.scopesValid
          ? TenantHealthStates.HEALTHY
          : gbp.connection && gbp.connection.connection_status !== "not_connected"
            ? TenantHealthStates.WARNING // previously connected, now expired/revoked/error
            : TenantHealthStates.INTENTIONALLY_UNUSED, // never connected — optional, not a failure
    detail: !gbp
      ? "Connection status unavailable."
      : gbp.setupRequired
        ? "Google integration not configured for this environment."
        : gbp.connected
          ? "Connected."
          : gbp.connection
            ? `Not connected (${gbp.connection.connection_status}).`
            : "Never connected — optional.",
  });

  dimensions.push({
    key: "publishing",
    label: "Publishing queue",
    state:
      publishing.failed > 0
        ? TenantHealthStates.BLOCKED
        : publishing.retrying > 0
          ? TenantHealthStates.WARNING
          : TenantHealthStates.HEALTHY,
    detail: `${publishing.failed} failed, ${publishing.retrying} retrying, ${publishing.queued} queued.`,
  });

  dimensions.push({
    key: "approvals",
    label: "Approvals",
    state: approvals.overdue > 0 ? TenantHealthStates.WARNING : TenantHealthStates.HEALTHY,
    detail:
      approvals.pending === 0
        ? "No pending approvals."
        : `${approvals.pending} pending (${approvals.overdue} over ${APPROVAL_OVERDUE_HOURS / 24} days old).`,
  });

  dimensions.push({
    key: "background_jobs",
    label: "Background jobs",
    state: jobFailures > 0 ? TenantHealthStates.WARNING : TenantHealthStates.HEALTHY,
    detail: `${jobFailures} failed job(s) in the last 24h.`,
  });

  return dimensions;
}
