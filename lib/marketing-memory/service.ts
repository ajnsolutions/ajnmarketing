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

/**
 * Records one factual observation when a Campaign Intelligence campaign completes.
 * Evidence only — never writes learnings. Best-effort and non-blocking.
 */
export async function recordObservationForCampaignCompletion(
  supabase: SupabaseClient,
  campaign: {
    id: string;
    user_id: string;
    business_profile_id: string;
    campaign_type: string;
    objective: string;
    metrics: Record<string, unknown>;
    updated_at?: string;
  }
): Promise<MarketingMemoryIngestionResult> {
  try {
    const observationType = MarketingMemoryObservationTypes.CAMPAIGN_COMPLETED;
    const outcomeDirection = outcomeDirectionForObservationType(observationType);
    const retentionClassification = retentionClassificationForObservationType(observationType);
    const occurredAt = new Date(campaign.updated_at ?? Date.now());

    const contextSnapshotId = await resolveContextSnapshotForObservation(supabase, {
      userId: campaign.user_id,
      businessProfileId: campaign.business_profile_id,
      occurredAt,
    });

    const idempotencyKey = buildObservationIdempotencyKey(
      campaign.business_profile_id,
      "campaign",
      campaign.id
    );

    const result = await insertMarketingMemoryObservation(supabase, {
      userId: campaign.user_id,
      businessProfileId: campaign.business_profile_id,
      observationType,
      sourceSystem: MarketingMemorySourceSystems.CAMPAIGN_INTELLIGENCE,
      sourceOutcomeEventId: null,
      sourceAnalyticsSnapshotId: null,
      sourceCampaignId: campaign.id,
      contextSnapshotId,
      occurredAt: occurredAt.toISOString(),
      outcomeDirection,
      locationScope: null,
      metricSummary: sanitizeMetricSummary({
        campaignType: campaign.campaign_type,
        objective: campaign.objective,
        ...campaign.metrics,
      }),
      retentionClassification,
      idempotencyKey,
    });

    if (result.duplicate) {
      logMarketingMemoryEvent({
        event: "observation_deduplicated",
        businessProfileId: campaign.business_profile_id,
        observationType,
        sourceType: "campaign",
        sourceId: campaign.id,
      });
      return { recorded: false, duplicate: true, observationId: null };
    }

    if (!result.observation) {
      logMarketingMemoryEvent({
        event: "ingestion_failed",
        businessProfileId: campaign.business_profile_id,
        observationType,
        sourceType: "campaign",
        sourceId: campaign.id,
        result: "error",
        errorClass: result.error?.code ?? "unknown",
      });
      return { recorded: false, duplicate: false, observationId: null };
    }

    logMarketingMemoryEvent({
      event: "observation_inserted",
      businessProfileId: campaign.business_profile_id,
      observationType,
      sourceType: "campaign",
      sourceId: campaign.id,
      observationId: result.observation.id,
    });

    await recordEvidenceLinksSafely(
      supabase,
      campaign.user_id,
      campaign.business_profile_id,
      result.observation.id,
      [
        {
          sourceType: MarketingMemorySourceEntityTypes.CAMPAIGN,
          sourceId: campaign.id,
          linkType: MarketingMemoryLinkTypes.PRIMARY_SOURCE,
        },
      ]
    );

    return { recorded: true, duplicate: false, observationId: result.observation.id };
  } catch (err) {
    logMarketingMemoryEvent({
      event: "ingestion_failed",
      businessProfileId: campaign.business_profile_id,
      result: "error",
      errorClass: classifyError(err),
    });
    return { recorded: false, duplicate: false, observationId: null };
  }
}

/**
 * Records one factual observation when an Experimentation Engine experiment completes.
 * Evidence only — never writes learnings. Best-effort and non-blocking.
 */
export async function recordObservationForExperimentCompletion(
  supabase: SupabaseClient,
  experiment: {
    id: string;
    user_id: string;
    business_profile_id: string;
    experiment_type: string;
    title: string;
    variants: unknown;
    outcome: {
      direction?: string;
      confidenceLevel?: string;
      summary?: string;
      winningVariantKey?: string | null;
      primaryMetric?: string;
      liftPercent?: number | null;
    };
    metrics: Record<string, unknown>;
    created_from_recommendation_id: string;
    related_campaign_id?: string | null;
    completed_at?: string | null;
    updated_at?: string;
  },
): Promise<MarketingMemoryIngestionResult> {
  try {
    const observationType = MarketingMemoryObservationTypes.EXPERIMENT_COMPLETED;
    const outcomeDirection = outcomeDirectionForObservationType(observationType);
    const retentionClassification = retentionClassificationForObservationType(observationType);
    const occurredAt = new Date(
      experiment.completed_at ?? experiment.updated_at ?? Date.now(),
    );

    const contextSnapshotId = await resolveContextSnapshotForObservation(supabase, {
      userId: experiment.user_id,
      businessProfileId: experiment.business_profile_id,
      occurredAt,
    });

    const idempotencyKey = buildObservationIdempotencyKey(
      experiment.business_profile_id,
      "experiment",
      experiment.id,
    );

    const outcome = experiment.outcome ?? {};
    const primaryMetric =
      typeof outcome.primaryMetric === "string" ? outcome.primaryMetric : null;
    const metrics = (experiment.metrics ?? {}) as Record<string, unknown>;

    // [Claude review] sanitizeMetricSummary only preserves top-level scalar values —
    // nested objects/arrays are silently dropped (`continue` in metadata.ts). A prior
    // version nested variantSummary/measuredOutcome/supportingMetrics as objects/arrays,
    // so the three fields the review explicitly expects (variant summary, measured
    // outcome, supporting metrics) never actually reached the stored observation; only
    // experimentType/confidenceLevel/recommendationId/campaignId survived. Flattened to
    // scalars here so every field actually persists. Bounded to the sanitizer's 12-key
    // cap (metadata.ts MAX_METADATA_KEYS) — the full 12-field A/B metrics object is not
    // included wholesale (that alone would exceed the cap); only the primary metric's
    // two values are, since that is what the outcome is actually computed from.
    const variantLabels = Array.isArray(experiment.variants)
      ? (experiment.variants as Array<{ label?: unknown }>)
          .map((variant) => (typeof variant.label === "string" ? variant.label : ""))
          .filter(Boolean)
          .join(" vs ")
      : "";

    const result = await insertMarketingMemoryObservation(supabase, {
      userId: experiment.user_id,
      businessProfileId: experiment.business_profile_id,
      observationType,
      sourceSystem: MarketingMemorySourceSystems.MARKETING_EXPERIMENTATION,
      sourceOutcomeEventId: null,
      sourceAnalyticsSnapshotId: null,
      sourceCampaignId: null,
      sourceExperimentId: experiment.id,
      contextSnapshotId,
      occurredAt: occurredAt.toISOString(),
      outcomeDirection,
      locationScope: null,
      metricSummary: sanitizeMetricSummary({
        experimentType: experiment.experiment_type,
        variantSummary: variantLabels,
        outcomeDirection: outcome.direction ?? null,
        outcomeSummary: outcome.summary ?? null,
        winningVariantKey: outcome.winningVariantKey ?? null,
        confidenceLevel: outcome.confidenceLevel ?? null,
        liftPercent: outcome.liftPercent ?? null,
        primaryMetric,
        primaryMetricValueA: primaryMetric ? (metrics[`${primaryMetric}A`] ?? null) : null,
        primaryMetricValueB: primaryMetric ? (metrics[`${primaryMetric}B`] ?? null) : null,
        recommendationId: experiment.created_from_recommendation_id,
        campaignId: experiment.related_campaign_id ?? null,
      }),
      retentionClassification,
      idempotencyKey,
    });

    if (result.duplicate) {
      logMarketingMemoryEvent({
        event: "observation_deduplicated",
        businessProfileId: experiment.business_profile_id,
        observationType,
        sourceType: "experiment",
        sourceId: experiment.id,
      });
      return { recorded: false, duplicate: true, observationId: null };
    }

    if (!result.observation) {
      logMarketingMemoryEvent({
        event: "ingestion_failed",
        businessProfileId: experiment.business_profile_id,
        observationType,
        sourceType: "experiment",
        sourceId: experiment.id,
        result: "error",
        errorClass: result.error?.code ?? "unknown",
      });
      return { recorded: false, duplicate: false, observationId: null };
    }

    logMarketingMemoryEvent({
      event: "observation_inserted",
      businessProfileId: experiment.business_profile_id,
      observationType,
      sourceType: "experiment",
      sourceId: experiment.id,
      observationId: result.observation.id,
    });

    await recordEvidenceLinksSafely(
      supabase,
      experiment.user_id,
      experiment.business_profile_id,
      result.observation.id,
      [
        {
          sourceType: MarketingMemorySourceEntityTypes.EXPERIMENT,
          sourceId: experiment.id,
          linkType: MarketingMemoryLinkTypes.PRIMARY_SOURCE,
        },
      ],
    );

    return { recorded: true, duplicate: false, observationId: result.observation.id };
  } catch (err) {
    logMarketingMemoryEvent({
      event: "ingestion_failed",
      businessProfileId: experiment.business_profile_id,
      result: "error",
      errorClass: classifyError(err),
    });
    return { recorded: false, duplicate: false, observationId: null };
  }
}
