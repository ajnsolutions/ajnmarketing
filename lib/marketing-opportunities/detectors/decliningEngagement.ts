import type { AnalyticsSnapshot } from "@/lib/analytics/analyticsTypes";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories, OpportunitySeverities } from "@/lib/marketing-opportunities/types";

/**
 * Fires when the latest analytics snapshot's engagement_score dropped versus the
 * previous one. Expects `snapshots` ordered most-recent-first (matches
 * getAnalyticsSnapshotsForUser's default order) — needs at least two snapshots to have
 * anything to compare.
 */
export function detectDecliningEngagement(snapshots: AnalyticsSnapshot[]): MarketingOpportunityDraft[] {
  const [latest, previous] = snapshots;
  if (!latest || !previous) return [];

  const scoreDelta = latest.engagement_score - previous.engagement_score;
  if (scoreDelta >= 0) return [];

  const viewsDelta = latest.google_views - previous.google_views;
  const percentDecline =
    previous.engagement_score > 0
      ? Math.round((Math.abs(scoreDelta) / previous.engagement_score) * 100)
      : 0;

  const severity =
    percentDecline >= 30
      ? OpportunitySeverities.CRITICAL
      : percentDecline >= 15
        ? OpportunitySeverities.HIGH
        : OpportunitySeverities.MEDIUM;

  return [
    {
      category: OpportunityCategories.DECLINING_ENGAGEMENT,
      severity,
      confidence: 70,
      title: "Google Business engagement is declining",
      description: `Engagement score dropped from ${previous.engagement_score} to ${latest.engagement_score} (${percentDecline}% decrease) since the ${previous.snapshot_date} snapshot. Profile views changed by ${viewsDelta}.`,
      evidence: {
        latestSnapshotDate: latest.snapshot_date,
        previousSnapshotDate: previous.snapshot_date,
        latestScore: latest.engagement_score,
        previousScore: previous.engagement_score,
        percentDecline,
        viewsDelta,
      },
      recommendedAction:
        "Increase posting frequency and review-response speed; refresh promoted content topics to what's currently performing.",
      expiresAt: null,
      // One per day a decline is observed -- re-running detection the same day updates
      // the same row instead of duplicating; a decline newly observed on a later day
      // (a different snapshot_date) is a distinct, still-relevant opportunity.
      dedupeKey: latest.snapshot_date,
    },
  ];
}
