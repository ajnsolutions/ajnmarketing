import "server-only";

/**
 * Business Discovery source gathering — the only I/O in this feature. Fetches
 * every existing source in parallel and hands the bundle to collectors.ts.
 *
 * Deliberately thin: every fetch here calls an existing, already-reviewed
 * accessor (getBusinessProfileForUserId, getWebsiteAnalysisForUser, ...) —
 * this file introduces no new database access pattern and no new tenant-
 * isolation logic. Each accessor already scopes to `userId` the same way the
 * rest of the product does.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import { getGoogleBusinessProfileConnectionStatusForUser } from "@/lib/google-business-profile/service";
import { getGoogleBusinessReviewsForUser } from "@/lib/google-business/persistence";
import { getLatestMarketContextBriefForUser } from "@/lib/market-context/marketContextService";
import type { BusinessDiscoverySources } from "@/lib/business-discovery/types";

const PUBLIC_REVIEW_LIMIT = 50;

/**
 * Fetches every currently-available Business Discovery source for one user, in
 * parallel. Every accessor already fails soft (returns null/empty on error or
 * absence) — Business Discovery must run honestly for a business with only one
 * or two sources connected, so no individual failure here should throw.
 */
export async function gatherBusinessDiscoverySources(
  supabase: SupabaseClient,
  userId: string
): Promise<BusinessDiscoverySources> {
  const [businessProfile, websiteAnalysis, aiMarketingProfile, googleBusinessConnection, publicReviews, marketContext] =
    await Promise.all([
      getBusinessProfileForUserId(supabase, userId),
      getWebsiteAnalysisForUser(supabase, userId),
      getAiMarketingProfileForUser(supabase, userId),
      getGoogleBusinessProfileConnectionStatusForUser(userId, supabase),
      getGoogleBusinessReviewsForUser(supabase, userId, PUBLIC_REVIEW_LIMIT),
      getLatestMarketContextBriefForUser(userId),
    ]);

  return {
    businessProfile,
    websiteAnalysis,
    aiMarketingProfile,
    googleBusinessConnection,
    publicReviews,
    marketContext,
  };
}
