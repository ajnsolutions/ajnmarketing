export const AuditActions = {
  GOOGLE_BUSINESS_SYNC_STARTED: "google_business.sync.started",
  GOOGLE_BUSINESS_SYNC_COMPLETED: "google_business.sync.completed",
  GOOGLE_BUSINESS_SYNC_FAILED: "google_business.sync.failed",
  WEBSITE_ANALYSIS_STARTED: "website_analysis.started",
  WEBSITE_ANALYSIS_COMPLETED: "website_analysis.completed",
  WEBSITE_ANALYSIS_FAILED: "website_analysis.failed",
  CONTENT_GENERATED: "content.generated",
  CONTENT_SENT_TO_APPROVAL: "content.sent_to_approval",
  CONTENT_APPROVED: "content.approved",
  CONTENT_REJECTED: "content.rejected",
  CONTENT_ADDED_TO_PUBLISHING_QUEUE: "content.added_to_publishing_queue",
  MARKETING_PLAN_GENERATED: "marketing_plan.generated",
  MARKETING_AGENT_TASKS_GENERATED: "marketing_agent.tasks_generated",
  GOOGLE_OAUTH_CONNECTED: "google_oauth.connected",
  BACKGROUND_JOB_QUEUED: "background_job.queued",
  BACKGROUND_JOB_STARTED: "background_job.started",
  BACKGROUND_JOB_COMPLETED: "background_job.completed",
  BACKGROUND_JOB_FAILED: "background_job.failed",
  BACKGROUND_JOB_CANCELLED: "background_job.cancelled",
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
