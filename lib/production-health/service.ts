import "server-only";

import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";
import { createCorrelationId } from "@/lib/observability/workflowLogger";
import { getFailureInjectionState } from "@/lib/failure-injection/gate";
import {
  HealthStatuses,
  type HealthCheckResult,
  type HealthStatus,
  type ProductionHealthReport,
} from "@/lib/production-health/types";

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes(HealthStatuses.CRITICAL)) return HealthStatuses.CRITICAL;
  if (statuses.includes(HealthStatuses.WARNING)) return HealthStatuses.WARNING;
  return HealthStatuses.HEALTHY;
}

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function check(
  category: HealthCheckResult["category"],
  status: HealthStatus,
  title: string,
  diagnostic: string,
  details?: Record<string, unknown>
): HealthCheckResult {
  return {
    category,
    status,
    title,
    diagnostic,
    checkedAt: new Date().toISOString(),
    details,
  };
}

/**
 * Production health checks. Never returns secrets. Prefer configuration + safe
 * probes over expensive live API calls.
 */
export async function runProductionHealthChecks(input?: {
  probeDatabase?: () => Promise<{ ok: boolean; message: string }>;
}): Promise<ProductionHealthReport> {
  const correlationId = createCorrelationId();
  const checks: HealthCheckResult[] = [];

  // Database / Supabase config
  const supabaseUrl = envPresent("NEXT_PUBLIC_SUPABASE_URL");
  const anon = envPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const secret = envPresent("SUPABASE_SECRET_KEY");
  checks.push(
    check(
      "supabase",
      supabaseUrl && anon ? HealthStatuses.HEALTHY : HealthStatuses.CRITICAL,
      "Supabase client configuration",
      supabaseUrl && anon
        ? "Public Supabase URL and anon key are configured."
        : "Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  );
  checks.push(
    check(
      "database",
      secret ? HealthStatuses.HEALTHY : HealthStatuses.WARNING,
      "Service-role database access",
      secret
        ? "SUPABASE_SECRET_KEY is configured for background/admin paths."
        : "SUPABASE_SECRET_KEY is not set — Trigger.dev and admin ops cannot query across tenants."
    )
  );

  if (input?.probeDatabase) {
    try {
      const probe = await input.probeDatabase();
      checks.push(
        check(
          "database",
          probe.ok ? HealthStatuses.HEALTHY : HealthStatuses.CRITICAL,
          "Database connectivity probe",
          probe.message
        )
      );
    } catch (error) {
      checks.push(
        check(
          "database",
          HealthStatuses.CRITICAL,
          "Database connectivity probe",
          error instanceof Error ? error.message.slice(0, 200) : "Probe failed."
        )
      );
    }
  }

  // Trigger.dev
  const triggerSecret = envPresent("TRIGGER_SECRET_KEY");
  checks.push(
    check(
      "trigger_dev",
      triggerSecret ? HealthStatuses.HEALTHY : HealthStatuses.WARNING,
      "Trigger.dev credentials",
      triggerSecret
        ? "TRIGGER_SECRET_KEY is present. Declarative production crons remain gated."
        : "TRIGGER_SECRET_KEY is not set — task triggering and run health lookups will fail.",
      { attachDeclarativeProductionCrons: ATTACH_DECLARATIVE_PRODUCTION_CRONS }
    )
  );

  checks.push(
    check(
      "schedules",
      ATTACH_DECLARATIVE_PRODUCTION_CRONS ? HealthStatuses.CRITICAL : HealthStatuses.HEALTHY,
      "Declarative production cron gate",
      ATTACH_DECLARATIVE_PRODUCTION_CRONS
        ? "ATTACH_DECLARATIVE_PRODUCTION_CRONS is true — schedules may activate on deploy."
        : "ATTACH_DECLARATIVE_PRODUCTION_CRONS is false — no production schedules are attached.",
      { attachDeclarativeProductionCrons: ATTACH_DECLARATIVE_PRODUCTION_CRONS }
    )
  );

  // OpenAI
  checks.push(
    check(
      "openai",
      envPresent("OPENAI_API_KEY") ? HealthStatuses.HEALTHY : HealthStatuses.WARNING,
      "OpenAI configuration",
      envPresent("OPENAI_API_KEY")
        ? "OPENAI_API_KEY is configured."
        : "OPENAI_API_KEY is missing — draft generation and several agents will fail."
    )
  );

  // Google / OAuth
  const googleConfigured =
    envPresent("GOOGLE_CLIENT_ID") &&
    envPresent("GOOGLE_CLIENT_SECRET") &&
    envPresent("GOOGLE_REDIRECT_URI");
  checks.push(
    check(
      "oauth",
      googleConfigured ? HealthStatuses.HEALTHY : HealthStatuses.WARNING,
      "Google OAuth configuration",
      googleConfigured
        ? "Google OAuth client credentials and redirect URI are configured."
        : "Google OAuth env vars are incomplete — GBP connect/publish will not work."
    )
  );
  checks.push(
    check(
      "google_business_profile",
      googleConfigured ? HealthStatuses.HEALTHY : HealthStatuses.WARNING,
      "Google Business Profile integration",
      googleConfigured
        ? "GBP provider credentials appear configured (connection status is per-tenant)."
        : "GBP cannot connect until Google OAuth is configured."
    )
  );

  // Publishing / analytics readiness (config-level)
  checks.push(
    check(
      "publishing",
      HealthStatuses.HEALTHY,
      "Publishing execution posture",
      "GET /api/publishing is read-only. Publishing requires explicit POST actions or gated Trigger.dev workers. No auto-publishing is enabled by the cron gate."
    )
  );

  checks.push(
    check(
      "analytics",
      HealthStatuses.HEALTHY,
      "Analytics capture posture",
      "Analytics capture tasks exist but production cron attachment remains disabled."
    )
  );

  // Email / approval tokens
  const emailSecret =
    envPresent("EMAIL_ACTION_TOKEN_SECRET") ||
    envPresent("WEEKLY_APPROVAL_LINK_SECRET") ||
    envPresent("TOKEN_ENCRYPTION_KEY");
  checks.push(
    check(
      "email",
      emailSecret ? HealthStatuses.HEALTHY : HealthStatuses.WARNING,
      "Email action / weekly package signing",
      emailSecret
        ? "At least one signing secret is configured for email/weekly package links. Outbound mail provider is still optional until send is wired."
        : "No signing secret configured — weekly package and one-click email approval links cannot be minted."
    )
  );

  checks.push(
    check(
      "recommendation_engine",
      HealthStatuses.HEALTHY,
      "Recommendation engine posture",
      "Recommendation pipeline code paths are available via admin trigger and gated sweeps. No auto-approval is introduced by production-readiness tooling."
    )
  );

  const injection = getFailureInjectionState();
  if (injection.enabled) {
    checks.push(
      check(
        "schedules",
        HealthStatuses.WARNING,
        "Failure injection",
        `Failure injection is ENABLED with faults: ${injection.activeFaults.join(", ") || "(none selected)"}. Never enable in production.`,
        { activeFaults: injection.activeFaults }
      )
    );
  }

  return {
    overall: worstStatus(checks.map((c) => c.status)),
    checks,
    generatedAt: new Date().toISOString(),
    correlationId,
  };
}
