export type {
  AiRecommendation,
  AnalyticsFeedback,
  AnalyticsPageData,
  AnalyticsSnapshot,
  CaptureSnapshotResult,
  ContentPerformanceRecord,
  PerformanceAnalysis,
  TrendSignal,
} from "@/lib/analytics/analyticsTypes";

export {
  AnalyticsRecommendationCategories,
} from "@/lib/analytics/analyticsTypes";

export {
  formatAnalyticsDate,
  formatAnalyticsCategory,
  formatAnalyticsPriority,
} from "@/lib/analytics/analyticsPersistence";

export {
  analyzePerformance,
  computeEngagementScore,
} from "@/lib/analytics/performanceAnalyzer";

export { detectTrends } from "@/lib/analytics/trendDetector";

export {
  generateRecommendations,
  recommendationToInsight,
} from "@/lib/analytics/recommendationEngine";

export {
  buildAnalyticsFeedback,
  formatAnalyticsFeedbackForPrompt,
} from "@/lib/analytics/feedbackLoop";

export {
  analyzePerformanceForUser,
  applyFeedbackForUser,
  captureSnapshotForUser,
  detectTrendsForUser,
  generateRecommendationsForUser,
  getAnalyticsFeedbackForCurrentUser,
  getAnalyticsFeedbackForUser,
  getAnalyticsPageDataForUser,
  queueAnalyticsCaptureForUser,
  runAnalyticsFeedbackLoopForUser,
} from "@/lib/analytics/analyticsEngine";
