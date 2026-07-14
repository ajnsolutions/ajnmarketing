/**
 * Deterministic, plain-language reason translation. Two sources, both grounded in real
 * data, never rewritten by AI:
 *
 * 1. Market-side reasons, from the actual OpportunityCategory vocabulary
 *    (lib/marketing-opportunities/types.ts) behind this recommendation.
 * 2. Historical reasons, from PR #28's AdaptiveScoreBreakdown.reasons -- translated by
 *    reasonType + the SIGN of reasonWeight only. The raw weight/percentage/description
 *    from that breakdown is never echoed here; only the plain-language template is used.
 *
 * Note: the task brief's illustrative "competitor_activity_detected" example does not
 * correspond to any real OpportunityCategory or evidence field in this codebase today
 * (there is no competitor-detection opportunity type) -- it is deliberately not
 * implemented here to avoid fabricating a signal the platform doesn't actually produce.
 * See docs/CLIENT_RECOMMENDATION_EXPERIENCE.md.
 */

import type { OpportunityCategory } from "@/lib/marketing-opportunities/types";
import type { AdaptiveScoreBreakdown, RecommendationReasonType } from "@/lib/recommendation-learning/types";
import { MIN_BUCKET_SAMPLE_SIZE_FOR_REASON } from "@/lib/recommendation-learning/weights";
import type { ClientReason } from "@/lib/recommendation-presentation/types";

const CATEGORY_REASON_TEXT: Record<OpportunityCategory, string> = {
  missing_gbp_posts: "Your Google Business Profile hasn't had a new post in a while.",
  low_review_activity: "Review activity has slowed down recently.",
  seasonal: "This fits the current season for your business.",
  holiday: "An upcoming holiday makes this timely.",
  weather: "Current weather conditions make this topic relevant right now.",
  local_event: "A local event happening nearby makes this a good moment to post.",
  declining_engagement: "Engagement has been declining recently.",
  missing_business_info: "Some of your business profile details are incomplete.",
  missing_photos: "Your profile could use some fresh photos.",
  stale_website_content: "Your website content hasn't been refreshed in a while.",
};

export function translateOpportunityCategoryReasons(categories: OpportunityCategory[]): ClientReason[] {
  const seen = new Set<string>();
  const reasons: ClientReason[] = [];

  for (const category of categories) {
    const text = CATEGORY_REASON_TEXT[category];
    if (text && !seen.has(text)) {
      seen.add(text);
      reasons.push({ text });
    }
  }

  return reasons;
}

const POSITIVE_HISTORICAL_TEXT: Partial<Record<RecommendationReasonType, string>> = {
  action_type_performance: "You've approved recommendations like this most of the time.",
  channel_performance: "This channel has performed well for your business.",
  category_performance: "This type of opportunity has worked well for your business before.",
  seasonal_performance: "This timing has worked well for your business in the past.",
};

const NEGATIVE_HISTORICAL_TEXT: Partial<Record<RecommendationReasonType, string>> = {
  action_type_performance: "Recommendations like this haven't been approved as often -- we'll keep learning what fits best.",
  channel_performance: "This channel hasn't performed as strongly for your business.",
  category_performance: "This type of opportunity hasn't worked as well for your business before.",
  seasonal_performance: "This timing hasn't worked as well for your business before.",
  edit_intensity: "Similar drafts have needed noticeable edits before approval -- we'll keep refining our approach.",
};

const STILL_LEARNING_TEXT =
  "We're still learning what works best for your business -- there isn't much history to go on yet.";

/**
 * Translates the historical portion of an AdaptiveScoreBreakdown into client-safe
 * reasons. Below MIN_BUCKET_SAMPLE_SIZE_FOR_REASON total historical observations, no
 * per-dimension claim is made at all -- a single honest "still learning" reason is
 * returned instead, regardless of what direction the (statistically thin) signals point.
 */
export function translateHistoricalReasons(breakdown: AdaptiveScoreBreakdown): ClientReason[] {
  if (breakdown.historicalSampleSize < MIN_BUCKET_SAMPLE_SIZE_FOR_REASON) {
    return [{ text: STILL_LEARNING_TEXT }];
  }

  const reasons: ClientReason[] = [];
  for (const reason of breakdown.reasons) {
    if (reason.reasonType === "market_opportunity" || reason.reasonType === "cold_start") continue;

    const table = reason.reasonWeight >= 0 ? POSITIVE_HISTORICAL_TEXT : NEGATIVE_HISTORICAL_TEXT;
    const text = table[reason.reasonType];
    if (text) reasons.push({ text });
  }

  return reasons;
}

const MAX_SUPPORTING_REASONS = 4;

/**
 * Combines market-side and historical reasons into the final 2-4 supporting reasons
 * shown in the recommendation package, market-side first (the concrete, present-tense
 * "why now" signal), then historical (the business's own track record).
 */
export function buildSupportingReasons(
  categories: OpportunityCategory[],
  breakdown: AdaptiveScoreBreakdown
): ClientReason[] {
  const combined = [...translateOpportunityCategoryReasons(categories), ...translateHistoricalReasons(breakdown)];
  return combined.slice(0, MAX_SUPPORTING_REASONS);
}
