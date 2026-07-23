import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCorrelationId } from "@/lib/observability/workflowLogger";
import { runProductionHealthChecks } from "@/lib/production-health/service";
import type { HealthCheckResult, HealthStatus } from "@/lib/production-health/types";
import { validateServerConfig } from "@/lib/config/validate";
import { checkMigration031Applied } from "@/lib/production-readiness/migrationCheck";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";
import {
  READINESS_SEVERITY_ORDER,
  ReadinessCategories,
  ReadinessStatuses,
  type ProductionReadinessSummary,
  type ReadinessCategory,
  type ReadinessItem,
  type ReadinessStatus,
} from "@/lib/production-readiness/types";

const RUNBOOK_BASE = "docs/RUNBOOKS.md";

function overallStatus(items: ReadinessItem[]): ReadinessStatus {
  for (const candidate of READINESS_SEVERITY_ORDER) {
    if (items.some((item) => item.status === candidate)) return candidate;
  }
  return ReadinessStatuses.READY;
}

/** Maps the existing flat healthy/warning/critical scale onto the richer status set. */
function fromHealthStatus(
  status: HealthStatus,
  configured: boolean
): ReadinessStatus {
  if (!configured) return ReadinessStatuses.NOT_CONFIGURED;
  if (status === "critical") return ReadinessStatuses.BLOCKED;
  if (status === "warning") return ReadinessStatuses.READY_WITH_WARNINGS;
  return ReadinessStatuses.READY;
}

function severityFor(status: ReadinessStatus): ReadinessItem["severity"] {
  switch (status) {
    case ReadinessStatuses.BLOCKED:
      return "critical";
    case ReadinessStatuses.NEEDS_ATTENTION:
    case ReadinessStatuses.DEGRADED:
      return "high";
    case ReadinessStatuses.READY_WITH_WARNINGS:
    case ReadinessStatuses.NOT_CONFIGURED:
      return "medium";
    case ReadinessStatuses.UNKNOWN:
      return "low";
    default:
      return "info";
  }
}

function healthCheckToItem(
  key: string,
  category: ReadinessCategory,
  label: string,
  check: HealthCheckResult | undefined,
  opts: {
    recoveryAction: string;
    impact: string;
    blocksPilot: boolean;
    blocksScheduleActivation: boolean;
    runbookRef?: string;
    configured?: boolean;
  }
): ReadinessItem {
  const status = check
    ? fromHealthStatus(check.status, opts.configured ?? true)
    : ReadinessStatuses.UNKNOWN;
  return {
    key,
    category,
    label,
    status,
    reason: check?.diagnostic ?? "No health-check result was available for this category.",
    impact: opts.impact,
    recoveryAction: opts.recoveryAction,
    blocksPilot: opts.blocksPilot,
    blocksScheduleActivation: opts.blocksScheduleActivation,
    lastCheckedAt: check?.checkedAt ?? new Date().toISOString(),
    evidenceSource: "lib/production-health/service.ts:runProductionHealthChecks",
    severity: severityFor(status),
    runbookRef: opts.runbookRef ? `${RUNBOOK_BASE}#${opts.runbookRef}` : undefined,
  };
}

/**
 * Composes the existing production-health checks + centralized config validation +
 * migration-031 detection into one authoritative, richer-status readiness summary.
 *
 * Deliberately does NOT recompute the assisted-pilot launch-readiness score
 * (lib/assisted-pilot/readiness.ts) — pass it in via `pilotReadiness` if the caller
 * already has it (e.g. app/api/admin/ops/route.ts already builds the pilot dashboard
 * for the summary view). This keeps "is the platform configured" separate from
 * "should we launch the pilot", per Phase 3C's explicit instruction not to create a
 * second, conflicting score.
 */
export async function buildProductionReadinessSummary(input?: {
  probeDatabase?: () => Promise<{ ok: boolean; message: string }>;
  migrationSupabase?: SupabaseClient;
  pilotReadiness?: { score: number; recommendation: string };
}): Promise<ProductionReadinessSummary> {
  const correlationId = createCorrelationId();
  const health = await runProductionHealthChecks({ probeDatabase: input?.probeDatabase });
  const config = validateServerConfig();
  const byCategory = new Map(health.checks.map((c) => [c.category, c]));

  const configKey = (key: string) => config.keys.find((k) => k.key === key);

  const items: ReadinessItem[] = [];

  items.push(
    healthCheckToItem(
      "platform_configuration",
      ReadinessCategories.PLATFORM_CONFIGURATION,
      "Platform configuration",
      byCategory.get("supabase"),
      {
        recoveryAction:
          "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the deployment environment.",
        impact: "Customer-facing pages cannot load without these values.",
        blocksPilot: true,
        blocksScheduleActivation: true,
        runbookRef: "supabase-unavailable",
      }
    )
  );

  items.push(
    healthCheckToItem(
      "database",
      ReadinessCategories.DATABASE,
      "Database connectivity",
      byCategory.get("database"),
      {
        recoveryAction:
          "Confirm SUPABASE_SECRET_KEY is set and the Supabase project is reachable, then re-run readiness.",
        impact: "Admin ops, Trigger.dev tasks, and cross-tenant queries fail without service-role access.",
        blocksPilot: true,
        blocksScheduleActivation: true,
        runbookRef: "secret-key-missing",
      }
    )
  );

  // Migration 031 — bounded metadata probe, only attempted when a service-role client is available.
  if (input?.migrationSupabase) {
    const migration = await checkMigration031Applied(input.migrationSupabase);
    items.push({
      key: "migration_031",
      category: ReadinessCategories.MIGRATIONS,
      label: "Migration 031 — customer setup preferences",
      status: migration.applied
        ? ReadinessStatuses.READY
        : migration.confirmedMissing
          ? ReadinessStatuses.BLOCKED
          : ReadinessStatuses.UNKNOWN,
      reason: migration.detail,
      impact:
        "Guided setup, the dashboard setup card, and Head of Marketing readiness gating all depend on this table.",
      recoveryAction: migration.applied
        ? "No action needed."
        : "Apply supabase/migrations/031_customer_setup_preferences.sql to this environment, then re-run readiness.",
      blocksPilot: !migration.applied,
      blocksScheduleActivation: !migration.applied,
      lastCheckedAt: new Date().toISOString(),
      evidenceSource: "lib/production-readiness/migrationCheck.ts:checkMigration031Applied",
      severity: migration.applied ? "info" : migration.confirmedMissing ? "critical" : "medium",
      runbookRef: `${RUNBOOK_BASE}#migration-031-not-applied`,
    });
  } else {
    items.push({
      key: "migration_031",
      category: ReadinessCategories.MIGRATIONS,
      label: "Migration 031 — customer setup preferences",
      status: ReadinessStatuses.UNKNOWN,
      reason: "No service-role database client was available to probe schema state.",
      impact: "Migration status cannot be confirmed from this environment.",
      recoveryAction: "Configure SUPABASE_SECRET_KEY, then re-run readiness.",
      blocksPilot: false,
      blocksScheduleActivation: false,
      lastCheckedAt: new Date().toISOString(),
      evidenceSource: "lib/production-readiness/migrationCheck.ts:checkMigration031Applied",
      severity: "low",
    });
  }

  const adminAllowlistConfigured = configKey("ADMIN_USER_IDS")?.present ?? false;
  items.push({
    key: "authentication",
    category: ReadinessCategories.AUTHENTICATION,
    label: "Authentication and admin allowlist",
    status: adminAllowlistConfigured
      ? ReadinessStatuses.READY
      : ReadinessStatuses.NEEDS_ATTENTION,
    reason: adminAllowlistConfigured
      ? "ADMIN_USER_IDS is configured."
      : "ADMIN_USER_IDS is not set — no user can reach admin/ops or pilot surfaces.",
    impact: "Without an admin allowlist, operators cannot access ops tooling to validate pilot readiness at all.",
    recoveryAction: "Set ADMIN_USER_IDS to a comma-separated list of authorized Supabase user ids.",
    blocksPilot: !adminAllowlistConfigured,
    blocksScheduleActivation: false,
    lastCheckedAt: new Date().toISOString(),
    evidenceSource: "lib/config/validate.ts:validateServerConfig",
    severity: adminAllowlistConfigured ? "info" : "high",
  });

  items.push(
    healthCheckToItem(
      "google_oauth",
      ReadinessCategories.GOOGLE_OAUTH,
      "Google OAuth configuration",
      byCategory.get("oauth"),
      {
        recoveryAction:
          "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to enable Google Business Profile connections.",
        impact: "Optional — customers can use Head of Marketing without Google; only GBP features are unavailable.",
        blocksPilot: false,
        blocksScheduleActivation: false,
        runbookRef: "google-oauth-unavailable",
      }
    )
  );

  const encryptionConfigured = configKey("TOKEN_ENCRYPTION_KEY")?.present ?? false;
  items.push({
    key: "encryption",
    category: ReadinessCategories.ENCRYPTION,
    label: "Token encryption",
    status: encryptionConfigured ? ReadinessStatuses.READY : ReadinessStatuses.NEEDS_ATTENTION,
    reason: encryptionConfigured
      ? "TOKEN_ENCRYPTION_KEY is configured."
      : "TOKEN_ENCRYPTION_KEY is not set — Google OAuth tokens cannot be stored and signed links fall back to a dedicated secret if present.",
    impact: "Blocks Google Business connection storage; approval links still work if a dedicated signing secret is set.",
    recoveryAction: "Generate and set TOKEN_ENCRYPTION_KEY (openssl rand -hex 32).",
    blocksPilot: false,
    blocksScheduleActivation: false,
    lastCheckedAt: new Date().toISOString(),
    evidenceSource: "lib/config/validate.ts:validateServerConfig",
    severity: encryptionConfigured ? "info" : "medium",
    runbookRef: `${RUNBOOK_BASE}#token-encryption-configuration-missing`,
  });

  items.push(
    healthCheckToItem(
      "trigger_dev",
      ReadinessCategories.TRIGGER_DEV,
      "Trigger.dev configuration",
      byCategory.get("trigger_dev"),
      {
        recoveryAction: "Set TRIGGER_SECRET_KEY to enable task triggering and run-health lookups.",
        impact: "Without this, admin-triggered tasks and per-subsystem health lookups fail; manual sync/regenerate actions are unavailable.",
        blocksPilot: true,
        blocksScheduleActivation: true,
        runbookRef: "trigger-dev-unavailable",
      }
    )
  );

  items.push({
    key: "schedule_attachment",
    category: ReadinessCategories.SCHEDULE_ATTACHMENT,
    label: "Declarative production schedule gate",
    status: ATTACH_DECLARATIVE_PRODUCTION_CRONS
      ? ReadinessStatuses.BLOCKED
      : ReadinessStatuses.INTENTIONALLY_DISABLED,
    reason: ATTACH_DECLARATIVE_PRODUCTION_CRONS
      ? "ATTACH_DECLARATIVE_PRODUCTION_CRONS is true — production schedules may attach on next deploy. This should not happen outside an approved activation."
      : "ATTACH_DECLARATIVE_PRODUCTION_CRONS is false. Analytics, publishing, and recommendation sweeps have no attached schedule; manual/admin triggering still works.",
    impact: ATTACH_DECLARATIVE_PRODUCTION_CRONS
      ? "Autonomous production sweeps could begin running on the next deploy."
      : "No autonomous production execution occurs. This is the intended pre-pilot state.",
    recoveryAction: ATTACH_DECLARATIVE_PRODUCTION_CRONS
      ? "Set ATTACH_DECLARATIVE_PRODUCTION_CRONS back to false immediately; see rollback runbook."
      : "No action needed until schedule activation is explicitly approved.",
    blocksPilot: false,
    blocksScheduleActivation: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
    lastCheckedAt: new Date().toISOString(),
    evidenceSource: "lib/trigger/scheduleActivation.ts:ATTACH_DECLARATIVE_PRODUCTION_CRONS",
    severity: ATTACH_DECLARATIVE_PRODUCTION_CRONS ? "critical" : "info",
    runbookRef: `${RUNBOOK_BASE}#${ATTACH_DECLARATIVE_PRODUCTION_CRONS ? "schedule-attached-accidentally" : "rollback-after-schedule-activation"}`,
  });

  items.push(
    healthCheckToItem(
      "analytics",
      ReadinessCategories.ANALYTICS,
      "Analytics capture",
      byCategory.get("analytics"),
      {
        recoveryAction: "Trigger analytics capture manually via the pilot dashboard while the schedule gate remains closed.",
        impact: "Analytics freshness on Head of Marketing depends on manual or scheduled capture runs.",
        blocksPilot: false,
        blocksScheduleActivation: false,
        runbookRef: "analytics-stale",
      }
    )
  );

  items.push(
    healthCheckToItem(
      "publishing",
      ReadinessCategories.PUBLISHING,
      "Publishing execution",
      byCategory.get("publishing"),
      {
        recoveryAction: "No action needed — publishing remains explicit/POST-triggered by design.",
        impact: "Publishing only occurs via explicit customer approval or admin-triggered job execution.",
        blocksPilot: false,
        blocksScheduleActivation: false,
        runbookRef: "publishing-job-stuck",
      }
    )
  );

  items.push(
    healthCheckToItem(
      "recommendation_pipeline",
      ReadinessCategories.RECOMMENDATION_PIPELINE,
      "Recommendation pipeline",
      byCategory.get("recommendation_engine"),
      {
        recoveryAction: "Trigger the pipeline manually via /api/admin/trigger-recommendation-pipeline while the schedule gate remains closed.",
        impact: "New recommendations require a manual or scheduled pipeline run per tenant.",
        blocksPilot: false,
        blocksScheduleActivation: false,
        runbookRef: "recommendation-pipeline-failing",
      }
    )
  );

  const approvalSigningConfigured =
    (configKey("WEEKLY_APPROVAL_LINK_SECRET")?.present ?? false) ||
    (configKey("EMAIL_ACTION_TOKEN_SECRET")?.present ?? false) ||
    encryptionConfigured;
  items.push({
    key: "approval_links",
    category: ReadinessCategories.APPROVAL_LINKS,
    label: "Signed approval links",
    status: approvalSigningConfigured ? ReadinessStatuses.READY : ReadinessStatuses.BLOCKED,
    reason: approvalSigningConfigured
      ? "A signing secret is configured for weekly package / one-click email approval links."
      : "No signing secret configured (WEEKLY_APPROVAL_LINK_SECRET, EMAIL_ACTION_TOKEN_SECRET, or TOKEN_ENCRYPTION_KEY) — signed links cannot be minted.",
    impact: "Weekly approval emails and one-click approval links cannot be generated without a signing secret.",
    recoveryAction: "Set WEEKLY_APPROVAL_LINK_SECRET or TOKEN_ENCRYPTION_KEY.",
    blocksPilot: !approvalSigningConfigured,
    blocksScheduleActivation: false,
    lastCheckedAt: new Date().toISOString(),
    evidenceSource: "lib/config/validate.ts:validateServerConfig",
    severity: approvalSigningConfigured ? "info" : "critical",
    runbookRef: `${RUNBOOK_BASE}#approval-link-expired`,
  });

  items.push(
    healthCheckToItem(
      "email_delivery",
      ReadinessCategories.EMAIL_DELIVERY,
      "Email delivery",
      byCategory.get("email"),
      {
        recoveryAction: "No outbound mail provider is wired yet — approval package generation/preview still works without it.",
        impact: "Weekly approval package generation and preview work today; outbound send is intentionally not activated.",
        blocksPilot: false,
        blocksScheduleActivation: false,
        runbookRef: "email-delivery-unavailable",
      }
    )
  );

  // Customer setup readiness is tracked per-tenant (lib/customer-setup) — platform-level
  // readiness here only reflects whether the underlying table/API surface is reachable.
  const migrationItem = items.find((item) => item.key === "migration_031")!;
  items.push({
    key: "customer_setup",
    category: ReadinessCategories.CUSTOMER_SETUP,
    label: "Guided customer setup",
    status: migrationItem.status,
    reason: migrationItem.reason,
    impact: "Per-tenant setup completeness is tracked separately — see tenant operational health.",
    recoveryAction: migrationItem.recoveryAction,
    blocksPilot: migrationItem.blocksPilot,
    blocksScheduleActivation: false,
    lastCheckedAt: migrationItem.lastCheckedAt,
    evidenceSource: "lib/customer-setup/service.ts:getCustomerSetupSnapshotForUser",
    severity: migrationItem.severity,
  });

  const configuredAllowlistId = configKey("ADMIN_USER_IDS")?.present ?? false;
  items.push({
    key: "pilot_operations",
    category: ReadinessCategories.PILOT_OPERATIONS,
    label: "Pilot operations tooling",
    status: configuredAllowlistId ? ReadinessStatuses.READY : ReadinessStatuses.NOT_CONFIGURED,
    reason: configuredAllowlistId
      ? "Assisted-pilot dashboard, checklist, and manual actions are reachable to allowlisted admins."
      : "No admin can reach the assisted-pilot dashboard until ADMIN_USER_IDS is set.",
    impact: "Operators need this to register pilot tenants, run manual actions, and track pilot issues.",
    recoveryAction: "Set ADMIN_USER_IDS; then open /dashboard/admin/ops to register a pilot tenant.",
    blocksPilot: !configuredAllowlistId,
    blocksScheduleActivation: false,
    lastCheckedAt: new Date().toISOString(),
    evidenceSource: "lib/assisted-pilot/service.ts:buildAssistedPilotDashboard",
    severity: configuredAllowlistId ? "info" : "high",
  });

  const blockers = items.filter((item) => item.status === ReadinessStatuses.BLOCKED);
  const scheduleActivationBlockers = items.filter((item) => item.blocksScheduleActivation);

  return {
    generatedAt: new Date().toISOString(),
    correlationId,
    overallStatus: overallStatus(items),
    scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
    items,
    blockers,
    scheduleActivationBlockers,
    pilotReadiness: {
      scoreAvailable: Boolean(input?.pilotReadiness),
      score: input?.pilotReadiness?.score ?? null,
      recommendation: input?.pilotReadiness?.recommendation ?? null,
    },
  };
}
