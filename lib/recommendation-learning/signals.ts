import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getContentApprovalForRecommendation,
  getRecommendationsForBusiness,
} from "@/lib/recommendation-outcomes/persistence";
import { summarizeRecommendationOutcomeForUser } from "@/lib/recommendation-outcomes/service";
import type { RecommendationOutcomeSummary } from "@/lib/recommendation-outcomes/types";
import { getMarketingOpportunitiesByIdsForUser } from "@/lib/marketing-opportunities/persistence";
import { inferPlatformFromContentType } from "@/lib/publishing-queue/persistence";
import { COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE } from "@/lib/recommendation-learning/weights";
import {
  Seasons,
  TimeOfDayBuckets,
  type HistoricalRecommendationSignals,
  type Season,
  type SuccessRateMap,
  type TimeOfDayBucket,
} from "@/lib/recommendation-learning/types";

/** Meteorological seasons, deterministic from calendar month -- no external data. */
export function seasonFromDate(date: Date): Season {
  const month = date.getUTCMonth(); // 0-11
  if (month === 11 || month === 0 || month === 1) return Seasons.WINTER;
  if (month >= 2 && month <= 4) return Seasons.SPRING;
  if (month >= 5 && month <= 7) return Seasons.SUMMER;
  return Seasons.FALL;
}

/**
 * UTC hour-of-day bucket. business_profiles has no stored timezone column, so this is a
 * best-effort, UTC-based bucketing -- documented as a known limitation, not silently
 * treated as the business's local time.
 */
export function timeOfDayFromDate(date: Date): TimeOfDayBucket {
  const hour = date.getUTCHours();
  if (hour >= 5 && hour < 12) return TimeOfDayBuckets.MORNING;
  if (hour >= 12 && hour < 17) return TimeOfDayBuckets.AFTERNOON;
  if (hour >= 17 && hour < 21) return TimeOfDayBuckets.EVENING;
  return TimeOfDayBuckets.NIGHT;
}

export type RecommendationDetail = {
  recommendationId: string;
  actionType: string;
  createdAt: string;
  relatedOpportunityIds: string[];
  summary: RecommendationOutcomeSummary;
  channel: string | null;
  categories: string[];
};

/**
 * Generic bucketed rate: for every bucket a detail belongs to, what fraction of that
 * bucket's observations satisfy `matches`? `eligible` scopes which details count as a
 * real observation at all for this rate (e.g. "usefulness signal is known" for success
 * rates, or "a draft exists" for rejection/edit rates) -- a bucket with zero eligible
 * observations is omitted entirely, never fabricated as 0.
 */
export function rateByBucket(
  details: RecommendationDetail[],
  bucketsFor: (detail: RecommendationDetail) => string[],
  eligible: (detail: RecommendationDetail) => boolean,
  matches: (detail: RecommendationDetail) => boolean
): SuccessRateMap {
  const counts = new Map<string, { matched: number; eligible: number }>();

  for (const detail of details) {
    if (!eligible(detail)) continue;

    for (const bucket of bucketsFor(detail)) {
      const entry = counts.get(bucket) ?? { matched: 0, eligible: 0 };
      entry.eligible += 1;
      if (matches(detail)) entry.matched += 1;
      counts.set(bucket, entry);
    }
  }

  const result: SuccessRateMap = {};
  for (const [bucket, { matched, eligible: eligibleCount }] of counts) {
    result[bucket] = eligibleCount > 0 ? matched / eligibleCount : 0;
  }
  return result;
}

/**
 * Eligible only for a concrete verdict: "positive" or "negative". Deliberately excludes
 * both "unknown" (no verdict yet -- awaiting review, still in progress) AND "neutral"
 * (PR #27's usefulnessSignal uses "neutral" for both in-progress states AND provider/
 * OAuth publishing failures) -- a publish_failed recommendation must never drag down an
 * action type/channel/category/season's success rate, per this milestone's explicit
 * "provider failures remain neutral" requirement. Excluding "neutral" entirely, rather
 * than counting it as "not positive", is what makes that guarantee hold here.
 */
export function hasConcreteVerdict(detail: RecommendationDetail): boolean {
  return detail.summary.usefulnessSignal === "positive" || detail.summary.usefulnessSignal === "negative";
}

function successRateByBucket(
  details: RecommendationDetail[],
  bucketsFor: (detail: RecommendationDetail) => string[]
): SuccessRateMap {
  return rateByBucket(
    details,
    bucketsFor,
    hasConcreteVerdict,
    (d) => d.summary.usefulnessSignal === "positive"
  );
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Gathers one RecommendationDetail per recommendation that has at least a draft
 * (recommendations still at "recommended" -- no draft yet -- are excluded, since there
 * is nothing to learn from them). Exported so preferences.ts can compute its own
 * bucketed rates (rejection/edit, not just success) from the same underlying data
 * without a second round of DB queries.
 */
export async function gatherRecommendationOutcomeDetails(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string
): Promise<RecommendationDetail[]> {
  const recommendations = await getRecommendationsForBusiness(supabase, userId, businessProfileId);

  const allOpportunityIds = [
    ...new Set(recommendations.flatMap((r) => (r.related_opportunity_ids as string[] | null) ?? [])),
  ];
  const opportunities = await getMarketingOpportunitiesByIdsForUser(supabase, userId, allOpportunityIds);
  const categoryByOpportunityId = new Map(opportunities.map((o) => [o.id, o.category as string]));

  const details: RecommendationDetail[] = [];
  for (const rec of recommendations) {
    const recommendationId = String(rec.id);
    const summary = await summarizeRecommendationOutcomeForUser(userId, recommendationId, supabase);
    if (summary.lifecycleStatus === "recommended") continue;

    const approval = await getContentApprovalForRecommendation(supabase, userId, recommendationId);
    const channel = approval
      ? inferPlatformFromContentType(String(approval.content_type ?? ""))
      : null;

    const relatedOpportunityIds = ((rec.related_opportunity_ids as string[] | null) ?? []).map(String);
    const categories = [
      ...new Set(
        relatedOpportunityIds
          .map((id) => categoryByOpportunityId.get(id))
          .filter((c): c is string => Boolean(c))
      ),
    ];

    details.push({
      recommendationId,
      actionType: String(rec.recommended_action_type),
      createdAt: String(rec.created_at),
      relatedOpportunityIds,
      summary,
      channel,
      categories,
    });
  }

  return details;
}

/**
 * Deterministic aggregate historical signals for one tenant/business, built entirely
 * from PR #27's authoritative outcome data (summarizeRecommendationOutcomeForUser per
 * recommendation) -- never re-implements lifecycle/usefulness-signal derivation, only
 * aggregates it across a business's full recommendation history. Only ever reports what
 * the data actually supports: a bucket with zero non-"unknown"-signal observations is
 * simply absent from the relevant map, never fabricated as 0 or 50.
 */
export async function getHistoricalRecommendationSignalsForUser(
  userId: string,
  businessProfileId: string,
  supabaseClient?: SupabaseClient
): Promise<HistoricalRecommendationSignals> {
  const supabase = supabaseClient ?? (await createClient());

  const details = await gatherRecommendationOutcomeDetails(supabase, userId, businessProfileId);

  const historicalSampleSize = details.length;
  const confidenceInHistory =
    historicalSampleSize === 0 ? 0 : Math.min(1, historicalSampleSize / COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE);

  const concreteVerdictDetails = details.filter(hasConcreteVerdict);
  const averageUsefulScore =
    concreteVerdictDetails.length > 0
      ? concreteVerdictDetails.filter((d) => d.summary.usefulnessSignal === "positive").length /
        concreteVerdictDetails.length
      : null;

  const approvedCount = details.filter((d) => d.summary.approvedAt).length;
  const rejectedCount = details.filter((d) => d.summary.rejectedAt).length;
  const editedCount = details.filter((d) => d.summary.wasEdited).length;

  const publishAttempted = details.filter((d) =>
    ["published", "measured", "publish_failed"].includes(d.summary.lifecycleStatus)
  );
  const publishSucceeded = publishAttempted.filter((d) => d.summary.lifecycleStatus !== "publish_failed");

  const publishedOrMeasured = details.filter((d) =>
    ["published", "measured"].includes(d.summary.lifecycleStatus)
  );
  const measured = publishedOrMeasured.filter((d) => d.summary.lifecycleStatus === "measured");

  const approvedWithDraftTime = details.filter((d) => d.summary.approvedAt && d.summary.draftCreatedAt);
  const averageTimeToApprovalHours = average(
    approvedWithDraftTime.map(
      (d) =>
        (new Date(d.summary.approvedAt!).getTime() - new Date(d.summary.draftCreatedAt!).getTime()) /
        (1000 * 60 * 60)
    )
  );

  const averageEditIntensity =
    historicalSampleSize > 0 ? average(details.map((d) => d.summary.editCount)) : null;

  const channelSuccessRates = successRateByBucket(details, (d) => (d.channel ? [d.channel] : []));
  const actionTypeSuccessRates = successRateByBucket(details, (d) => [d.actionType]);
  const categorySuccessRates = successRateByBucket(details, (d) => d.categories);
  const seasonalSuccessRates = successRateByBucket(details, (d) => [seasonFromDate(new Date(d.createdAt))]);
  const timeOfDaySuccessRates = successRateByBucket(details, (d) => [timeOfDayFromDate(new Date(d.createdAt))]);
  const categoryEditRates = rateByBucket(
    details,
    (d) => d.categories,
    () => true,
    (d) => d.summary.wasEdited
  );

  return {
    historicalSampleSize,
    confidenceInHistory,
    overallApprovalRate: historicalSampleSize > 0 ? approvedCount / historicalSampleSize : null,
    overallRejectionRate: historicalSampleSize > 0 ? rejectedCount / historicalSampleSize : null,
    overallEditRate: historicalSampleSize > 0 ? editedCount / historicalSampleSize : null,
    overallPublishSuccessRate: publishAttempted.length > 0 ? publishSucceeded.length / publishAttempted.length : null,
    overallPerformanceRate: publishedOrMeasured.length > 0 ? measured.length / publishedOrMeasured.length : null,
    averageUsefulScore,
    channelSuccessRates,
    actionTypeSuccessRates,
    categorySuccessRates,
    seasonalSuccessRates,
    timeOfDaySuccessRates,
    categoryEditRates,
    averageTimeToApprovalHours,
    averageEditIntensity,
  };
}

export async function getHistoricalRecommendationSignalsForCurrentUser(
  businessProfileId: string
): Promise<HistoricalRecommendationSignals | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getHistoricalRecommendationSignalsForUser(user.id, businessProfileId, supabase);
}
