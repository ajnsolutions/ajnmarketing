export type CommandCenterPriority = "high" | "medium" | "low";

export type CommandCenterMomentumTrend = "up" | "stable" | "down";

export type CommandCenterRecommendedAction =
  | "generate_content"
  | "open_approval"
  | "open_publishing"
  | "open_marketing_plan"
  | "open_website_analysis"
  | "refresh_marketing_plan"
  | "refresh_website_analysis"
  | "sync_google_business"
  | "open_tasks"
  | "open_google_business";

export type CommandCenterBusinessHealth = {
  overall: number;
  seo: number;
  google: number;
  reviews: number;
  content: number;
  consistency: number;
};

export type CommandCenterRecommendation = {
  title: string;
  priority: CommandCenterPriority;
  reason: string;
  estimatedImpact: string;
  recommendedAction: CommandCenterRecommendedAction;
};

export type CommandCenterCalendarItem = {
  day: number;
  dateLabel: string;
  title: string;
  channel: string;
  contentType: string;
  note: string;
};

export type CommandCenterWeeklyWins = {
  reviews: number;
  views: number;
  calls: number;
  clicks: number;
  posts: number;
  tasksCompleted: number;
};

export type CommandCenterMomentum = {
  trend: CommandCenterMomentumTrend;
  reasons: string[];
};

export type CommandCenterAiInsights = {
  executiveSummary: string;
  businessHealthExplanation: string;
  momentum: CommandCenterMomentum;
  recommendations: CommandCenterRecommendation[];
  generatedByAi: boolean;
};

export type CommandCenterPageData = {
  businessName: string;
  aiInsights: CommandCenterAiInsights;
  businessHealth: CommandCenterBusinessHealth;
  priorities: {
    high: Array<{ id: string; title: string; description: string; estimatedMinutes: number | null }>;
    medium: Array<{ id: string; title: string; description: string; estimatedMinutes: number | null }>;
    low: Array<{ id: string; title: string; description: string; estimatedMinutes: number | null }>;
  };
  calendar: CommandCenterCalendarItem[];
  weeklyWins: CommandCenterWeeklyWins;
  competitorWatchMessage: string;
};

export type CommandCenterGeneratedInsights = {
  executiveSummary: string;
  businessHealthExplanation: string;
  momentum: CommandCenterMomentum;
  recommendations: CommandCenterRecommendation[];
};
