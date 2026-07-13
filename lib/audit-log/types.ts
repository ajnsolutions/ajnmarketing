export const AuditActions = {
  GOOGLE_BUSINESS_SYNC_STARTED: "google_business.sync.started",
  GOOGLE_BUSINESS_SYNC_COMPLETED: "google_business.sync.completed",
  GOOGLE_BUSINESS_SYNC_FAILED: "google_business.sync.failed",
  WEBSITE_ANALYSIS_STARTED: "website_analysis.started",
  WEBSITE_ANALYSIS_COMPLETED: "website_analysis.completed",
  WEBSITE_ANALYSIS_FAILED: "website_analysis.failed",
  AI_MARKETING_PROFILE_GENERATION_STARTED: "ai_marketing_profile.generation.started",
  AI_MARKETING_PROFILE_GENERATION_COMPLETED: "ai_marketing_profile.generation.completed",
  AI_MARKETING_PROFILE_GENERATION_FAILED: "ai_marketing_profile.generation.failed",
  CONTENT_GENERATED: "content.generated",
  CONTENT_SENT_TO_APPROVAL: "content.sent_to_approval",
  CONTENT_APPROVED: "content.approved",
  CONTENT_REJECTED: "content.rejected",
  CONTENT_ADDED_TO_PUBLISHING_QUEUE: "content.added_to_publishing_queue",
  PUBLISHING_QUEUED: "publishing.queued",
  PUBLISHING_STARTED: "publishing.started",
  PUBLISHING_COMPLETED: "publishing.completed",
  PUBLISHING_FAILED: "publishing.failed",
  PUBLISHING_RETRYING: "publishing.retrying",
  PUBLISHING_CANCELLED: "publishing.cancelled",
  PUBLISHING_VERIFIED: "publishing.verified",
  ANALYTICS_SNAPSHOT_CAPTURED: "analytics.snapshot_captured",
  ANALYTICS_SNAPSHOT_CAPTURE_FAILED: "analytics.snapshot_capture_failed",
  ANALYTICS_CONTENT_PERFORMANCE_CAPTURED: "analytics.content_performance_captured",
  ANALYTICS_RECOMMENDATIONS_GENERATED: "analytics.recommendations_generated",
  ANALYTICS_RECOMMENDATION_APPLIED: "analytics.recommendation_applied",
  ANALYTICS_RECOMMENDATION_DISMISSED: "analytics.recommendation_dismissed",
  ANALYTICS_CAPTURE_QUEUED: "analytics.capture_queued",
  MARKETING_PLAN_GENERATED: "marketing_plan.generated",
  MARKET_CONTEXT_BRIEF_GENERATED: "market_context.brief_generated",
  MARKETING_AGENT_TASKS_GENERATED: "marketing_agent.tasks_generated",
  GOOGLE_OAUTH_CONNECTED: "google_oauth.connected",
  GOOGLE_BUSINESS_CONNECTION_VERIFICATION_FAILED: "google_business.connection.verification_failed",
  BACKGROUND_JOB_QUEUED: "background_job.queued",
  BACKGROUND_JOB_STARTED: "background_job.started",
  BACKGROUND_JOB_COMPLETED: "background_job.completed",
  BACKGROUND_JOB_FAILED: "background_job.failed",
  BACKGROUND_JOB_CANCELLED: "background_job.cancelled",
  MARKETING_OPPORTUNITIES_DETECTION_STARTED: "marketing_opportunities.detection_started",
  MARKETING_OPPORTUNITIES_DETECTION_COMPLETED: "marketing_opportunities.detection_completed",
  MARKETING_OPPORTUNITIES_DETECTION_FAILED: "marketing_opportunities.detection_failed",
  MARKETING_RECOMMENDATIONS_GENERATION_STARTED: "marketing_recommendations.generation_started",
  MARKETING_RECOMMENDATIONS_GENERATION_COMPLETED: "marketing_recommendations.generation_completed",
  MARKETING_RECOMMENDATIONS_GENERATION_FAILED: "marketing_recommendations.generation_failed",
  MARKETING_RECOMMENDATION_CONTENT_DRAFT_STARTED: "marketing_recommendation.content_draft.started",
  MARKETING_RECOMMENDATION_CONTENT_DRAFT_COMPLETED: "marketing_recommendation.content_draft.completed",
  MARKETING_RECOMMENDATION_CONTENT_DRAFT_FAILED: "marketing_recommendation.content_draft.failed",
  MARKETING_RECOMMENDATION_CONTENT_DRAFT_REUSED: "marketing_recommendation.content_draft.reused",
  RECOMMENDATION_PIPELINE_STARTED: "recommendation_pipeline.started",
  RECOMMENDATION_PIPELINE_COMPLETED: "recommendation_pipeline.completed",
  RECOMMENDATION_PIPELINE_FAILED: "recommendation_pipeline.failed",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export type AuditLogStatus = "started" | "success" | "failure";

export type AuditLog = {
  id: string;
  user_id: string;
  business_profile_id: string | null;
  action: AuditAction | string;
  entity_type: string | null;
  entity_id: string | null;
  status: AuditLogStatus;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AuditLogCreateInput = {
  userId: string;
  businessProfileId?: string | null;
  action: AuditAction | string;
  entityType?: string | null;
  entityId?: string | null;
  status: AuditLogStatus;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuditRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};
