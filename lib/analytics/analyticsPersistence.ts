import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiRecommendation,
  AnalyticsRecommendationCategory,
  AnalyticsRecommendationPriority,
  AnalyticsRecommendationStatus,
  AnalyticsSnapshot,
  ContentPerformanceRecord,
} from "@/lib/analytics/analyticsTypes";

function mapSnapshot(row: Record<string, unknown>): AnalyticsSnapshot {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    snapshot_date: String(row.snapshot_date),
    google_views: Number(row.google_views ?? 0),
    searches: Number(row.searches ?? 0),
    calls: Number(row.calls ?? 0),
    direction_requests: Number(row.direction_requests ?? 0),
    website_clicks: Number(row.website_clicks ?? 0),
    review_count: Number(row.review_count ?? 0),
    average_rating: row.average_rating == null ? null : Number(row.average_rating),
    posts_published: Number(row.posts_published ?? 0),
    engagement_score: Number(row.engagement_score ?? 0),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

function mapRecommendation(row: Record<string, unknown>): AiRecommendation {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    category: row.category as AnalyticsRecommendationCategory,
    priority: row.priority as AiRecommendation["priority"],
    title: String(row.title),
    description: String(row.description),
    reason: String(row.reason ?? ""),
    confidence: Number(row.confidence ?? 0),
    status: row.status as AnalyticsRecommendationStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

function mapContentPerformance(row: Record<string, unknown>): ContentPerformanceRecord {
  return {
    id: String(row.id),
    content_id: String(row.content_id),
    publishing_job_id: row.publishing_job_id ? String(row.publishing_job_id) : null,
    provider: String(row.provider),
    published_at: row.published_at ? String(row.published_at) : null,
    views: Number(row.views ?? 0),
    clicks: Number(row.clicks ?? 0),
    engagement: Number(row.engagement ?? 0),
    conversions: Number(row.conversions ?? 0),
    performance_score: Number(row.performance_score ?? 0),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

export async function upsertAnalyticsSnapshot(
  supabase: SupabaseClient,
  input: Omit<AnalyticsSnapshot, "id" | "created_at">
): Promise<AnalyticsSnapshot | null> {
  const { data, error } = await supabase
    .from("analytics_snapshots")
    .upsert(
      {
        user_id: input.user_id,
        business_profile_id: input.business_profile_id,
        snapshot_date: input.snapshot_date,
        google_views: input.google_views,
        searches: input.searches,
        calls: input.calls,
        direction_requests: input.direction_requests,
        website_clicks: input.website_clicks,
        review_count: input.review_count,
        average_rating: input.average_rating,
        posts_published: input.posts_published,
        engagement_score: input.engagement_score,
        metadata: input.metadata,
      },
      { onConflict: "user_id,snapshot_date" }
    )
    .select("*")
    .single();

  if (error || !data) return null;
  return mapSnapshot(data as Record<string, unknown>);
}

export async function getAnalyticsSnapshotsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
): Promise<AnalyticsSnapshot[]> {
  const { data, error } = await supabase
    .from("analytics_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapSnapshot(row as Record<string, unknown>));
}

export async function getLatestAnalyticsSnapshotForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<AnalyticsSnapshot | null> {
  const { data, error } = await supabase
    .from("analytics_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapSnapshot(data as Record<string, unknown>);
}

export async function upsertContentPerformanceRecord(
  supabase: SupabaseClient,
  input: Omit<ContentPerformanceRecord, "id" | "created_at">
): Promise<ContentPerformanceRecord | null> {
  const { data: existing } = await supabase
    .from("content_performance")
    .select("id")
    .eq("content_id", input.content_id)
    .eq("publishing_job_id", input.publishing_job_id)
    .maybeSingle();

  const payload = {
    content_id: input.content_id,
    publishing_job_id: input.publishing_job_id,
    provider: input.provider,
    published_at: input.published_at,
    views: input.views,
    clicks: input.clicks,
    engagement: input.engagement,
    conversions: input.conversions,
    performance_score: input.performance_score,
    metadata: input.metadata,
  };

  const { data, error } = existing
    ? await supabase
        .from("content_performance")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabase.from("content_performance").insert(payload).select("*").single();

  if (error || !data) return null;
  return mapContentPerformance(data as Record<string, unknown>);
}

export async function getContentPerformanceForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<ContentPerformanceRecord[]> {
  const { data: queueItems } = await supabase
    .from("publishing_queue")
    .select("id")
    .eq("user_id", userId);

  const contentIds = (queueItems ?? []).map((item) => item.id);
  if (contentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("content_performance")
    .select("*")
    .in("content_id", contentIds)
    .order("performance_score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapContentPerformance(row as Record<string, unknown>));
}

export async function replaceActiveRecommendations(
  supabase: SupabaseClient,
  userId: string,
  recommendations: Array<{
    businessProfileId: string;
    category: AnalyticsRecommendationCategory;
    priority: AnalyticsRecommendationPriority;
    title: string;
    description: string;
    reason: string;
    confidence: number;
    metadata?: Record<string, unknown>;
  }>
): Promise<AiRecommendation[]> {
  await supabase
    .from("ai_recommendations")
    .update({ status: "dismissed" })
    .eq("user_id", userId)
    .eq("status", "active");

  if (recommendations.length === 0) return [];

  const { data, error } = await supabase
    .from("ai_recommendations")
    .insert(
      recommendations.map((item) => ({
        user_id: userId,
        business_profile_id: item.businessProfileId,
        category: item.category,
        priority: item.priority,
        title: item.title,
        description: item.description,
        reason: item.reason,
        confidence: item.confidence,
        status: "active",
        metadata: item.metadata ?? {},
      }))
    )
    .select("*");

  if (error || !data) return [];
  return data.map((row) => mapRecommendation(row as Record<string, unknown>));
}

export async function getActiveRecommendationsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<AiRecommendation[]> {
  const { data, error } = await supabase
    .from("ai_recommendations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("confidence", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapRecommendation(row as Record<string, unknown>));
}

export async function updateRecommendationStatus(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string,
  status: AnalyticsRecommendationStatus
): Promise<AiRecommendation | null> {
  const { data, error } = await supabase
    .from("ai_recommendations")
    .update({ status })
    .eq("id", recommendationId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRecommendation(data as Record<string, unknown>);
}

export function formatAnalyticsDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function formatAnalyticsCategory(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatAnalyticsPriority(priority: string): string {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}
