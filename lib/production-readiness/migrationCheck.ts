import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type MigrationCheckResult = {
  migration: string;
  table: string;
  applied: boolean;
  /** True only when the failure looks like "relation does not exist" (safe to say "not applied"). */
  confirmedMissing: boolean;
  detail: string;
};

/**
 * Detects whether migration 031 (customer_setup_preferences) has been applied,
 * via a bounded, non-destructive metadata probe (select of zero rows). Requires a
 * service-role client — RLS would otherwise make an empty result ambiguous between
 * "table missing" and "no rows visible to this caller".
 *
 * Extend this list if a future migration needs the same kind of runtime detection;
 * do not add a full schema dump here — probe only what operators need to know before
 * pilot/schedule activation.
 */
export async function checkMigration031Applied(
  supabase: SupabaseClient
): Promise<MigrationCheckResult> {
  const { error } = await supabase
    .from("customer_setup_preferences")
    .select("id", { head: true, count: "exact" })
    .limit(0);

  if (!error) {
    return {
      migration: "031_customer_setup_preferences",
      table: "customer_setup_preferences",
      applied: true,
      confirmedMissing: false,
      detail: "customer_setup_preferences is reachable.",
    };
  }

  // Postgres/PostgREST "relation does not exist" surfaces as code 42P01 (or PostgREST's
  // PGRST205 wrapper). Anything else (network, auth, RLS) is a different failure mode —
  // do not claim "not applied" for those, since that would misdirect an operator.
  const code = (error as { code?: string }).code ?? "";
  const message = error.message ?? "";
  const looksLikeMissingTable =
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|could not find the table/i.test(message);

  return {
    migration: "031_customer_setup_preferences",
    table: "customer_setup_preferences",
    applied: false,
    confirmedMissing: looksLikeMissingTable,
    detail: looksLikeMissingTable
      ? "customer_setup_preferences does not exist — migration 031 has not been applied."
      : `Could not confirm migration 031 status: ${message.slice(0, 200)}`,
  };
}
