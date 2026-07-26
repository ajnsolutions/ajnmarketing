import "server-only";

/**
 * AI Business Discovery — orchestration service.
 *
 * This is the foundation of the future Free Marketing Snapshot (see
 * docs/project-magic/FREE_MARKETING_SNAPSHOT.md and
 * docs/BUSINESS_DISCOVERY_ENGINE.md). It composes existing intelligence —
 * website analysis, the AI Marketing Profile, Google Business Profile
 * connection state, public reviews, Market Context — into one honest,
 * explainable read of a business.
 *
 * Pipeline: gather (I/O) -> collect (pure) -> normalize (pure) -> build result
 * (pure). Only this file and gather.ts touch Supabase; every other module in
 * lib/business-discovery/ is pure and unit-tested without a database.
 *
 * This service makes no decisions and takes no actions. It does not write
 * anything, does not trigger a website analysis or AI Marketing Profile
 * generation, and does not compete with Marketing Director as a second
 * decision engine — it only reads and explains what already exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { gatherBusinessDiscoverySources } from "@/lib/business-discovery/gather";
import { collectBusinessDiscoveryObservations } from "@/lib/business-discovery/collectors";
import { normalizeBusinessDiscoveryObservations } from "@/lib/business-discovery/normalize";
import { buildBusinessDiscoveryResult } from "@/lib/business-discovery/buildResult";
import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";

/**
 * Runs Business Discovery for an explicit userId + injected client — the
 * variant to call from anywhere that already has both in hand (admin/ops
 * tooling, scheduled/background execution), mirroring the established
 * `*ForUserId` naming convention (see lib/business-profile-server.ts).
 */
export async function runBusinessDiscoveryForUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<BusinessDiscoveryResult | null> {
  const sources = await gatherBusinessDiscoverySources(supabase, userId);
  if (!sources.businessProfile) return null;

  const observations = collectBusinessDiscoveryObservations(sources);
  const unified = normalizeBusinessDiscoveryObservations(sources.businessProfile.id, observations);
  return buildBusinessDiscoveryResult(unified);
}

/**
 * Runs Business Discovery for the current authenticated session — the variant
 * a customer-facing route/page calls, mirroring
 * `getBusinessProfileForUser()`'s current-session pattern.
 */
export async function runBusinessDiscoveryForCurrentUser(): Promise<BusinessDiscoveryResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return runBusinessDiscoveryForUserId(supabase, user.id);
}
