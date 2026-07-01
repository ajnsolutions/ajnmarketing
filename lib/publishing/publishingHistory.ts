import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PublishingHistoryEntry,
  PublishingJob,
  PublishingJobStatus,
} from "@/lib/publishing/publishingTypes";

function mapHistoryRow(row: Record<string, unknown>): PublishingHistoryEntry {
  return {
    id: String(row.id),
    publishing_job_id: String(row.publishing_job_id),
    action: String(row.action),
    status: String(row.status),
    details: (row.details as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

function mapJobRow(row: Record<string, unknown>): PublishingJob {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    content_id: String(row.content_id),
    provider: row.provider as PublishingJob["provider"],
    provider_post_id: row.provider_post_id ? String(row.provider_post_id) : null,
    status: row.status as PublishingJobStatus,
    scheduled_for: row.scheduled_for ? String(row.scheduled_for) : null,
    published_at: row.published_at ? String(row.published_at) : null,
    retry_count: Number(row.retry_count ?? 0),
    last_error: row.last_error ? String(row.last_error) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function insertPublishingHistoryEntry(
  supabase: SupabaseClient,
  input: {
    publishingJobId: string;
    action: string;
    status: PublishingJobStatus | string;
    details?: Record<string, unknown>;
  }
): Promise<PublishingHistoryEntry | null> {
  const { data, error } = await supabase
    .from("publishing_history")
    .insert({
      publishing_job_id: input.publishingJobId,
      action: input.action,
      status: input.status,
      details: input.details ?? {},
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return mapHistoryRow(data as Record<string, unknown>);
}

export async function getPublishingHistoryForJob(
  supabase: SupabaseClient,
  userId: string,
  publishingJobId: string
): Promise<PublishingHistoryEntry[]> {
  const { data: job } = await supabase
    .from("publishing_jobs")
    .select("id")
    .eq("id", publishingJobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!job) return [];

  const { data, error } = await supabase
    .from("publishing_history")
    .select("*")
    .eq("publishing_job_id", publishingJobId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapHistoryRow(row as Record<string, unknown>));
}

export async function getPublishingJobsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PublishingJob[]> {
  const { data, error } = await supabase
    .from("publishing_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapJobRow(row as Record<string, unknown>));
}

export async function getPublishingJobById(
  supabase: SupabaseClient,
  userId: string,
  publishingJobId: string
): Promise<PublishingJob | null> {
  const { data, error } = await supabase
    .from("publishing_jobs")
    .select("*")
    .eq("id", publishingJobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapJobRow(data as Record<string, unknown>);
}

export async function getActivePublishingJobForContent(
  supabase: SupabaseClient,
  userId: string,
  contentId: string
): Promise<PublishingJob | null> {
  const { data, error } = await supabase
    .from("publishing_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("content_id", contentId)
    .in("status", ["queued", "scheduled", "publishing", "retrying"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapJobRow(data as Record<string, unknown>);
}

export async function createPublishingJobRecord(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    contentId: string;
    provider: PublishingJob["provider"];
    status: PublishingJobStatus;
    scheduledFor?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<PublishingJob | null> {
  const { data, error } = await supabase
    .from("publishing_jobs")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      content_id: input.contentId,
      provider: input.provider,
      status: input.status,
      scheduled_for: input.scheduledFor ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return mapJobRow(data as Record<string, unknown>);
}

export async function updatePublishingJobRecord(
  supabase: SupabaseClient,
  userId: string,
  publishingJobId: string,
  patch: Partial<{
    status: PublishingJobStatus;
    provider_post_id: string | null;
    scheduled_for: string | null;
    published_at: string | null;
    retry_count: number;
    last_error: string | null;
    metadata: Record<string, unknown>;
  }>
): Promise<PublishingJob | null> {
  const { data, error } = await supabase
    .from("publishing_jobs")
    .update(patch)
    .eq("id", publishingJobId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapJobRow(data as Record<string, unknown>);
}

export async function getDueScheduledPublishingJobs(
  supabase: SupabaseClient,
  userId?: string
): Promise<PublishingJob[]> {
  let query = supabase
    .from("publishing_jobs")
    .select("*")
    .in("status", ["scheduled", "retrying"])
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(25);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => mapJobRow(row as Record<string, unknown>));
}
