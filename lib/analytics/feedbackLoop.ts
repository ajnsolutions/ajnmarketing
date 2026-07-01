import type { AnalyticsFeedback } from "@/lib/analytics/analyticsTypes";

export function buildAnalyticsFeedback(input: {
  latestSnapshot: AnalyticsFeedback["latestSnapshot"];
  performanceAnalysis: AnalyticsFeedback["performanceAnalysis"];
  trends: AnalyticsFeedback["performanceTrends"];
  recommendations: AnalyticsFeedback["recommendations"];
}): AnalyticsFeedback {
  const available = Boolean(input.latestSnapshot || input.recommendations.length > 0);

  const topInsights = [
    input.performanceAnalysis?.summary,
    ...input.trends.slice(0, 3).map((trend) => trend.summary),
    ...input.recommendations.slice(0, 2).map((item) => `${item.title}: ${item.description}`),
  ].filter(Boolean) as string[];

  const learningSummary = available
    ? [
        input.performanceAnalysis?.summary,
        input.trends[0]?.summary,
        input.recommendations[0]?.description,
      ]
        .filter(Boolean)
        .join(" ")
    : "Analytics feedback is not available yet. Connect Google Business Profile, publish content, and refresh analytics after sync.";

  return {
    available,
    opportunityScore: input.performanceAnalysis?.opportunityScore ?? 0,
    learningSummary,
    topInsights: topInsights.slice(0, 6),
    performanceTrends: input.trends,
    recommendations: input.recommendations,
    contentWinners: input.performanceAnalysis?.contentWinners ?? [],
    contentUnderperformers: input.performanceAnalysis?.contentUnderperformers ?? [],
    latestSnapshot: input.latestSnapshot,
    performanceAnalysis: input.performanceAnalysis,
  };
}

export function formatAnalyticsFeedbackForPrompt(feedback: AnalyticsFeedback | null): string {
  if (!feedback?.available) {
    return "";
  }

  return JSON.stringify(
    {
      opportunityScore: feedback.opportunityScore,
      learningSummary: feedback.learningSummary,
      topInsights: feedback.topInsights,
      performanceTrends: feedback.performanceTrends,
      recommendations: feedback.recommendations.map((item) => ({
        category: item.category,
        priority: item.priority,
        title: item.title,
        description: item.description,
        reason: item.reason,
        confidence: item.confidence,
      })),
      contentWinners: feedback.contentWinners.map((item) => ({
        title: item.metadata.title ?? "Published content",
        performanceScore: item.performance_score,
        views: item.views,
        clicks: item.clicks,
      })),
      contentUnderperformers: feedback.contentUnderperformers.map((item) => ({
        title: item.metadata.title ?? "Published content",
        performanceScore: item.performance_score,
      })),
      latestSnapshot: feedback.latestSnapshot,
    },
    null,
    2
  );
}
