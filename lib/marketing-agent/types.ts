export type MarketingTaskPriority = "high" | "medium" | "low";

export type MarketingTaskStatus = "pending" | "in_progress" | "completed" | "dismissed";

export type MarketingTaskRecommendedAction =
  | "generate_content"
  | "open_approval"
  | "open_publishing"
  | "open_marketing_plan"
  | "open_website_analysis"
  | "refresh_marketing_plan"
  | "review_content";

export type MarketingTaskPlanMeta = {
  reason: string;
  recommended_action: MarketingTaskRecommendedAction;
  estimated_minutes: number;
};

export type AiMarketingTask = {
  id: string;
  user_id: string;
  business_profile_id: string;
  marketing_plan_id: string | null;
  task_type: string;
  title: string;
  description: string;
  priority: MarketingTaskPriority;
  status: MarketingTaskStatus;
  due_date: string;
  related_content_id: string | null;
  related_plan_item: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiMarketingTaskWithMeta = AiMarketingTask & {
  meta: MarketingTaskPlanMeta | null;
};

export type GeneratedMarketingTask = {
  task_type: string;
  title: string;
  description: string;
  priority: MarketingTaskPriority;
  reason: string;
  recommended_action: MarketingTaskRecommendedAction;
  estimated_minutes: number;
  related_plan_item?: string;
  related_content_id?: string | null;
};

export type MarketingAgentGeneratedTasks = {
  tasks: GeneratedMarketingTask[];
};

export type MarketingAgentContext = {
  currentDate: string;
  currentDateLabel: string;
  businessProfile: Record<string, unknown>;
  websiteAnalysis: Record<string, unknown> | null;
  aiMarketingProfile: Record<string, unknown> | null;
  marketingPlan: Record<string, unknown> | null;
  pendingApprovals: Array<Record<string, unknown>>;
  publishingQueue: Array<Record<string, unknown>>;
};

export type MarketingAgentTaskStats = {
  dueToday: number;
  completedToday: number;
  highPriorityPending: number;
  topPriority: AiMarketingTaskWithMeta | null;
};

export type MarketingAgentTaskPatchInput = {
  id: string;
  action: "start" | "complete" | "dismiss";
};

export type MarketingAgentTasksPageData = {
  tasks: AiMarketingTaskWithMeta[];
  stats: MarketingAgentTaskStats;
};
