import type { GoogleBusinessDashboardData } from "@/lib/google-business/types";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories, OpportunitySeverities } from "@/lib/marketing-opportunities/types";

/** Fires when a connected business has received zero new Google reviews this month. */
export function detectLowReviewActivity(
  gbpData: GoogleBusinessDashboardData
): MarketingOpportunityDraft[] {
  if (!gbpData.connected) return [];

  const { reviewCount, newReviewsThisMonth } = gbpData.reviewSummary;
  if (newReviewsThisMonth > 0) return [];

  return [
    {
      category: OpportunityCategories.LOW_REVIEW_ACTIVITY,
      severity: reviewCount === 0 ? OpportunitySeverities.HIGH : OpportunitySeverities.MEDIUM,
      confidence: 75,
      title: reviewCount === 0 ? "No Google reviews yet" : "No new reviews this month",
      description:
        reviewCount === 0
          ? "This business has no Google reviews. Reviews are one of the strongest local-search ranking and trust signals."
          : `${reviewCount} total review(s), but none added this month. A steady trickle of new reviews matters more to ranking than total count alone.`,
      evidence: { reviewCount, newReviewsThisMonth },
      recommendedAction:
        "Ask recent customers for a Google review, or send a review-request text/email after service completion.",
      expiresAt: null,
      dedupeKey: "current",
    },
  ];
}
