export const AnalyticsRecommendationCategories = {
  POSTING: "posting",
  REVIEWS: "reviews",
  VISIBILITY: "visibility",
  CONTENT: "content",
  COMPETITORS: "competitors",
  SEASONALITY: "seasonality",
  ENGAGEMENT: "engagement",
} as const;

export type AnalyticsRecommendationCategory =
  (typeof AnalyticsRecommendationCategories)[keyof typeof AnalyticsRecommendationCategories];

export type AnalyticsRecommendationPriority = "high" | "medium" | "low";

export type AnalyticsRecommendationStatus = "active" | "applied" | "dismissed";

export type AnalyticsSnapshot = {
  id: string;
  user_id: string;
  business_profile_id: string;
  snapshot_date: string;
  google_views: number;
  searches: number;
  calls: number;
  direction_requests: number;
  website_clicks: number;
  review_count: number;
  average_rating: number | null;
  posts_published: number;
  engagement_score: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ContentPerformanceRecord = {
  id: string;
  content_id: string;
  publishing_job_id: string | null;
  provider: string;
  published_at: string | null;
  views: number;
  clicks: number;
  engagement: number;
  conversions: number;
  performance_score: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiRecommendation = {
  id: string;
  user_id: string;
  business_profile_id: string;
  category: AnalyticsRecommendationCategory;
  priority: AnalyticsRecommendationPriority;
  title: string;
  description: string;
  reason: string;
  confidence: number;
  status: AnalyticsRecommendationStatus;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PerformanceAnalysis = {
  opportunityScore: number;
  engagementScore: number;
  publishingSuccessRate: number | null;
  visibilityChangePercent: number | null;
  reviewVelocity: number;
  contentWinners: ContentPerformanceRecord[];
  contentUnderperformers: ContentPerformanceRecord[];
  summary: string;
};

export type TrendSignal = {
  type:
    | "best_topics"
    | "posting_times"
    | "seasonality"
    | "review_trend"
    | "visibility_trend"
    | "competitor_opportunity"
    | "declining_performance";
  title: string;
  summary: string;
  direction: "up" | "down" | "stable";
  confidence: number;
  metadata?: Record<string, unknown>;
};

export type AnalyticsFeedback = {
  available: boolean;
  opportunityScore: number;
  learningSummary: string;
  topInsights: string[];
  performanceTrends: TrendSignal[];
  recommendations: AiRecommendation[];
  contentWinners: ContentPerformanceRecord[];
  contentUnderperformers: ContentPerformanceRecord[];
  latestSnapshot: AnalyticsSnapshot | null;
  performanceAnalysis: PerformanceAnalysis | null;
};

export type AnalyticsPageData = {
  feedback: AnalyticsFeedback;
  snapshots: AnalyticsSnapshot[];
  recommendations: AiRecommendation[];
  contentPerformance: ContentPerformanceRecord[];
};

export type CaptureSnapshotResult = {
  snapshot: AnalyticsSnapshot | null;
  contentPerformanceCount: number;
};
