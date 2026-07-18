import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecommendationOutcomeEvent,
  RecommendationOutcomeEventType,
  RecommendationOutcomeFilter,
} from "@/lib/recommendation-outcomes/types";
import { recordObservationForOutcomeEvent } from "@/lib/marketing-memory/service";
import { classifyError } from "@/lib/marketing-memory/metadata";

function mapEventRow(row: Record<string, unknown>): RecommendationOutcomeEvent {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    recommendation_id: String(row.recommendation_id),
    content_approval_id: row.content_approval_id ? String(row.content_approval_id) : null,
    publishing_job_id: row.publishing_job_id ? String(row.publishing_job_id) : null,
    event_type: row.event_type as RecommendationOutcomeEventType,
    event_version: Number(row.event_version ?? 1),
    source: String(row.source ?? "system"),
    idempotency_key: String(row.idempotency_key),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

export type InsertOutcomeEventResult =
  | { event: RecommendationOutcomeEvent; duplicate: false }
  | { event: null; duplicate: true }
  | { event: null; duplicate: false; error: { code?: string; message?: string } };

/**
 * Idempotent insert: a unique-violation on idempotency_key is treated as "this exact
 * transition was already recorded" (duplicate: true), never as an error. This is the
 * only idempotency mechanism -- callers never pre-check for existence in memory, since
 * that check-then-insert would itself race under concurrency. The database's unique
 * constraint is the sole source of truth for "has this happened before."
 */
export async function insertRecommendationOutcomeEvent(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    recommendationId: string;
    contentApprovalId?: string | null;
    publishingJobId?: string | null;
    eventType: RecommendationOutcomeEventType;
    idempotencyKey: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<InsertOutcomeEventResult> {
  const { data, error } = await supabase
    .from("recommendation_outcome_events")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      recommendation_id: input.recommendationId,
      content_approval_id: input.contentApprovalId ?? null,
      publishing_job_id: input.publishingJobId ?? null,
      event_type: input.eventType,
      source: input.source ?? "system",
      idempotency_key: input.idempotencyKey,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return { event: null, duplicate: true };
    }
    return { event: null, duplicate: false, error };
  }

  if (!data) {
    return { event: null, duplicate: false, error: { message: "No row returned from insert." } };
  }

  const event = mapEventRow(data as Record<string, unknown>);

  // Marketing Memory Phase 1: best-effort, non-blocking evidence recording. This is a
  // pure side effect of an outcome event that already, successfully, persisted above —
  // its own internal try/catch never throws, but this outer catch is a deliberate
  // second layer of defense so a memory-recording regression can never surface as a
  // failure of the authoritative outcome-event write itself. See
  // docs/MARKETING_MEMORY_FOUNDATION.md.
  try {
    await recordObservationForOutcomeEvent(supabase, event);
  } catch (err) {
    console.error("[MarketingMemory]", {
      event: "ingestion_failed",
      businessProfileId: event.business_profile_id,
      result: "error",
      errorClass: classifyError(err),
    });
  }

  return { event, duplicate: false };
}

export async function getOutcomeEventsForRecommendation(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string
): Promise<RecommendationOutcomeEvent[]> {
  const { data, error } = await supabase
    .from("recommendation_outcome_events")
    .select("*")
    .eq("user_id", userId)
    .eq("recommendation_id", recommendationId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => mapEventRow(row as Record<string, unknown>));
}

/**
 * All outcome events for a tenant/business, with optional time-range filtering applied
 * at the query level (never fetched-then-filtered in memory for the time range, so a
 * large history can't silently push relevant rows outside an in-memory window).
 * actionType/category/channel/usefulnessSignal filtering happens after the join to
 * marketing_recommendations in the service layer, since those fields don't live on this
 * table directly.
 */
export async function getOutcomeEventsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  filter?: Pick<RecommendationOutcomeFilter, "since" | "until">
): Promise<RecommendationOutcomeEvent[]> {
  let query = supabase
    .from("recommendation_outcome_events")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: true });

  if (filter?.since) {
    query = query.gte("created_at", filter.since);
  }
  if (filter?.until) {
    query = query.lte("created_at", filter.until);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => mapEventRow(row as Record<string, unknown>));
}

/** Resolves the content_approval linked to a recommendation, regardless of its status. */
export async function getContentApprovalForRecommendation(
  supabase: SupabaseClient,
  userId: string,
  recommendationId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("content_approvals")
    .select("*")
    .eq("user_id", userId)
    .eq("marketing_recommendation_id", recommendationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** Resolves the publishing_queue row created from a content approval, if any. */
export async function getPublishingQueueItemForContentApproval(
  supabase: SupabaseClient,
  userId: string,
  contentApprovalId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("publishing_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("content_approval_id", contentApprovalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** Resolves the most recent publishing_job for a publishing_queue item (content_id). */
export async function getPublishingJobForQueueItem(
  supabase: SupabaseClient,
  userId: string,
  publishingQueueId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("publishing_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("content_id", publishingQueueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** Resolves the content_performance row for a publishing job, if analytics have run. */
export async function getContentPerformanceForPublishingJob(
  supabase: SupabaseClient,
  publishingJobId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("content_performance")
    .select("*")
    .eq("publishing_job_id", publishingJobId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** All recommendations for a business, used by reconciliation and aggregate stats. */
export async function getRecommendationsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("marketing_recommendations")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId);

  if (error || !data) return [];
  return data as Record<string, unknown>[];
}
