import type { PublishingPlatform } from "@/lib/publishing-queue/types";

export const PublishingProviders = {
  GOOGLE_BUSINESS_PROFILE: "google_business_profile",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  LINKEDIN: "linkedin",
  EMAIL: "email",
} as const;

export type PublishingProvider =
  (typeof PublishingProviders)[keyof typeof PublishingProviders];

export const PublishingJobStatuses = {
  QUEUED: "queued",
  SCHEDULED: "scheduled",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  VERIFIED: "verified",
  RETRYING: "retrying",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type PublishingJobStatus =
  (typeof PublishingJobStatuses)[keyof typeof PublishingJobStatuses];

export type PublishingJob = {
  id: string;
  user_id: string;
  business_profile_id: string;
  content_id: string;
  provider: PublishingProvider;
  provider_post_id: string | null;
  status: PublishingJobStatus;
  scheduled_for: string | null;
  published_at: string | null;
  retry_count: number;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PublishingHistoryEntry = {
  id: string;
  publishing_job_id: string;
  action: string;
  status: PublishingJobStatus | string;
  details: Record<string, unknown>;
  created_at: string;
};

export type PublishContentInput = {
  title: string;
  body: string;
  contentApprovalId: string;
  publishingQueueId: string;
  scheduledFor?: string | null;
  metadata?: Record<string, unknown>;
};

export type PublishProviderResult = {
  providerPostId: string;
  publishedAt: string;
  rawResponse: Record<string, unknown>;
  verificationHint?: Record<string, unknown>;
};

export type PublishProviderContext = {
  userId: string;
  businessProfileId: string;
  input: PublishContentInput;
};

export type PublishingEngineAction =
  | "queue"
  | "publish_now"
  | "schedule"
  | "retry"
  | "cancel"
  | "verify";

export type QueuePublishInput = {
  publishingQueueId: string;
  scheduledFor?: string | null;
};

export type PublishingDashboardData = {
  jobs: PublishingJob[];
  historyByJobId: Record<string, PublishingHistoryEntry[]>;
};

export function mapPlatformToProvider(platform: PublishingPlatform): PublishingProvider {
  return platform;
}

export const ACTIVE_PUBLISHING_JOB_STATUSES: PublishingJobStatus[] = [
  PublishingJobStatuses.QUEUED,
  PublishingJobStatuses.SCHEDULED,
  PublishingJobStatuses.PUBLISHING,
  PublishingJobStatuses.RETRYING,
];

export const TERMINAL_PUBLISHING_JOB_STATUSES: PublishingJobStatus[] = [
  PublishingJobStatuses.PUBLISHED,
  PublishingJobStatuses.VERIFIED,
  PublishingJobStatuses.FAILED,
  PublishingJobStatuses.CANCELLED,
];
