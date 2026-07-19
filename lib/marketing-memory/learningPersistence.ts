import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_OBSERVATIONS_PER_EVALUATION } from "@/lib/marketing-memory/learningConfig";
import type { ActionOutcomeEvidenceRow, PerformanceEvidenceRow } from "@/lib/marketing-memory/learningEvaluation";
import {
  EvidenceClassifications,
  type LearningEvaluationResult,
  type MarketingMemoryLearning,
} from "@/lib/marketing-memory/learningTypes";
import { MarketingMemoryObservationTypes as ObservationTypes } from "@/lib/marketing-memory/types";

// --- Evidence fetching (read-only; feeds the pure evaluation functions) -----------

function mapLearningRow(row: Record<string, unknown>): MarketingMemoryLearning {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    learning_family: row.learning_family as MarketingMemoryLearning["learning_family"],
    time_dimension: (row.time_dimension as MarketingMemoryLearning["time_dimension"]) ?? null,
    subject_key: String(row.subject_key),
    metric_key: row.metric_key as MarketingMemoryLearning["metric_key"],
    direction: row.direction as MarketingMemoryLearning["direction"],
    status: row.status as MarketingMemoryLearning["status"],
    confidence_level: row.confidence_level as MarketingMemoryLearning["confidence_level"],
    confidence_components: (row.confidence_components as MarketingMemoryLearning["confidence_components"]) ?? {
      sampleSize: 0,
      supportingCount: 0,
      contradictingCount: 0,
      neutralCount: 0,
      excludedCount: 0,
      consistency: 0,
      contradictionRate: 0,
      effectSize: 0,
      recencyDays: 0,
      seasonalRecurrenceCount: 0,
      confounderCodes: [],
    },
    sample_size: Number(row.sample_size ?? 0),
    supporting_count: Number(row.supporting_count ?? 0),
    contradicting_count: Number(row.contradicting_count ?? 0),
    neutral_count: Number(row.neutral_count ?? 0),
    excluded_count: Number(row.excluded_count ?? 0),
    effect_size: row.effect_size == null ? null : Number(row.effect_size),
    comparison_baseline: String(row.comparison_baseline),
    baseline_value: row.baseline_value == null ? null : Number(row.baseline_value),
    cohort_value: row.cohort_value == null ? null : Number(row.cohort_value),
    first_observed_at: String(row.first_observed_at),
    last_observed_at: String(row.last_observed_at),
    evaluation_window_days: Number(row.evaluation_window_days ?? 0),
    recurrence_pattern: row.recurrence_pattern as MarketingMemoryLearning["recurrence_pattern"],
    seasonal_recurrence_count: Number(row.seasonal_recurrence_count ?? 0),
    confounder_codes: (row.confounder_codes as string[] | null) ?? [],
    summary: String(row.summary),
    internal_rationale: String(row.internal_rationale),
    learning_key: String(row.learning_key),
    superseded_by_learning_id: row.superseded_by_learning_id ? String(row.superseded_by_learning_id) : null,
    schema_version: Number(row.schema_version ?? 1),
    evaluated_at: String(row.evaluated_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  } as MarketingMemoryLearning;
}

/**
 * Fetches performance_measured observations for a business within the evaluation
 * window, joined (via a second, explicit query — not a nested embed, matching this
 * codebase's established two-step join convention) with each observation's context
 * snapshot for its day-of-week/month/season. Bounded by MAX_OBSERVATIONS_PER_EVALUATION
 * — never an unbounded historical scan.
 */
export async function fetchPerformanceEvidenceRows(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  windowStartIso: string
): Promise<PerformanceEvidenceRow[]> {
  const { data: observations, error } = await supabase
    .from("marketing_memory_observations")
    .select("id, occurred_at, metric_summary, context_snapshot_id")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("observation_type", ObservationTypes.PERFORMANCE_MEASURED)
    .gte("occurred_at", windowStartIso)
    .order("occurred_at", { ascending: false })
    .limit(MAX_OBSERVATIONS_PER_EVALUATION);

  if (error || !observations || observations.length === 0) return [];

  const snapshotIds = Array.from(
    new Set(
      observations
        .map((row: Record<string, unknown>) => row.context_snapshot_id)
        .filter((id: unknown): id is string => typeof id === "string")
    )
  );

  const snapshotById = new Map<string, { dayOfWeek: string | null; month: number | null; season: string | null }>();

  if (snapshotIds.length > 0) {
    const { data: snapshots } = await supabase
      .from("marketing_memory_context_snapshots")
      .select("id, context_summary")
      .in("id", snapshotIds);

    for (const snapshot of snapshots ?? []) {
      const summary = (snapshot as Record<string, unknown>).context_summary as Record<string, unknown> | null;
      snapshotById.set(String((snapshot as Record<string, unknown>).id), {
        dayOfWeek: typeof summary?.dayOfWeek === "string" ? summary.dayOfWeek : null,
        month: typeof summary?.month === "number" ? summary.month : null,
        season: typeof summary?.season === "string" ? summary.season : null,
      });
    }
  }

  const rows: PerformanceEvidenceRow[] = [];
  for (const observation of observations as Record<string, unknown>[]) {
    const metricSummary = (observation.metric_summary as Record<string, unknown>) ?? {};
    const performanceScore = metricSummary.performanceScore;
    if (typeof performanceScore !== "number" || !Number.isFinite(performanceScore)) continue;

    const snapshotId = observation.context_snapshot_id ? String(observation.context_snapshot_id) : null;
    const dimensions = snapshotId ? snapshotById.get(snapshotId) : undefined;

    rows.push({
      observationId: String(observation.id),
      occurredAt: String(observation.occurred_at),
      performanceScore,
      dayOfWeek: dimensions?.dayOfWeek ?? null,
      month: dimensions?.month ?? null,
      season: dimensions?.season ?? null,
    });
  }

  return rows;
}

/**
 * Fetches recommendation_approved/recommendation_rejected observations for a business
 * within the evaluation window, joined with their recommendation's
 * recommended_action_type via marketing_memory_evidence_links (the 'recommendation'
 * related_source link every such observation carries — see
 * lib/marketing-memory/service.ts). An observation with no resolvable action type is
 * dropped, not guessed.
 */
export async function fetchActionOutcomeEvidenceRows(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  windowStartIso: string
): Promise<ActionOutcomeEvidenceRow[]> {
  const { data: observations, error } = await supabase
    .from("marketing_memory_observations")
    .select("id, occurred_at, observation_type")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .in("observation_type", [
      ObservationTypes.RECOMMENDATION_APPROVED,
      ObservationTypes.RECOMMENDATION_REJECTED,
    ])
    .gte("occurred_at", windowStartIso)
    .order("occurred_at", { ascending: false })
    .limit(MAX_OBSERVATIONS_PER_EVALUATION);

  if (error || !observations || observations.length === 0) return [];

  const observationIds = observations.map((row: Record<string, unknown>) => String(row.id));

  const { data: links } = await supabase
    .from("marketing_memory_evidence_links")
    .select("observation_id, source_id")
    .eq("user_id", userId)
    .eq("source_type", "recommendation")
    .in("observation_id", observationIds);

  const recommendationIdByObservation = new Map<string, string>();
  for (const link of links ?? []) {
    recommendationIdByObservation.set(
      String((link as Record<string, unknown>).observation_id),
      String((link as Record<string, unknown>).source_id)
    );
  }

  const recommendationIds = Array.from(new Set(recommendationIdByObservation.values()));
  const actionTypeByRecommendation = new Map<string, string>();

  if (recommendationIds.length > 0) {
    const { data: recommendations } = await supabase
      .from("marketing_recommendations")
      .select("id, recommended_action_type")
      .eq("user_id", userId)
      .in("id", recommendationIds);

    for (const recommendation of recommendations ?? []) {
      actionTypeByRecommendation.set(
        String((recommendation as Record<string, unknown>).id),
        String((recommendation as Record<string, unknown>).recommended_action_type)
      );
    }
  }

  const rows: ActionOutcomeEvidenceRow[] = [];
  for (const observation of observations as Record<string, unknown>[]) {
    const observationId = String(observation.id);
    const recommendationId = recommendationIdByObservation.get(observationId);
    const actionType = recommendationId ? actionTypeByRecommendation.get(recommendationId) : undefined;
    if (!actionType) continue;

    rows.push({
      observationId,
      occurredAt: String(observation.occurred_at),
      approved: observation.observation_type === ObservationTypes.RECOMMENDATION_APPROVED,
      actionType,
    });
  }

  return rows;
}

// --- Learning reconciliation (writes) ----------------------------------------------

export async function getLiveLearningByKey(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  learningKey: string
): Promise<MarketingMemoryLearning | null> {
  const { data, error } = await supabase
    .from("marketing_memory_learnings")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .eq("learning_key", learningKey)
    .in("status", ["emerging", "active", "weakening", "inconclusive"])
    .maybeSingle();

  if (error || !data) return null;
  return mapLearningRow(data as Record<string, unknown>);
}

export async function insertLearning(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  result: LearningEvaluationResult
): Promise<MarketingMemoryLearning | null> {
  const { data, error } = await supabase
    .from("marketing_memory_learnings")
    .insert({
      user_id: userId,
      business_profile_id: businessProfileId,
      learning_family: result.learningFamily,
      time_dimension: result.timeDimension,
      subject_key: result.subjectKey,
      metric_key: result.metricKey,
      direction: result.direction,
      status: result.status,
      confidence_level: result.confidenceLevel,
      confidence_components: result.confidenceComponents,
      sample_size: result.sampleSize,
      supporting_count: result.supportingCount,
      contradicting_count: result.contradictingCount,
      neutral_count: result.neutralCount,
      excluded_count: result.excludedCount,
      effect_size: result.effectSize,
      comparison_baseline: result.comparisonBaseline,
      baseline_value: result.baselineValue,
      cohort_value: result.cohortValue,
      first_observed_at: result.firstObservedAt,
      last_observed_at: result.lastObservedAt,
      evaluation_window_days: result.evaluationWindowDays,
      recurrence_pattern: result.recurrencePattern,
      seasonal_recurrence_count: result.seasonalRecurrenceCount,
      confounder_codes: result.confounderCodes,
      summary: result.summary,
      internal_rationale: result.internalRationale,
      learning_key: result.learningKey,
      evaluated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return mapLearningRow(data as Record<string, unknown>);
}

export async function updateLearningInPlace(
  supabase: SupabaseClient,
  userId: string,
  learningId: string,
  result: LearningEvaluationResult
): Promise<boolean> {
  const { error } = await supabase
    .from("marketing_memory_learnings")
    .update({
      direction: result.direction,
      status: result.status,
      confidence_level: result.confidenceLevel,
      confidence_components: result.confidenceComponents,
      sample_size: result.sampleSize,
      supporting_count: result.supportingCount,
      contradicting_count: result.contradictingCount,
      neutral_count: result.neutralCount,
      excluded_count: result.excludedCount,
      effect_size: result.effectSize,
      baseline_value: result.baselineValue,
      cohort_value: result.cohortValue,
      first_observed_at: result.firstObservedAt,
      last_observed_at: result.lastObservedAt,
      evaluation_window_days: result.evaluationWindowDays,
      recurrence_pattern: result.recurrencePattern,
      seasonal_recurrence_count: result.seasonalRecurrenceCount,
      confounder_codes: result.confounderCodes,
      summary: result.summary,
      internal_rationale: result.internalRationale,
      evaluated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", learningId);

  return !error;
}

export async function supersedeLearning(
  supabase: SupabaseClient,
  userId: string,
  learningId: string,
  supersededByLearningId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("marketing_memory_learnings")
    .update({ status: "superseded", superseded_by_learning_id: supersededByLearningId })
    .eq("user_id", userId)
    .eq("id", learningId);

  return !error;
}

/**
 * Links a learning's supporting/contradicting observations as evidence (never
 * neutral — the learning row's own neutral_count already represents those, and linking
 * every neutral observation individually would be unnecessary row volume for no
 * additional evidentiary value). Uses upsert+ignoreDuplicates, exactly like Phase 1's
 * insertMarketingMemoryEvidenceLinks: idempotent, safe to call on every reconciliation.
 *
 * Known limitation (documented in docs/MARKETING_MEMORY_LEARNINGS.md): if an
 * observation's classification changes between reconciliation runs (e.g. was
 * supporting, is now contradicting), the existing link row's `contribution` value is
 * NOT updated in place -- this table is append-only by design, matching every other
 * Marketing Memory evidence table. The learning row's own supporting_count/
 * contradicting_count/confidence_components remain the single current-state source of
 * truth; evidence_links is a supplementary traceability trail, not guaranteed to be
 * perfectly current for every historical link.
 */
export async function linkLearningEvidence(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  learningId: string,
  result: LearningEvaluationResult
): Promise<void> {
  const rows: { source_type: string; source_id: string; contribution: string; idempotency_key: string }[] = [];

  for (const observationId of result.evidenceByClassification.supporting) {
    rows.push({
      source_type: "observation",
      source_id: observationId,
      contribution: EvidenceClassifications.SUPPORTING,
      idempotency_key: `${learningId}:observation:${observationId}`,
    });
  }
  for (const observationId of result.evidenceByClassification.contradicting) {
    rows.push({
      source_type: "observation",
      source_id: observationId,
      contribution: EvidenceClassifications.CONTRADICTING,
      idempotency_key: `${learningId}:observation:${observationId}`,
    });
  }

  if (rows.length === 0) return;

  await supabase
    .from("marketing_memory_evidence_links")
    .upsert(
      rows.map((row) => ({
        user_id: userId,
        business_profile_id: businessProfileId,
        learning_id: learningId,
        observation_id: null,
        link_type: null,
        source_type: row.source_type,
        source_id: row.source_id,
        contribution: row.contribution,
        idempotency_key: row.idempotency_key,
      })),
      { onConflict: "idempotency_key", ignoreDuplicates: true }
    );
}

/** Diagnostic/test retrieval — never a customer-facing or Marketing Director read path
 * in this PR. */
export async function getLearningsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  statusFilter?: MarketingMemoryLearning["status"][]
): Promise<MarketingMemoryLearning[]> {
  let query = supabase
    .from("marketing_memory_learnings")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false });

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => mapLearningRow(row));
}
