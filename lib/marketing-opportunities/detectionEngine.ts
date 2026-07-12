import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessProfileForUserId } from "@/lib/business-profile-server";
import { getGoogleBusinessDashboardDataForUser } from "@/lib/google-business/service";
import { getAnalyticsSnapshotsForUser } from "@/lib/analytics/analyticsPersistence";
import { getWebsiteAnalysisForUser } from "@/lib/website-analysis/persistence";
import { getRecentMarketContextItemsForUser } from "@/lib/marketing-opportunities/marketContextQuery";
import {
  closeExpiredMarketingOpportunities,
  upsertMarketingOpportunity,
} from "@/lib/marketing-opportunities/persistence";
import type { MarketingOpportunity } from "@/lib/marketing-opportunities/types";
import { logAuditEvent, auditErrorMetadata } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";
import { createClient } from "@/lib/supabase/server";

import { detectMissingGbpPosts } from "@/lib/marketing-opportunities/detectors/missingGbpPosts";
import { detectLowReviewActivity } from "@/lib/marketing-opportunities/detectors/lowReviewActivity";
import { detectSeasonalOpportunity } from "@/lib/marketing-opportunities/detectors/seasonal";
import { detectHolidayOpportunities } from "@/lib/marketing-opportunities/detectors/holiday";
import { detectWeatherOpportunity } from "@/lib/marketing-opportunities/detectors/weather";
import { detectLocalEventOpportunities } from "@/lib/marketing-opportunities/detectors/localEvent";
import { detectDecliningEngagement } from "@/lib/marketing-opportunities/detectors/decliningEngagement";
import { detectMissingBusinessInfo } from "@/lib/marketing-opportunities/detectors/missingBusinessInfo";
import { detectMissingPhotos } from "@/lib/marketing-opportunities/detectors/missingPhotos";
import { detectStaleWebsiteContent } from "@/lib/marketing-opportunities/detectors/staleWebsiteContent";

export type OpportunityDetectionResult = {
  businessProfileId: string;
  opportunities: MarketingOpportunity[];
  expiredCount: number;
};

/**
 * Evaluates one business against all ten opportunity detectors and persists the
 * results. Accepts an optional injected Supabase client — omitted, it defaults to the
 * request-scoped cookie client exactly like every other *ForUser function in this
 * codebase; pass a service-role client (lib/supabase/service.ts) to run this for any
 * tenant from background-job or Trigger.dev execution with no cookies or session.
 *
 * Every database access in this function and everything it calls is threaded through
 * the same client — there is no internal fallback that silently constructs its own
 * request-scoped client partway through.
 *
 * Returns null if the user has no business profile yet (nothing to evaluate) rather
 * than throwing — mirrors captureSnapshotForUser's graceful-degradation contract.
 */
export async function evaluateOpportunitiesForUser(
  userId: string,
  supabaseClient?: SupabaseClient,
  now: Date = new Date()
): Promise<OpportunityDetectionResult | null> {
  const supabase = supabaseClient ?? (await createClient());

  const businessProfile = await getBusinessProfileForUserId(supabase, userId);
  if (!businessProfile) {
    return null;
  }

  await logAuditEvent(supabase, {
    userId,
    businessProfileId: businessProfile.id,
    action: AuditActions.MARKETING_OPPORTUNITIES_DETECTION_STARTED,
    entityType: "marketing_opportunity",
    status: "started",
  });

  try {
    // Close out anything whose time window has passed before evaluating what's
    // currently relevant, so a stale opportunity never sits open indefinitely.
    const expiredCount = await closeExpiredMarketingOpportunities(supabase, userId, now);

    const [gbpData, snapshots, websiteAnalysis, marketContextItems] = await Promise.all([
      getGoogleBusinessDashboardDataForUser(userId, supabase),
      getAnalyticsSnapshotsForUser(supabase, userId, 8),
      getWebsiteAnalysisForUser(supabase, userId),
      getRecentMarketContextItemsForUser(supabase, userId),
    ]);

    const drafts = [
      ...detectMissingGbpPosts(gbpData, now),
      ...detectLowReviewActivity(gbpData),
      ...detectSeasonalOpportunity(businessProfile, now),
      ...detectHolidayOpportunities(marketContextItems, now),
      ...detectWeatherOpportunity(marketContextItems, now),
      ...detectLocalEventOpportunities(marketContextItems, now),
      ...detectDecliningEngagement(snapshots),
      ...detectMissingBusinessInfo(businessProfile),
      ...detectMissingPhotos(gbpData),
      ...detectStaleWebsiteContent(websiteAnalysis, now),
    ];

    const opportunities: MarketingOpportunity[] = [];
    for (const draft of drafts) {
      opportunities.push(
        await upsertMarketingOpportunity(supabase, userId, businessProfile.id, draft)
      );
    }

    await logAuditEvent(supabase, {
      userId,
      businessProfileId: businessProfile.id,
      action: AuditActions.MARKETING_OPPORTUNITIES_DETECTION_COMPLETED,
      entityType: "marketing_opportunity",
      status: "success",
      metadata: {
        opportunityCount: opportunities.length,
        expiredCount,
        categories: Array.from(new Set(opportunities.map((o) => o.category))),
      },
    });

    return { businessProfileId: businessProfile.id, opportunities, expiredCount };
  } catch (error) {
    await logAuditEvent(supabase, {
      userId,
      businessProfileId: businessProfile.id,
      action: AuditActions.MARKETING_OPPORTUNITIES_DETECTION_FAILED,
      entityType: "marketing_opportunity",
      status: "failure",
      metadata: auditErrorMetadata(error, "Marketing opportunity detection failed"),
    });
    throw error;
  }
}

/** Current-user wrapper: resolves the session, then delegates. Unchanged cookie-bound contract. */
export async function evaluateOpportunitiesForCurrentUser(): Promise<OpportunityDetectionResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return evaluateOpportunitiesForUser(user.id, supabase);
}
