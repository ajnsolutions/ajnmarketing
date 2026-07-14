/**
 * Pure, deterministic adjustment layer -- no I/O, no randomness, no AI. Takes a base
 * (current-market-only) score/confidence produced by the EXISTING, UNCHANGED
 * lib/marketing-decisions/scoring.ts + decisionEngine.ts, plus this business's
 * historical signals, and returns an adjusted score/confidence with structured,
 * explainable reasons. See docs/ADAPTIVE_RECOMMENDATION_INTELLIGENCE.md.
 */

import type { MarketingRecommendationDraft, RecommendedActionType } from "@/lib/marketing-decisions/types";
import { urgencyFromPriorityScore } from "@/lib/marketing-decisions/scoring";
import {
  isContentSupportedActionType,
  mapActionTypeToContentTarget,
} from "@/lib/marketing-decisions/actionTypeContentMapping";
import { inferPlatformFromContentType } from "@/lib/publishing-queue/persistence";
import {
  CURRENT_MARKET_WEIGHT,
  HEAVY_EDIT_RATE_THRESHOLD,
  HISTORICAL_WEIGHT,
  MAX_HISTORICAL_ADJUSTMENT_POINTS,
} from "@/lib/recommendation-learning/weights";
import { seasonFromDate, timeOfDayFromDate } from "@/lib/recommendation-learning/signals";
import {
  RecommendationReasonTypes,
  type AdaptiveScoreBreakdown,
  type HistoricalRecommendationSignals,
  type RecommendationReason,
  type Season,
  type TimeOfDayBucket,
} from "@/lib/recommendation-learning/types";

export type AdaptiveScoringInput = {
  actionType: RecommendedActionType;
  baseScore: number;
  baseConfidence: number;
  /** Categories of this recommendation's related opportunities -- resolved by the
   * caller (which already has the opportunity rows in memory), never fetched here. */
  categories: string[];
  /** Resolved channel proxy (inferPlatformFromContentType), or null for action types
   * that don't map to a content type (e.g. request_reviews). */
  channel: string | null;
  season: Season;
  /** Accepted for future use / debug display; not currently folded into the score
   * adjustment (see docs -- a deliberately conservative scope decision to avoid
   * over-fitting on a low-signal dimension). */
  timeOfDay: TimeOfDayBucket;
};

function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

/** Maps a 0-1 success rate to a signed [-1, 1] contribution, centered at 0.5 = neutral. */
function signalFromRate(rate: number): number {
  return (rate - 0.5) * 2;
}

type Contribution = {
  reasonType: RecommendationReason["reasonType"];
  signal: number;
  description: (direction: "positive" | "negative", ratePercent: number) => string;
};

function collectContributions(
  input: AdaptiveScoringInput,
  signals: HistoricalRecommendationSignals
): Array<Contribution & { rate: number }> {
  const contributions: Array<Contribution & { rate: number | undefined }> = [
    {
      reasonType: RecommendationReasonTypes.ACTION_TYPE_PERFORMANCE,
      rate: signals.actionTypeSuccessRates[input.actionType],
      signal: 0,
      description: (direction, pct) =>
        direction === "positive"
          ? `Recommendations like this (${input.actionType}) were well-received ${pct}% of the time historically.`
          : `Recommendations like this (${input.actionType}) were well-received only ${pct}% of the time historically.`,
    },
    {
      reasonType: RecommendationReasonTypes.CHANNEL_PERFORMANCE,
      rate: input.channel ? signals.channelSuccessRates[input.channel] : undefined,
      signal: 0,
      description: (direction, pct) =>
        direction === "positive"
          ? `${input.channel} content performs well for this business (${pct}% historically).`
          : `${input.channel} content has underperformed for this business (${pct}% historically).`,
    },
    ...input.categories.map((category): Contribution & { rate: number | undefined } => ({
      reasonType: RecommendationReasonTypes.CATEGORY_PERFORMANCE,
      rate: signals.categorySuccessRates[category],
      signal: 0,
      description: (direction: "positive" | "negative", pct: number) =>
        direction === "positive"
          ? `"${category}" opportunities have performed well historically (${pct}%).`
          : `"${category}" opportunities have underperformed historically (${pct}%).`,
    })),
    {
      reasonType: RecommendationReasonTypes.SEASONAL_PERFORMANCE,
      rate: signals.seasonalSuccessRates[input.season],
      signal: 0,
      description: (direction, pct) =>
        direction === "positive"
          ? `${input.season} recommendations perform above average for this business (${pct}%).`
          : `${input.season} recommendations perform below average for this business (${pct}%).`,
    },
  ];

  const rateBasedContributions = contributions
    .filter((c): c is Contribution & { rate: number } => c.rate !== undefined)
    .map((c) => ({ ...c, signal: signalFromRate(c.rate) }));

  // Edit intensity is negative-only: a category rarely edited is not rewarded, but one
  // heavily edited (rate above HEAVY_EDIT_RATE_THRESHOLD) is penalized -- editing itself
  // isn't a failure signal (see rejection vs. edit distinction), only a HIGH edit rate
  // suggests generated drafts for this category consistently miss the mark.
  const editContributions = input.categories
    .map((category) => ({ category, rate: signals.categoryEditRates[category] }))
    .filter((c): c is { category: string; rate: number } => c.rate !== undefined && c.rate > HEAVY_EDIT_RATE_THRESHOLD)
    .map(
      ({ category, rate }): Contribution & { rate: number } => ({
        reasonType: RecommendationReasonTypes.EDIT_INTENSITY,
        rate,
        signal: -((rate - HEAVY_EDIT_RATE_THRESHOLD) / (1 - HEAVY_EDIT_RATE_THRESHOLD)),
        description: () =>
          `"${category}" drafts are heavily edited before approval (${Math.round(rate * 100)}% of the time) -- generated content may need a different approach.`,
      })
    );

  return [...rateBasedContributions, ...editContributions];
}

/**
 * Combines base (current-market) score/confidence with this business's historical
 * signals into a final, explainable score/confidence. Deterministic and side-effect
 * free -- calling this twice with the same inputs always produces the same output.
 */
export function computeAdaptiveRecommendationScore(
  input: AdaptiveScoringInput,
  signals: HistoricalRecommendationSignals
): AdaptiveScoreBreakdown {
  const reasons: RecommendationReason[] = [
    {
      reasonType: RecommendationReasonTypes.MARKET_OPPORTUNITY,
      reasonWeight: input.baseScore,
      reasonDescription: `Current market opportunity score: ${input.baseScore}/100, based on severity, confidence, and timing.`,
      reasonSource: "market",
    },
  ];

  if (signals.historicalSampleSize === 0) {
    reasons.push({
      reasonType: RecommendationReasonTypes.COLD_START,
      reasonWeight: 0,
      reasonDescription: "No historical recommendation outcomes yet for this business -- score is based on current market conditions only.",
      reasonSource: "history",
    });

    return {
      baseScore: input.baseScore,
      baseConfidence: input.baseConfidence,
      historicalAdjustment: 0,
      historicalConfidence: 50,
      finalScore: input.baseScore,
      finalConfidence: input.baseConfidence,
      reasons,
      historicalSampleSize: 0,
    };
  }

  const contributions = collectContributions(input, signals);

  let historicalAdjustment = 0;
  if (contributions.length > 0) {
    const perContributionCap = MAX_HISTORICAL_ADJUSTMENT_POINTS / contributions.length;
    for (const contribution of contributions) {
      const weight = clampScore(50 + contribution.signal * 50) - 50; // -50..50 scale
      const points = (weight / 50) * perContributionCap * signals.confidenceInHistory;
      historicalAdjustment += points;

      const direction: "positive" | "negative" = contribution.signal >= 0 ? "positive" : "negative";
      const ratePercent = Math.round(((contribution.signal + 1) / 2) * 100);
      reasons.push({
        reasonType: contribution.reasonType,
        reasonWeight: Math.round(points * 100) / 100,
        reasonDescription: contribution.description(direction, ratePercent),
        reasonSource: "history",
      });
    }
  } else {
    reasons.push({
      reasonType: RecommendationReasonTypes.COLD_START,
      reasonWeight: 0,
      reasonDescription: `${signals.historicalSampleSize} past recommendation(s) recorded, but none match this recommendation's action type, channel, category, or season closely enough yet to adjust the score.`,
      reasonSource: "history",
    });
  }

  historicalAdjustment = Math.max(
    -MAX_HISTORICAL_ADJUSTMENT_POINTS,
    Math.min(MAX_HISTORICAL_ADJUSTMENT_POINTS, historicalAdjustment)
  );

  const finalScore = clampScore(input.baseScore + historicalAdjustment);

  const overallSignal =
    contributions.length > 0
      ? contributions.reduce((sum, c) => sum + c.signal, 0) / contributions.length
      : 0;
  const historicalConfidence = clampScore(50 + signals.confidenceInHistory * overallSignal * 50);

  const finalConfidence = clampScore(
    input.baseConfidence * CURRENT_MARKET_WEIGHT + historicalConfidence * HISTORICAL_WEIGHT
  );

  return {
    baseScore: input.baseScore,
    baseConfidence: input.baseConfidence,
    historicalAdjustment: Math.round(historicalAdjustment * 100) / 100,
    historicalConfidence,
    finalScore,
    finalConfidence,
    reasons,
    historicalSampleSize: signals.historicalSampleSize,
  };
}

/** Resolves the channel proxy for an action type, matching signals.ts's own convention
 * (inferPlatformFromContentType over the mapped content type) -- null for action types
 * that don't map to a content type at all (e.g. request_reviews). */
export function resolveChannelForActionType(actionType: RecommendedActionType): string | null {
  if (!isContentSupportedActionType(actionType)) return null;
  return inferPlatformFromContentType(mapActionTypeToContentTarget(actionType).contentType);
}

/**
 * Applies computeAdaptiveRecommendationScore to a full batch of drafts fresh out of
 * buildMarketingRecommendationDrafts (lib/marketing-decisions/decisionEngine.ts, itself
 * completely unchanged by this feature). `categoriesByDedupeKey` lets the caller resolve
 * each draft's related opportunities' categories from data it already has in memory (the
 * same scopedOpportunities list the base decision engine already fetched) -- no
 * additional database round-trip. Recomputes urgency from the adjusted priorityScore so
 * the two never contradict each other, exactly like the base engine's own
 * urgencyFromPriorityScore contract.
 */
export function applyAdaptiveScoringToDrafts(
  drafts: MarketingRecommendationDraft[],
  categoriesByDedupeKey: Map<string, string[]>,
  signals: HistoricalRecommendationSignals,
  now: Date = new Date()
): Array<{ draft: MarketingRecommendationDraft; breakdown: AdaptiveScoreBreakdown }> {
  const season = seasonFromDate(now);
  const timeOfDay = timeOfDayFromDate(now);

  return drafts.map((draft) => {
    const breakdown = computeAdaptiveRecommendationScore(
      {
        actionType: draft.recommendedActionType,
        baseScore: draft.priorityScore,
        baseConfidence: draft.confidence,
        categories: categoriesByDedupeKey.get(draft.dedupeKey) ?? [],
        channel: resolveChannelForActionType(draft.recommendedActionType),
        season,
        timeOfDay,
      },
      signals
    );

    const adjustedDraft: MarketingRecommendationDraft = {
      ...draft,
      priorityScore: breakdown.finalScore,
      confidence: breakdown.finalConfidence,
      urgency: urgencyFromPriorityScore(breakdown.finalScore),
    };

    return { draft: adjustedDraft, breakdown };
  });
}
