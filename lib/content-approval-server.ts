import {
  getContentApprovalStatsForCurrentUser,
  getContentApprovalsForCurrentUser,
} from "@/lib/content-approval/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { getRecommendationDecisionPackagesForApprovals } from "@/lib/recommendation-presentation/service";
import type { ClientRecommendationDecisionPackage } from "@/lib/recommendation-presentation/types";
import { createClient } from "@/lib/supabase/server";

export async function getApprovalDashboardData() {
  const [approvals, stats] = await Promise.all([
    getContentApprovalsForCurrentUser(),
    getContentApprovalStatsForCurrentUser(),
  ]);

  const businessProfile = await getBusinessProfileForUser();
  const packagesMap = businessProfile
    ? await getRecommendationDecisionPackagesForApprovals(
        businessProfile.user_id,
        businessProfile.id,
        approvals,
        await createClient()
      )
    : new Map<string, ClientRecommendationDecisionPackage>();

  // Plain object, not a Map -- this crosses the server/client component boundary as a
  // prop, and a Map isn't a convention already used for that in this codebase.
  const recommendationPackagesByApprovalId: Record<string, ClientRecommendationDecisionPackage> =
    Object.fromEntries(packagesMap);

  return { approvals, stats, recommendationPackagesByApprovalId };
}
