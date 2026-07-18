import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketingMemoryEvidenceLink,
  MarketingMemoryLinkType,
  MarketingMemoryObservation,
  MarketingMemoryObservationType,
  MarketingMemoryOutcomeDirection,
  MarketingMemoryRetentionClassification,
  MarketingMemorySourceEntityType,
  MarketingMemorySourceSystem,
} from "@/lib/marketing-memory/types";

function mapObservationRow(row: Record<string, unknown>): MarketingMemoryObservation {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    observation_type: row.observation_type as MarketingMemoryObservationType,
    source_system: row.source_system as MarketingMemorySourceSystem,
    source_outcome_event_id: row.source_outcome_event_id ? String(row.source_outcome_event_id) : null,
    source_analytics_snapshot_id: row.source_analytics_snapshot_id
      ? String(row.source_analytics_snapshot_id)
      : null,
    context_snapshot_id: row.context_snapshot_id ? String(row.context_snapshot_id) : null,
    occurred_at: String(row.occurred_at),
    outcome_direction: row.outcome_direction as MarketingMemoryOutcomeDirection,
    location_scope: row.location_scope ? String(row.location_scope) : null,
    metric_summary: (row.metric_summary as Record<string, unknown>) ?? {},
    schema_version: Number(row.schema_version ?? 1),
    retention_classification: row.retention_classification as MarketingMemoryRetentionClassification,
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  };
}

export type InsertObservationInput = {
  userId: string;
  businessProfileId: string;
  observationType: MarketingMemoryObservationType;
  sourceSystem: MarketingMemorySourceSystem;
  sourceOutcomeEventId: string | null;
  sourceAnalyticsSnapshotId: string | null;
  contextSnapshotId: string | null;
  occurredAt: string;
  outcomeDirection: MarketingMemoryOutcomeDirection;
  locationScope: string | null;
  metricSummary: Record<string, unknown>;
  retentionClassification: MarketingMemoryRetentionClassification;
  idempotencyKey: string;
};

export type InsertObservationResult =
  | { observation: MarketingMemoryObservation; duplicate: false }
  | { observation: null; duplicate: true }
  | { observation: null; duplicate: false; error: { code?: string; message?: string } };

/**
 * Idempotent insert, mirroring lib/recommendation-outcomes/persistence.ts's
 * insertRecommendationOutcomeEvent exactly: a unique-violation on idempotency_key means
 * "this observation was already recorded," never an error. The database's unique
 * constraint is the sole source of truth for "has this happened before" — no
 * check-then-insert race.
 */
export async function insertMarketingMemoryObservation(
  supabase: SupabaseClient,
  input: InsertObservationInput
): Promise<InsertObservationResult> {
  const { data, error } = await supabase
    .from("marketing_memory_observations")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      observation_type: input.observationType,
      source_system: input.sourceSystem,
      source_outcome_event_id: input.sourceOutcomeEventId,
      source_analytics_snapshot_id: input.sourceAnalyticsSnapshotId,
      context_snapshot_id: input.contextSnapshotId,
      occurred_at: input.occurredAt,
      outcome_direction: input.outcomeDirection,
      location_scope: input.locationScope,
      metric_summary: input.metricSummary,
      retention_classification: input.retentionClassification,
      idempotency_key: input.idempotencyKey,
    })
    .select("*")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return { observation: null, duplicate: true };
    }
    return { observation: null, duplicate: false, error };
  }

  if (!data) {
    return { observation: null, duplicate: false, error: { message: "No row returned from insert." } };
  }

  return { observation: mapObservationRow(data as Record<string, unknown>), duplicate: false };
}

export type EvidenceLinkInput = {
  sourceType: MarketingMemorySourceEntityType;
  sourceId: string;
  linkType: MarketingMemoryLinkType;
  idempotencyKey: string;
};

/**
 * Batch upsert with ignoreDuplicates, not a plain insert: a plain multi-row insert would
 * fail the whole batch if any single row's idempotency_key already existed (e.g. a retry
 * that partially succeeded before). Upserting with onConflict + ignoreDuplicates makes
 * each row's idempotency independent, matching this table's append-only, best-effort
 * evidence-recording role.
 */
export async function insertMarketingMemoryEvidenceLinks(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  observationId: string,
  links: EvidenceLinkInput[]
): Promise<{ inserted: number; error: { code?: string; message?: string } | null }> {
  if (links.length === 0) return { inserted: 0, error: null };

  const { data, error } = await supabase
    .from("marketing_memory_evidence_links")
    .upsert(
      links.map((link) => ({
        user_id: userId,
        business_profile_id: businessProfileId,
        observation_id: observationId,
        source_type: link.sourceType,
        source_id: link.sourceId,
        link_type: link.linkType,
        idempotency_key: link.idempotencyKey,
      })),
      { onConflict: "idempotency_key", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    return { inserted: 0, error };
  }

  return { inserted: Array.isArray(data) ? data.length : 0, error: null };
}

/** Diagnostic/test retrieval — never used on a request-serving hot path in Phase 1. */
export async function getMarketingMemoryObservationsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  limit = 50
): Promise<MarketingMemoryObservation[]> {
  const { data, error } = await supabase
    .from("marketing_memory_observations")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapObservationRow(row));
}

function mapEvidenceLinkRow(row: Record<string, unknown>): MarketingMemoryEvidenceLink {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    observation_id: String(row.observation_id),
    source_type: row.source_type as MarketingMemorySourceEntityType,
    source_id: String(row.source_id),
    link_type: row.link_type as MarketingMemoryLinkType,
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  };
}

/** Diagnostic/test retrieval for a single observation's evidence links. */
export async function getMarketingMemoryEvidenceLinksForObservation(
  supabase: SupabaseClient,
  userId: string,
  observationId: string
): Promise<MarketingMemoryEvidenceLink[]> {
  const { data, error } = await supabase
    .from("marketing_memory_evidence_links")
    .select("*")
    .eq("user_id", userId)
    .eq("observation_id", observationId);

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapEvidenceLinkRow(row));
}

/**
 * Dry-run diagnostic only — lists context snapshots past their retention boundary
 * without deleting or archiving anything. Satisfies the architecture self-review's
 * "unbounded storage growth" Phase 1 exit criterion (a way to identify what a future
 * cleanup pass would act on) without implementing or scheduling any destructive
 * operation in this PR. Manually invoked; never called from a Trigger.dev task or cron.
 */
export async function getExpiredContextSnapshotCandidatesForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  asOf: Date = new Date()
): Promise<{ id: string; captured_at: string; expires_at: string }[]> {
  const { data, error } = await supabase
    .from("marketing_memory_context_snapshots")
    .select("id, captured_at, expires_at")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .lt("expires_at", asOf.toISOString());

  if (error || !data) return [];
  return data as { id: string; captured_at: string; expires_at: string }[];
}
