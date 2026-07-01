import {
  AnalyticsRecommendationCategories,
  type AnalyticsRecommendationCategory,
  type AnalyticsRecommendationPriority,
  type AiRecommendation,
  type PerformanceAnalysis,
  type TrendSignal,
} from "@/lib/analytics/analyticsTypes";

export type RecommendationDraft = {
  category: AnalyticsRecommendationCategory;
  priority: AnalyticsRecommendationPriority;
  title: string;
  description: string;
  reason: string;
  confidence: number;
  metadata?: Record<string, unknown>;
};

export function generateRecommendations(input: {
  performance: PerformanceAnalysis | null;
  trends: TrendSignal[];
  unansweredReviews: number;
  competitorConfigured: boolean;
  postsPublished: number;
}): RecommendationDraft[] {
  const recommendations: RecommendationDraft[] = [];

  const contentTrend = input.trends.find((trend) => trend.type === "best_topics");
  if (contentTrend) {
    recommendations.push({
      category: AnalyticsRecommendationCategories.CONTENT,
      priority: "high",
      title: "Double down on proven content themes",
      description:
        "Posts aligned with your recent top-performing themes are outperforming generic messaging.",
      reason: contentTrend.summary,
      confidence: 82,
      metadata: contentTrend.metadata,
    });
  }

  const postingTrend = input.trends.find((trend) => trend.type === "posting_times");
  if (postingTrend && input.postsPublished < 4) {
    recommendations.push({
      category: AnalyticsRecommendationCategories.POSTING,
      priority: "high",
      title: "Increase Google posting consistency",
      description:
        "Tuesday-through-Thursday morning posts often perform well for local service businesses when paired with timely offers.",
      reason: postingTrend.summary,
      confidence: 74,
    });
  }

  if (input.unansweredReviews > 0) {
    recommendations.push({
      category: AnalyticsRecommendationCategories.REVIEWS,
      priority: input.unansweredReviews >= 3 ? "high" : "medium",
      title: "Review response time has increased",
      description: `${input.unansweredReviews} review(s) still need a response. Faster replies protect local trust signals.`,
      reason: "Unanswered reviews reduce review health and local conversion confidence.",
      confidence: 86,
      metadata: { unansweredReviews: input.unansweredReviews },
    });
  }

  const visibilityTrend = input.trends.find((trend) => trend.type === "visibility_trend");
  if (visibilityTrend?.direction === "down") {
    recommendations.push({
      category: AnalyticsRecommendationCategories.VISIBILITY,
      priority: "high",
      title: "Recover Google visibility momentum",
      description:
        "Visibility softened versus the prior snapshot. Refresh Google posts with localized, service-specific proof points.",
      reason: visibilityTrend.summary,
      confidence: 80,
    });
  } else if (visibilityTrend?.direction === "up") {
    recommendations.push({
      category: AnalyticsRecommendationCategories.VISIBILITY,
      priority: "medium",
      title: "Capitalize on rising Google visibility",
      description:
        "Search and Maps visibility improved recently. Publish follow-up content while local discovery momentum is higher.",
      reason: visibilityTrend.summary,
      confidence: 76,
    });
  }

  const seasonTrend = input.trends.find((trend) => trend.type === "seasonality");
  if (seasonTrend) {
    recommendations.push({
      category: AnalyticsRecommendationCategories.SEASONALITY,
      priority: "medium",
      title: "Use seasonal messaging in upcoming content",
      description:
        "Seasonal hooks tied to your services can outperform generic promotional posts during demand shifts.",
      reason: seasonTrend.summary,
      confidence: 71,
      metadata: seasonTrend.metadata,
    });
  }

  if (input.competitorConfigured) {
    recommendations.push({
      category: AnalyticsRecommendationCategories.COMPETITORS,
      priority: "medium",
      title: "Differentiate against active local competitors",
      description:
        "Your competitors are posting regularly in the market. Lead with proof, local expertise, and faster response messaging.",
      reason: "Competitor profiles are configured in your business intelligence.",
      confidence: 69,
    });
  }

  if (input.performance?.contentUnderperformers.length) {
    recommendations.push({
      category: AnalyticsRecommendationCategories.ENGAGEMENT,
      priority: "medium",
      title: "Revise underperforming post angles",
      description:
        "Some recent posts underperformed. Replace generic copy with localized proof, FAQs, and stronger calls to action.",
      reason: `${input.performance.contentUnderperformers.length} recent post(s) scored below target.`,
      confidence: 73,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      category: AnalyticsRecommendationCategories.ENGAGEMENT,
      priority: "low",
      title: "Build your analytics baseline",
      description:
        "Connect Google Business Profile, publish consistently, and refresh analytics after sync to unlock stronger learning signals.",
      reason: "Insufficient performance history for specialized recommendations yet.",
      confidence: 55,
    });
  }

  return recommendations.slice(0, 8);
}

export function recommendationToInsight(recommendation: AiRecommendation | RecommendationDraft): string {
  return `${recommendation.title}: ${recommendation.description}`;
}
