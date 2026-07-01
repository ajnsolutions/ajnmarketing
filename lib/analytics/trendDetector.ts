import type { AnalyticsSnapshot, ContentPerformanceRecord, TrendSignal } from "@/lib/analytics/analyticsTypes";

function directionFromDelta(delta: number): TrendSignal["direction"] {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "stable";
}

export function detectTrends(input: {
  snapshots: AnalyticsSnapshot[];
  contentPerformance: ContentPerformanceRecord[];
  competitorConfigured: boolean;
  publishingFrequencyPerWeek: number | null;
}): TrendSignal[] {
  const trends: TrendSignal[] = [];
  const latest = input.snapshots[0];
  const previous = input.snapshots[1];

  if (latest && previous) {
    const viewDelta = latest.google_views - previous.google_views;
    trends.push({
      type: "visibility_trend",
      title: "Google visibility trend",
      summary:
        viewDelta >= 0
          ? `Profile views increased by ${viewDelta} since the last snapshot.`
          : `Profile views declined by ${Math.abs(viewDelta)} since the last snapshot.`,
      direction: directionFromDelta(viewDelta),
      confidence: 78,
    });

    const reviewDelta = latest.review_count - previous.review_count;
    trends.push({
      type: "review_trend",
      title: "Review trend",
      summary:
        reviewDelta > 0
          ? `${reviewDelta} new review signal(s) since the last snapshot.`
          : "Review volume is flat — ask satisfied customers for fresh reviews.",
      direction: directionFromDelta(reviewDelta),
      confidence: 72,
    });

    if (viewDelta < 0 || latest.engagement_score < previous.engagement_score) {
      trends.push({
        type: "declining_performance",
        title: "Declining performance signal",
        summary:
          "Engagement or visibility softened versus the prior snapshot. Prioritize proven topics and consistent posting.",
        direction: "down",
        confidence: 70,
      });
    }
  }

  const winners = [...input.contentPerformance]
    .sort((a, b) => b.performance_score - a.performance_score)
    .slice(0, 2);

  if (winners.length > 0) {
    const titles = winners
      .map((item) => String(item.metadata.title ?? "Published post"))
      .join(", ");
    trends.push({
      type: "best_topics",
      title: "Best performing topics",
      summary: `Top content themes recently: ${titles}.`,
      direction: "up",
      confidence: 68,
      metadata: { titles },
    });
  }

  const month = new Date().getMonth() + 1;
  const season =
    month >= 6 && month <= 8
      ? "summer"
      : month >= 11 || month <= 1
        ? "winter"
        : month >= 3 && month <= 5
          ? "spring"
          : "fall";
  trends.push({
    type: "seasonality",
    title: `${season.charAt(0).toUpperCase()}${season.slice(1)} seasonality`,
    summary: `Current season (${season}) may shift local demand and content urgency for your services.`,
    direction: "stable",
    confidence: 65,
    metadata: { season },
  });

  if (input.publishingFrequencyPerWeek != null) {
    trends.push({
      type: "posting_times",
      title: "Posting cadence pattern",
      summary:
        input.publishingFrequencyPerWeek >= 2
          ? "You are maintaining a healthy weekly posting cadence."
          : "Posting cadence is light — more consistent Google posts may improve visibility.",
      direction: input.publishingFrequencyPerWeek >= 2 ? "up" : "stable",
      confidence: 60,
      metadata: { postsPerWeek: input.publishingFrequencyPerWeek },
    });
  }

  if (input.competitorConfigured) {
    trends.push({
      type: "competitor_opportunity",
      title: "Competitor opportunity signal",
      summary:
        "Competitor profiles are configured. Differentiate with proof-led local content and faster review responses.",
      direction: "stable",
      confidence: 58,
    });
  }

  return trends;
}
