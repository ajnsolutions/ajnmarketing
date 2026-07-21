import "server-only";

/**
 * Centralized, allowlisted server configuration validation (Project Magic Phase 3C).
 *
 * This does NOT replace lib/production-health/service.ts's existing env-presence
 * checks (those stay as-is — they are unit-tested and already surfaced on
 * /api/health and the ops dashboard). This module exists because Phase 3C's
 * production-readiness model (lib/production-readiness/model.ts) needs a single,
 * typed, allowlisted view of *which keys* are required/optional/environment-scoped,
 * with distinct missing-vs-malformed detection — a level of detail the flat health
 * checks intentionally don't carry. Values are never returned or logged; only
 * presence/shape is reported.
 */

export type ConfigRequirement = "required" | "optional" | "conditionally_required";

export type ConfigEnvironmentScope = "development" | "preview" | "production" | "all";

export type ConfigKeyResult = {
  key: string;
  label: string;
  requirement: ConfigRequirement;
  environmentScope: ConfigEnvironmentScope;
  present: boolean;
  malformed: boolean;
  note?: string;
};

export type ConfigValidationReport = {
  generatedAt: string;
  keys: ConfigKeyResult[];
  missingRequired: string[];
  malformedKeys: string[];
};

type ConfigKeyDefinition = {
  key: string;
  label: string;
  requirement: ConfigRequirement;
  environmentScope: ConfigEnvironmentScope;
  /** Optional shape check beyond simple presence — never inspects the value in output. */
  validate?: (value: string) => boolean;
  note?: string;
};

function isUrlLike(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * One source of truth for which server keys this application actually reads.
 * Keep in sync with docs/LAUNCH_CHECKLIST.md when keys change.
 */
const CONFIG_KEYS: readonly ConfigKeyDefinition[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Supabase project URL",
    requirement: "required",
    environmentScope: "all",
    validate: isUrlLike,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Supabase anon key",
    requirement: "required",
    environmentScope: "all",
  },
  {
    key: "SUPABASE_SECRET_KEY",
    label: "Supabase service-role key",
    requirement: "conditionally_required",
    environmentScope: "all",
    note: "Required for Trigger.dev tasks, admin ops, and pilot tooling. Not needed for basic customer-facing pages.",
  },
  {
    key: "TOKEN_ENCRYPTION_KEY",
    label: "Token encryption key",
    requirement: "conditionally_required",
    environmentScope: "all",
    note: "Required before storing Google Business OAuth tokens or minting signed approval links (unless a dedicated signing secret is set).",
  },
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google OAuth client ID",
    requirement: "optional",
    environmentScope: "all",
    note: "Required only to enable Google Business Profile connection.",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    label: "Google OAuth client secret",
    requirement: "optional",
    environmentScope: "all",
  },
  {
    key: "GOOGLE_REDIRECT_URI",
    label: "Google OAuth redirect URI",
    requirement: "optional",
    environmentScope: "all",
    validate: isUrlLike,
  },
  {
    key: "TRIGGER_SECRET_KEY",
    label: "Trigger.dev secret key",
    requirement: "conditionally_required",
    environmentScope: "all",
    note: "Required to trigger or observe background tasks. Declarative production schedules stay gated by ATTACH_DECLARATIVE_PRODUCTION_CRONS regardless of this key.",
  },
  {
    key: "WEEKLY_APPROVAL_LINK_SECRET",
    label: "Weekly approval link signing secret",
    requirement: "optional",
    environmentScope: "all",
    note: "Falls back to TOKEN_ENCRYPTION_KEY if unset.",
  },
  {
    key: "EMAIL_ACTION_TOKEN_SECRET",
    label: "One-click email action signing secret",
    requirement: "optional",
    environmentScope: "all",
    note: "Falls back to TOKEN_ENCRYPTION_KEY if unset.",
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    label: "Application base URL",
    requirement: "optional",
    environmentScope: "all",
    validate: isUrlLike,
    note: "Used to build absolute links in emails and signed approval URLs.",
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API key",
    requirement: "optional",
    environmentScope: "all",
    note: "Required for AI-assisted drafting and analysis features.",
  },
  {
    key: "ADMIN_USER_IDS",
    label: "Admin user allowlist",
    requirement: "conditionally_required",
    environmentScope: "all",
    note: "Required to access any /dashboard/admin or /api/admin/* surface.",
  },
] as const;

/**
 * Validates only configuration this application actually reads (see CONFIG_KEYS).
 * Never returns values — presence/shape only. Safe to expose key *names* to
 * authorized admins; never expose this report to customer-facing users.
 */
export function validateServerConfig(
  env: NodeJS.ProcessEnv = process.env
): ConfigValidationReport {
  const keys: ConfigKeyResult[] = CONFIG_KEYS.map((def) => {
    const raw = env[def.key]?.trim();
    const present = Boolean(raw);
    const malformed = present && def.validate ? !def.validate(raw as string) : false;
    return {
      key: def.key,
      label: def.label,
      requirement: def.requirement,
      environmentScope: def.environmentScope,
      present,
      malformed,
      note: def.note,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    keys,
    missingRequired: keys
      .filter((k) => k.requirement === "required" && !k.present)
      .map((k) => k.key),
    malformedKeys: keys.filter((k) => k.malformed).map((k) => k.key),
  };
}
