import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { seasonFromDate } from "@/lib/recommendation-learning/signals";
import { buildContextSnapshotIdempotencyKey, utcDateKey } from "@/lib/marketing-memory/idempotency";

const CONTEXT_WINDOW_DAYS = 3;
const MAX_CONTEXT_ITEMS = 5;
const CONTEXT_SNAPSHOT_RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

const DAYS_OF_WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function dayOfWeekFromDate(date: Date): string {
  return DAYS_OF_WEEK[date.getUTCDay()];
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Bounded lookup of market_context_items active near occurredAt — never an unbounded
 * scan. A +/-3-day window and a 5-item cap keep this cheap and keep
 * context_snapshots.context_item_ids from growing unboundedly per row, per the
 * architecture doc's "avoid copying every available context item into every
 * observation" guidance. Returns [] (not an error) on any query failure — missing
 * context must never block the calling observation from being recorded.
 */
async function findRelevantContextItemIds(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  occurredAt: Date
): Promise<string[]> {
  const windowStart = isoDate(new Date(occurredAt.getTime() - CONTEXT_WINDOW_DAYS * DAY_MS));
  const windowEnd = isoDate(new Date(occurredAt.getTime() + CONTEXT_WINDOW_DAYS * DAY_MS));

  const { data, error } = await supabase
    .from("market_context_items")
    .select("id")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .gte("context_date", windowStart)
    .lte("context_date", windowEnd)
    .order("relevance_score", { ascending: false })
    .limit(MAX_CONTEXT_ITEMS);

  if (error || !data) return [];
  return data.map((row: { id: unknown }) => String(row.id));
}

export type ResolveContextSnapshotInput = {
  userId: string;
  businessProfileId: string;
  occurredAt: Date;
};

/**
 * Idempotent get-or-create: one context snapshot is reused per business per UTC day,
 * regardless of how many observations occur that day. Always returns null (never
 * throws) on failure — context is optional evidence, and its absence must never block
 * the observation it would have been attached to.
 */
export async function resolveContextSnapshotForObservation(
  supabase: SupabaseClient,
  input: ResolveContextSnapshotInput
): Promise<string | null> {
  try {
    const { userId, businessProfileId, occurredAt } = input;
    const idempotencyKey = buildContextSnapshotIdempotencyKey(businessProfileId, utcDateKey(occurredAt));

    const contextItemIds = await findRelevantContextItemIds(supabase, userId, businessProfileId, occurredAt);

    const contextSummary = {
      dayOfWeek: dayOfWeekFromDate(occurredAt),
      month: occurredAt.getUTCMonth() + 1,
      season: seasonFromDate(occurredAt),
      contextItemCount: contextItemIds.length,
    };

    const expiresAt = new Date(occurredAt.getTime() + CONTEXT_SNAPSHOT_RETENTION_DAYS * DAY_MS);

    const { data, error } = await supabase
      .from("marketing_memory_context_snapshots")
      .insert({
        user_id: userId,
        business_profile_id: businessProfileId,
        captured_at: occurredAt.toISOString(),
        context_item_ids: contextItemIds,
        context_summary: contextSummary,
        valid_from: occurredAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (!error && data) {
      return String((data as { id: unknown }).id);
    }

    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      const { data: existing } = await supabase
        .from("marketing_memory_context_snapshots")
        .select("id")
        .eq("business_profile_id", businessProfileId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) return String((existing as { id: unknown }).id);
    }

    return null;
  } catch {
    return null;
  }
}
