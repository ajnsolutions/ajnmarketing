import type {
  AnalyticsSnapshot,
  ContentPerformanceRecord,
  PerformanceAnalysis,
} from "@/lib/analytics/analyticsTypes";

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function analyzePerformance(input: {
  latestSnapshot: AnalyticsSnapshot | null;
  previousSnapshot: AnalyticsSnapshot | null;
  contentPerformance: ContentPerformanceRecord[];
  publishingSuccessRate: number | null;
}): PerformanceAnalysis | null {
  if (!input.latestSnapshot) return null;

  const visibilityChangePercent = input.previousSnapshot
    ? percentChange(
        input.latestSnapshot.google_views,
        input.previousSnapshot.google_views
      )
    : null;

  const reviewVelocity =
    input.latestSnapshot.review_count -
    (input.previousSnapshot?.review_count ?? input.latestSnapshot.review_count);

  const sorted = [...input.contentPerformance].sort(
    (a, b) => b.performance_score - a.performance_score
  );
  const contentWinners = sorted.filter((item) => item.performance_score >= 60).slice(0, 3);
  const contentUnderperformers = sorted
    .filter((item) => item.performance_score > 0 && item.performance_score < 45)
    .slice(0, 3);

  const opportunityScore = Math.min(
    100,
    Math.round(
      input.latestSnapshot.engagement_score * 0.45 +
        (visibilityChangePercent && visibilityChangePercent > 0
          ? Math.min(visibilityChangePercent, 30)
          : 10) +
        (input.publishingSuccessRate ?? 50) * 0.25 +
        (contentWinners.length > 0 ? 10 : 0)
    )
  );

  const summaryParts = [
    `Engagement score is ${Math.round(input.latestSnapshot.engagement_score)}/100.`,
    visibilityChangePercent != null
      ? `Google visibility changed ${visibilityChangePercent >= 0 ? "up" : "down"} ${Math.abs(visibilityChangePercent)}% versus the prior snapshot.`
      : "Baseline visibility snapshot captured.",
    contentWinners.length > 0
      ? `${contentWinners.length} content winner(s) identified.`
      : "No strong content winners yet — publish and sync more data.",
  ];

  return {
    opportunityScore,
    engagementScore: input.latestSnapshot.engagement_score,
    publishingSuccessRate: input.publishingSuccessRate,
    visibilityChangePercent,
    reviewVelocity,
    contentWinners,
    contentUnderperformers,
    summary: summaryParts.join(" "),
  };
}

export function computeEngagementScore(input: {
  googleViews: number;
  websiteClicks: number;
  phoneCalls: number;
  directionRequests: number;
  reviewCount: number;
  averageRating: number | null;
  postsPublished: number;
}): number {
  const visibility = Math.min(35, Math.round((input.googleViews / 500) * 35));
  const actions = Math.min(
    25,
    Math.round(((input.websiteClicks + input.phoneCalls + input.directionRequests) / 50) * 25)
  );
  const reviews = Math.min(
    20,
    (input.averageRating ?? 0) * 4 + Math.min(input.reviewCount, 10)
  );
  const publishing = Math.min(20, input.postsPublished * 4);

  return Math.max(0, Math.min(100, visibility + actions + reviews + publishing));
}
