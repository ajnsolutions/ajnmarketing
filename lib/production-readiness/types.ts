/**
 * Project Magic Phase 3C — production-readiness model types.
 *
 * This is a presentation/aggregation layer over the EXISTING checks in
 * lib/production-health/service.ts, lib/config/validate.ts, and
 * lib/production-readiness/migrationCheck.ts. It does not run new probes beyond
 * what those modules already do (plus one bounded migration-metadata probe) and it
 * does not compute a numeric score — the assisted-pilot launch-readiness score
 * (lib/assisted-pilot/readiness.ts) remains the single source for "should we launch
 * the pilot", and this model deliberately does not duplicate it. This model answers
 * a narrower question: "is the platform itself configured and reachable."
 */

export const ReadinessCategories = {
  PLATFORM_CONFIGURATION: "platform_configuration",
  DATABASE: "database",
  MIGRATIONS: "migrations",
  AUTHENTICATION: "authentication",
  GOOGLE_OAUTH: "google_oauth",
  CONNECTION_STORAGE: "connection_storage",
  ENCRYPTION: "encryption",
  TRIGGER_DEV: "trigger_dev",
  SCHEDULE_ATTACHMENT: "schedule_attachment",
  ANALYTICS: "analytics",
  PUBLISHING: "publishing",
  RECOMMENDATION_PIPELINE: "recommendation_pipeline",
  APPROVAL_LINKS: "approval_links",
  EMAIL_DELIVERY: "email_delivery",
  CUSTOMER_SETUP: "customer_setup",
  PILOT_OPERATIONS: "pilot_operations",
} as const;

export type ReadinessCategory =
  (typeof ReadinessCategories)[keyof typeof ReadinessCategories];

export const ReadinessStatuses = {
  READY: "ready",
  READY_WITH_WARNINGS: "ready_with_warnings",
  NEEDS_ATTENTION: "needs_attention",
  BLOCKED: "blocked",
  NOT_CONFIGURED: "not_configured",
  DEGRADED: "degraded",
  UNKNOWN: "unknown",
  INTENTIONALLY_DISABLED: "intentionally_disabled",
} as const;

export type ReadinessStatus = (typeof ReadinessStatuses)[keyof typeof ReadinessStatuses];

/** Worst-to-best ordering used to compute an overall rollup status. */
export const READINESS_SEVERITY_ORDER: readonly ReadinessStatus[] = [
  ReadinessStatuses.BLOCKED,
  ReadinessStatuses.NEEDS_ATTENTION,
  ReadinessStatuses.DEGRADED,
  ReadinessStatuses.UNKNOWN,
  ReadinessStatuses.READY_WITH_WARNINGS,
  ReadinessStatuses.NOT_CONFIGURED,
  ReadinessStatuses.INTENTIONALLY_DISABLED,
  ReadinessStatuses.READY,
];

export type ReadinessSeverity = "info" | "low" | "medium" | "high" | "critical";

export type ReadinessItem = {
  key: string;
  category: ReadinessCategory;
  label: string;
  status: ReadinessStatus;
  reason: string;
  impact: string;
  recoveryAction: string;
  blocksPilot: boolean;
  blocksScheduleActivation: boolean;
  lastCheckedAt: string;
  evidenceSource: string;
  severity: ReadinessSeverity;
  /** Extra detail intended for authorized admins only — never render to customers. */
  technicalDetail?: string;
  runbookRef?: string;
};

export type ProductionReadinessSummary = {
  generatedAt: string;
  correlationId: string;
  overallStatus: ReadinessStatus;
  scheduleGateOpen: boolean;
  items: ReadinessItem[];
  blockers: ReadinessItem[];
  scheduleActivationBlockers: ReadinessItem[];
  /** Pass-through pointer only — the score itself is computed by lib/assisted-pilot/readiness.ts. */
  pilotReadiness: {
    scoreAvailable: boolean;
    score: number | null;
    recommendation: string | null;
  };
};
