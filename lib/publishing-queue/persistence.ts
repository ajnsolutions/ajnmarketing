import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PublishingPlatform,
  PublishingQueueItem,
  PublishingQueueStats,
  PublishingQueueStatus,
} from "@/lib/publishing-queue/types";

export function formatPublishingPlatform(platform: PublishingPlatform | null | undefined): string {
  switch (platform) {
    case "google_business_profile":
      return "Google Business Profile";
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    case "linkedin":
      return "LinkedIn";
    case "email":
      return "Email";
    default:
      return "Unknown";
  }
}

export function formatPublishingStatus(status: PublishingQueueStatus | null | undefined): string {
  switch (status) {
    case "ready":
      return "Ready to Publish";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

export function formatPublishingDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function inferPlatformFromContentType(contentType: string): PublishingPlatform {
  const normalized = contentType.toLowerCase();

  if (normalized.includes("facebook")) return "facebook";
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized.includes("email")) return "email";

  return "google_business_profile";
}

export async function getPublishingQueueForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PublishingQueueItem[]> {
  const { data, error } = await supabase
    .from("publishing_queue")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as PublishingQueueItem[];
}

export async function getPublishingQueueItemById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<PublishingQueueItem | null> {
  const { data, error } = await supabase
    .from("publishing_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as PublishingQueueItem;
}

export async function createPublishingQueueItem(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    contentApprovalId: string;
    platform: PublishingPlatform;
    title: string;
    content: string;
  }
): Promise<PublishingQueueItem | null> {
  const { data, error } = await supabase
    .from("publishing_queue")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      content_approval_id: input.contentApprovalId,
      platform: input.platform,
      title: input.title,
      content: input.content,
      status: "ready",
    })
    .select("*")
    .single();

  if (error) return null;
  return data as PublishingQueueItem;
}

export async function updatePublishingQueueItem(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  updates: Partial<
    Pick<
      PublishingQueueItem,
      "status" | "scheduled_for" | "published_at" | "publish_error" | "title" | "content"
    >
  >
): Promise<PublishingQueueItem | null> {
  const { data, error } = await supabase
    .from("publishing_queue")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return null;
  return data as PublishingQueueItem;
}

export async function deletePublishingQueueItem(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<boolean> {
  const { error } = await supabase
    .from("publishing_queue")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  return !error;
}

export async function getPublishingQueueStatsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PublishingQueueStats> {
  const { data, error } = await supabase
    .from("publishing_queue")
    .select("status")
    .eq("user_id", userId);

  if (error || !data) {
    return { ready: 0, scheduled: 0, published: 0, failed: 0 };
  }

  const rows = data as Array<{ status: PublishingQueueStatus }>;

  return {
    ready: rows.filter((row) => row.status === "ready").length,
    scheduled: rows.filter((row) => row.status === "scheduled").length,
    published: rows.filter((row) => row.status === "published").length,
    failed: rows.filter((row) => row.status === "failed").length,
  };
}
