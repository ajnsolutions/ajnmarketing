export type PublishingPlatform =
  | "google_business_profile"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "email";

export type PublishingQueueStatus = "ready" | "scheduled" | "published" | "failed";

export type PublishingQueueItem = {
  id: string;
  user_id: string;
  business_profile_id: string;
  content_approval_id: string;
  platform: PublishingPlatform;
  title: string;
  content: string;
  status: PublishingQueueStatus;
  scheduled_for: string | null;
  published_at: string | null;
  publish_error: string | null;
  created_at: string;
  updated_at: string;
};

export type PublishingQueueCreateInput = {
  content_approval_id: string;
  platform?: PublishingPlatform;
};

export type PublishingQueuePatchInput = {
  id: string;
  action?: "schedule" | "mark_published" | "mark_failed" | "remove";
  status?: PublishingQueueStatus;
  scheduled_for?: string | null;
  publish_error?: string | null;
};

export type PublishingQueueStats = {
  ready: number;
  scheduled: number;
  published: number;
  failed: number;
};

export const PUBLISHING_PLATFORMS: PublishingPlatform[] = [
  "google_business_profile",
  "facebook",
  "instagram",
  "linkedin",
  "email",
];
