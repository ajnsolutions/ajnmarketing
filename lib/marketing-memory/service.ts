import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecommendationOutcomeEvent } from "@/lib/recommendation-outcomes/types";
import type { AnalyticsSnapshot } from "@/lib/analytics/analyticsTypes";
import {
  observationTypeForOutcomeEvent,
  outcomeDirectionForObservationType,
  retentionClassificationForObservationType,
} from "@/lib/marketing-memory/mapping";
import { resolveContextSnapshotForObservation } from "@/lib/marketing-memory/contextNormalization";
import { buildEvidenceLinkIdempotencyKey, buildObservationIdempotencyKey } from "@/lib/marketing-memory/idempotency";
import { classifyError, sanitizeMetricSummary } from "@/lib/marketing-memory/metadata";
import {
  insertMarketingMemoryEvidenceLinks,
  insertMarketingMemoryObservation,
  type EvidenceLinkInput,
} from "@/lib/marketing-memory/persistence";
import {
  MarketingMemoryLinkTypes,
  MarketingMemoryObservationTypes,
  MarketingMemorySourceEntityTypes,
  MarketingMemorySourceSystems,
  type MarketingMemoryIngestionResult,
  type MarketingMemoryObservationType,
} from "@/lib/marketing-memory/types";

/** Structured, secret-free server log for one ingestion attempt — mirrors the
 * `console.info("[ScopeName]", {...})` convention already used in
 * lib/recommendation-outcomes/service.ts and lib/marketing-decisions/service.ts. */
function logMarketingMemoryEvent(line: {
  event: string;
  businessProfileId: string;
  observationType?: MarketingMemoryObservationType;
  sourceType?: string;
  sourceId?: string;
  observationId?: string;
  count?: number;
  result?: "success" | "error";
  errorClass?: string;
}): void {
  if (line.result === "error") {
    console.error("[MarketingMemory]", line);
  } else {
    console.info("[MarketingMemory]", line);
  }
}

async function recordEvidenceLinksSafely(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  observationId: string,
  links: { sourceType: EvidenceLinkInput["sourceType"]; sourceId: string; linkType: EvidenceLinkInput["linkType"] }[]
): Promise<void> {
  try {
    const inputs: EvidenceLinkInput[] = links.map((link) => ({
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      linkType: link.linkType,
      idempotencyKey: buildEvidenceLinkIdempotencyKey(observationId, link.sourceType, link.sourceId),
    }));

    const { inserted, error } = await insertMarketingMemoryEvidenceLinks(
      supabase,
      userId,
      businessProfileId,
      observationId,
      inputs
    );

    if (error) {
      logMarketingMemoryEvent({
        event: "evidence_link_failed",
        businessProfileId,
        observationId,
        result: "error",
        errorClass: error.code ?? "unknown",
      });
      return;
    }

    logMarketingMemoryEvent({
      event: "evidence_link_created",
      businessProfileId,
      observationId,
      count: inserted,
    });
  } catch (err) {
    logMarketingMemoryEvent({
      event: "evidence_link_failed",
      businessProfileId,
      observationId,
      result: "error",
      errorClass: classifyError(err),
    });
  }
}

/**
 * Records one factual observation for an already-persisted recommendation outcome
 * event. Best-effort and non-blocking by design: every failure path returns a result
 * object rather than throwing, so a caller in the middle of an authoritative mutation
 * (an approval, a publish) can never be broken by a memory-recording hiccup. Call only
 * after the outcome event has actually been inserted (never for a `duplicate: true`
 * result — nothing new happened, so there is nothing new to observe).
 */
export async function recordObservationForOutcomeEvent(
  supabase: SupabaseClient,
  event: RecommendationOutcomeEvent
): Promise<MarketingMemoryIngestionResult> {
  try {
    const observationType = observationTypeForOutcomeEvent(event.event_type);
    const outcomeDirection = outcomeDirectionForObservationType(observationType);
    const retentionClassification = retentionClassificationForObservationType(observationType);
    const occurredAt = new Date(event.created_at);

    const contextSnapshotId = await resolveContextSnapshotForObservation(supabase, {
      userId: event.user_id,
      businessProfileId: event.business_profile_id,
      occurredAt,
    });

    const idempotencyKey = buildObservationIdempotencyKey(
      event.business_profile_id,
      "recommendation_outcome_event",
      event.id
    );

    const result = await insertMarketingMemoryObservation(supabase, {
      userId: event.user_id,
      businessProfileId: event.business_profile_id,
      observationType,
      sourceSystem: MarketingMemorySourceSystems.RECOMMENDATION_OUTCOMES,
      sourceOutcomeEventId: event.id,
      sourceAnalyticsSnapshotId: null,
      contextSnapshotId,
      occurredAt: occurredAt.toISOString(),
      outcomeDirection,
      locationScope: null,
      metricSummary: sanitizeMetricSummary(event.metadata),
      retentionClassification,
      idempotencyKey,
    });

    if (result.duplicate) {
      logMarketingMemoryEvent({
        event: "observation_deduplicated",
        businessProfileId: event.business_profile_id,
        observationType,
        sourceType: "recommendation_outcome_event",
        sourceId: event.id,
      });
      return { recorded: false, duplicate: true, observationId: null };
    }

    if (!result.observation) {
      logMarketingMemoryEvent({
        event: "ingestion_failed",
        businessProfileId: event.business_profile_id,
        observationType,
        sourceType: "recommendation_outcome_event",
        sourceId: event.id,
        result: "error",
        errorClass: result.error?.code ?? "unknown",
      });
      return { recorded: false, duplicate: false, observationId: null };
    }

    logMarketingMemoryEvent({
      event: "observation_inserted",
      businessProfileId: event.business_profile_id,
      observationType,
      sourceType: "recommendation_outcome_event",
      sourceId: event.id,
      observationId: result.observation.id,
    });

    const links: { sourceType: EvidenceLinkInput["sourceType"]; sourceId: string; linkType: EvidenceLinkInput["linkType"] }[] = [
      {
        sourceType: MarketingMemorySourceEntityTypes.RECOMMENDATION_OUTCOME_EVENT,
        sourceId: event.id,
        linkType: MarketingMemoryLinkTypes.PRIMARY_SOURCE,
      },
      {
        sourceType: MarketingMemorySourceEntityTypes.RECOMMENDATION,
        sourceId: event.recommendation_id,
        linkType: MarketingMemoryLinkTypes.RELATED_SOURCE,
      },
    ];
    if (event.content_approval_id) {
      links.push({
        sourceType: MarketingMemorySourceEntityTypes.CONTENT_APPROVAL,
        sourceId: event.content_approval_id,
        linkType: MarketingMemoryLinkTypes.RELATED_SOURCE,
      });
    }
    if (event.publishing_job_id) {
      links.push({
        sourceType: MarketingMemorySourceEntityTypes.PUBLISHING_JOB,
        sourceId: event.publishing_job_id,
        linkType: MarketingMemoryLinkTypes.RELATED_SOURCE,
      });
    }

    await recordEvidenceLinksSafely(
      supabase,
      event.user_id,
      event.business_profile_id,
      result.observation.id,
      links
    );

    return { recorded: true, duplicate: false, observationId: result.observation.id };
  } catch (err) {
    logMarketingMemoryEvent({
      event: "ingestion_failed",
      businessProfileId: event.business_profile_id,
      result: "error",
      errorClass: classifyError(err),
    });
    return { recorded: false, duplicate: false, observationId: null };
  }
}

/**
 * Records one factual observation for a just-captured analytics snapshot. Same
 * best-effort, non-blocking contract as recordObservationForOutcomeEvent above.
 */
export async function recordObservationForAnalyticsSnapshot(
  supabase: SupabaseClient,
  snapshot: AnalyticsSnapshot
): Promise<MarketingMemoryIngestionResult> {
  try {
    const observationType = MarketingMemoryObservationTypes.ANALYTICS_SNAPSHOT_CAPTURED;
    const outcomeDirection = outcomeDirectionForObservationType(observationType);
    const retentionClassification = retentionClassificationForObservationType(observationType);
    const occurredAt = new Date(snapshot.created_at);

    const contextSnapshotId = await resolveContextSnapshotForObservation(supabase, {
      userId: snapshot.user_id,
      businessProfileId: snapshot.business_profile_id,
      occurredAt,
    });

    const idempotencyKey = buildObservationIdempotencyKey(
      snapshot.business_profile_id,
      "analytics_snapshot",
      snapshot.id
    );

    const result = await insertMarketingMemoryObservation(supabase, {
      userId: snapshot.user_id,
      businessProfileId: snapshot.business_profile_id,
      observationType,
      sourceSystem: MarketingMemorySourceSystems.ANALYTICS,
      sourceOutcomeEventId: null,
      sourceAnalyticsSnapshotId: snapshot.id,
      contextSnapshotId,
      occurredAt: occurredAt.toISOString(),
      outcomeDirection,
      locationScope: null,
      metricSummary: sanitizeMetricSummary({
        googleViews: snapshot.google_views,
        calls: snapshot.calls,
        websiteClicks: snapshot.website_clicks,
        engagementScore: snapshot.engagement_score,
      }),
      retentionClassification,
      idempotencyKey,
    });

    if (result.duplicate) {
      logMarketingMemoryEvent({
        event: "observation_deduplicated",
        businessProfileId: snapshot.business_profile_id,
        observationType,
        sourceType: "analytics_snapshot",
        sourceId: snapshot.id,
      });
      return { recorded: false, duplicate: true, observationId: null };
    }

    if (!result.observation) {
      logMarketingMemoryEvent({
        event: "ingestion_failed",
        businessProfileId: snapshot.business_profile_id,
        observationType,
        sourceType: "analytics_snapshot",
        sourceId: snapshot.id,
        result: "error",
        errorClass: result.error?.code ?? "unknown",
      });
      return { recorded: false, duplicate: false, observationId: null };
    }

    logMarketingMemoryEvent({
      event: "observation_inserted",
      businessProfileId: snapshot.business_profile_id,
      observationType,
      sourceType: "analytics_snapshot",
      sourceId: snapshot.id,
      observationId: result.observation.id,
    });

    await recordEvidenceLinksSafely(supabase, snapshot.user_id, snapshot.business_profile_id, result.observation.id, [
      {
        sourceType: MarketingMemorySourceEntityTypes.ANALYTICS_SNAPSHOT,
        sourceId: snapshot.id,
        linkType: MarketingMemoryLinkTypes.PRIMARY_SOURCE,
      },
    ]);

    return { recorded: true, duplicate: false, observationId: result.observation.id };
  } catch (err) {
    logMarketingMemoryEvent({
      event: "ingestion_failed",
      businessProfileId: snapshot.business_profile_id,
      result: "error",
      errorClass: classifyError(err),
    });
    return { recorded: false, duplicate: false, observationId: null };
  }
}
