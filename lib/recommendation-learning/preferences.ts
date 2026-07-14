import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getPublishingJobsForUser } from "@/lib/publishing/publishingHistory";
import {
  gatherRecommendationOutcomeDetails,
  getHistoricalRecommendationSignalsForUser,
  hasConcreteVerdict,
  rateByBucket,
  timeOfDayFromDate,
} from "@/lib/recommendation-learning/signals";
import { MIN_BUCKET_SAMPLE_SIZE_FOR_REASON } from "@/lib/recommendation-learning/weights";
import type {
  BusinessPreferenceProfile,
  SuccessRateMap,
  TimeOfDayBucket,
} from "@/lib/recommendation-learning/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const REJECTION_RATE_THRESHOLD = 0.4;
const EDIT_RATE_THRESHOLD = 0.4;
const TOP_N = 3;

function topKeysByRate(map: SuccessRateMap, direction: "high" | "low", n: number): string[] {
  return Object.entries(map)
    .sort((a, b) => (direction === "high" ? b[1] - a[1] : a[1] - b[1]))
    .slice(0, n)
    .map(([key]) => key);
}

function mostFrequent(values: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

/**
 * Bucket-level minimum-sample gate: only buckets with at least
 * MIN_BUCKET_SAMPLE_SIZE_FOR_REASON eligible observations are considered trustworthy
 * enough to name in "frequently X" / "highest/lowest performing" lists. Recomputes
 * per-bucket eligible counts directly (rateByBucket only returns the rate, not the
 * denominator), so a bucket with a single fluke observation can never dominate a rate
 * map used for naming preferences.
 */
function bucketsMeetingMinSample(
  details: Awaited<ReturnType<typeof gatherRecommendationOutcomeDetails>>,
  bucketsFor: (detail: (typeof details)[number]) => string[],
  eligible: (detail: (typeof details)[number]) => boolean
): Set<string> {
  const counts = new Map<string, number>();
  for (const detail of details) {
    if (!eligible(detail)) continue;
    for (const bucket of bucketsFor(detail)) {
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, count]) => count >= MIN_BUCKET_SAMPLE_SIZE_FOR_REASON).map(([key]) => key));
}

function filterMapToBuckets(map: SuccessRateMap, allowed: Set<string>): SuccessRateMap {
  return Object.fromEntries(Object.entries(map).filter(([key]) => allowed.has(key)));
}

/**
 * Deterministic business preference profile, built on top of the same per-recommendation
 * detail gathering getHistoricalRecommendationSignalsForUser uses (never re-derives
 * lifecycle/usefulness-signal logic), plus one extra query for actual publish timing
 * (publishing_jobs.published_at). Every "frequently X" / "highest/lowest performing"
 * list is gated on real per-bucket sample size, not a single data point.
 */
export async function getBusinessPreferenceProfileForUser(
  userId: string,
  businessProfileId: string,
  supabaseClient?: SupabaseClient
): Promise<BusinessPreferenceProfile> {
  const supabase = supabaseClient ?? (await createClient());

  const [details, signals, jobs] = await Promise.all([
    gatherRecommendationOutcomeDetails(supabase, userId, businessProfileId),
    getHistoricalRecommendationSignalsForUser(userId, businessProfileId, supabase),
    getPublishingJobsForUser(supabase, userId),
  ]);

  const publishedJobs = jobs.filter((job) => job.published_at && job.business_profile_id === businessProfileId);
  const preferredPostingDays = mostFrequent(
    publishedJobs.map((j) => DAY_NAMES[new Date(j.published_at!).getUTCDay()]),
    TOP_N
  );
  const preferredPostingTimes = mostFrequent(
    publishedJobs.map((j) => timeOfDayFromDate(new Date(j.published_at!))),
    TOP_N
  ) as TimeOfDayBucket[];

  // Every detail already has a draft (see gatherRecommendationOutcomeDetails), so all are eligible.
  const actionTypeHasDraft = () => true;
  const actionTypeRejectionRates = rateByBucket(
    details,
    (d) => [d.actionType],
    actionTypeHasDraft,
    (d) => Boolean(d.summary.rejectedAt)
  );
  const actionTypeEditRates = rateByBucket(
    details,
    (d) => [d.actionType],
    actionTypeHasDraft,
    (d) => d.summary.wasEdited
  );

  const actionTypeBucketsWithSample = bucketsMeetingMinSample(details, (d) => [d.actionType], actionTypeHasDraft);
  const channelBucketsWithSample = bucketsMeetingMinSample(
    details,
    (d) => (d.channel ? [d.channel] : []),
    hasConcreteVerdict
  );

  const frequentlyRejectedTypes = Object.entries(filterMapToBuckets(actionTypeRejectionRates, actionTypeBucketsWithSample))
    .filter(([, rate]) => rate >= REJECTION_RATE_THRESHOLD)
    .map(([key]) => key);

  const frequentlyEditedTypes = Object.entries(filterMapToBuckets(actionTypeEditRates, actionTypeBucketsWithSample))
    .filter(([, rate]) => rate >= EDIT_RATE_THRESHOLD)
    .map(([key]) => key);

  const highestPerformingTypes = topKeysByRate(
    filterMapToBuckets(signals.actionTypeSuccessRates, actionTypeBucketsWithSample),
    "high",
    TOP_N
  );
  const highestPerformingChannels = topKeysByRate(
    filterMapToBuckets(signals.channelSuccessRates, channelBucketsWithSample),
    "high",
    TOP_N
  );
  const lowestPerformingChannels = topKeysByRate(
    filterMapToBuckets(signals.channelSuccessRates, channelBucketsWithSample),
    "low",
    TOP_N
  );

  const preferredChannels = highestPerformingChannels;
  const preferredRecommendationTypes = highestPerformingTypes;
  const preferredCategories = topKeysByRate(signals.categorySuccessRates, "high", TOP_N);

  return {
    preferredChannels,
    preferredRecommendationTypes,
    preferredCategories,
    preferredPostingDays,
    preferredPostingTimes,
    frequentlyRejectedTypes,
    frequentlyEditedTypes,
    highestPerformingTypes,
    highestPerformingChannels,
    lowestPerformingChannels,
    approvalRate: signals.overallApprovalRate,
    sampleSize: signals.historicalSampleSize,
  };
}

export async function getBusinessPreferenceProfileForCurrentUser(
  businessProfileId: string
): Promise<BusinessPreferenceProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getBusinessPreferenceProfileForUser(user.id, businessProfileId, supabase);
}
