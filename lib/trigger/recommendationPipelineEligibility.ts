import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TRUST BOUNDARY: cross-tenant privileged read of onboarded businesses for pipeline
 * fan-out. Must only be called with an explicitly supplied privileged client
 * (lib/supabase/service.ts). No default client — same silent-failure avoidance pattern
 * as lib/analytics/analyticsEligibility.ts.
 */

export type PipelineEligibleTenant = {
  userId: string;
  businessProfileId: string;
};

export type PipelineEligibilityOptions = {
  /** Max tenants to return after deterministic sort. Default 100. */
  limit?: number;
};

const DEFAULT_LIMIT = 100;

/**
 * Returns onboarded businesses eligible for a scheduled recommendation-pipeline run,
 * sorted by userId for stable fan-out ordering. Read-only.
 */
export async function getOnboardedBusinessesForPipeline(
  supabase: SupabaseClient,
  options?: PipelineEligibilityOptions
): Promise<PipelineEligibleTenant[]> {
  const limit = options?.limit ?? DEFAULT_LIMIT;

  const { data: profiles, error } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("onboarding_completed", true);

  if (error) {
    throw new Error(
      `getOnboardedBusinessesForPipeline: failed to read business_profiles (${error.message ?? error}). This usually means the supplied client is not privileged enough to bypass RLS for a cross-tenant read.`
    );
  }

  const tenants = (profiles ?? []).map((row) => ({
    userId: String((row as { user_id: unknown }).user_id),
    businessProfileId: String((row as { id: unknown }).id),
  }));

  tenants.sort((a, b) => a.userId.localeCompare(b.userId));
  return tenants.slice(0, limit);
}
