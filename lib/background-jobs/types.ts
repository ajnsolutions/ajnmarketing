export const BackgroundJobTypes = {
  WEBSITE_ANALYSIS: "website_analysis",
  MARKETING_PLAN_GENERATION: "marketing_plan_generation",
  AI_TASK_GENERATION: "ai_task_generation",
  GOOGLE_BUSINESS_SYNC: "google_business_sync",
  AI_CONTENT_GENERATION: "ai_content_generation",
  REVIEW_REPLY_GENERATION: "review_reply_generation",
  FACEBOOK_SYNC: "facebook_sync",
  INSTAGRAM_SYNC: "instagram_sync",
  LINKEDIN_SYNC: "linkedin_sync",
  PUBLISHING_EXECUTE: "publishing_execute",
  ANALYTICS_CAPTURE: "analytics_capture",
  OPPORTUNITY_DETECTION: "opportunity_detection",
} as const;

export type BackgroundJobType = (typeof BackgroundJobTypes)[keyof typeof BackgroundJobTypes];

export const BackgroundJobStatuses = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type BackgroundJobStatus =
  (typeof BackgroundJobStatuses)[keyof typeof BackgroundJobStatuses];

export const BackgroundJobPriorities = {
  HIGH: "high",
  NORMAL: "normal",
  LOW: "low",
} as const;

export type BackgroundJobPriority =
  (typeof BackgroundJobPriorities)[keyof typeof BackgroundJobPriorities];

export type BackgroundJob = {
  id: string;
  user_id: string;
  business_profile_id: string | null;
  job_type: BackgroundJobType | string;
  status: BackgroundJobStatus;
  priority: BackgroundJobPriority;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BackgroundJobCreateInput = {
  userId: string;
  businessProfileId?: string | null;
  jobType: BackgroundJobType | string;
  priority?: BackgroundJobPriority;
  payload?: Record<string, unknown>;
  force?: boolean;
};

export type BackgroundJobQueueResult = {
  job: BackgroundJob | null;
  duplicate?: boolean;
  error?: string;
};

export type BackgroundJobPatchInput = {
  id: string;
  action: "retry" | "cancel";
};

export type BackgroundJobSummary = {
  id: string;
  job_type: string;
  status: BackgroundJobStatus;
  priority: BackgroundJobPriority;
  error: string | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
};

export type BackgroundJobDashboardData = {
  recent: BackgroundJobSummary[];
  counts: {
    queued: number;
    running: number;
    failed: number;
    completed: number;
  };
};

export const MAX_BACKGROUND_JOB_ATTEMPTS = 3;

export const ACTIVE_BACKGROUND_JOB_STATUSES: BackgroundJobStatus[] = ["queued", "running"];

export const BACKGROUND_JOB_TYPE_LABELS: Record<string, string> = {
  website_analysis: "Website Analysis",
  marketing_plan_generation: "Marketing Plan",
  ai_task_generation: "AI Tasks",
  google_business_sync: "Google Business Sync",
  ai_content_generation: "Content Generation",
  review_reply_generation: "Review Reply",
  facebook_sync: "Facebook Sync",
  instagram_sync: "Instagram Sync",
  linkedin_sync: "LinkedIn Sync",
  publishing_execute: "Publishing",
  analytics_capture: "Analytics Capture",
};
