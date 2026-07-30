/**
 * Learning Maturity — five additive dimensions describing how much the
 * Business Learning Engine has actually learned and how much a customer can
 * trust that learning (Part 7). This is a new, additive signal alongside
 * Business Knowledge Health (lib/business-knowledge-graph/knowledgeHealth.ts)
 * and the three pre-existing, independent "Marketing Health" implementations
 * — none of those are touched here.
 */

import type { BusinessPattern, ConfidenceLevel } from "@/lib/business-learning-engine/types";
import type { ActionTypeOutcomeBreakdown } from "@/lib/business-learning-engine/adapters/recommendationOutcomes";

export type LearningMaturityLevel = "strong" | "developing" | "limited";

export type LearningMaturityDimension = {
  score: number;
  level: LearningMaturityLevel;
  detail: string;
  /** How the customer can strengthen this dimension — always concrete. */
  improvementTip: string;
};

export type LearningMaturity = {
  generatedAt: string;
  overallScore: number;
  dimensions: {
    learningDepth: LearningMaturityDimension;
    outcomeCoverage: LearningMaturityDimension;
    recommendationFeedbackRate: LearningMaturityDimension;
    evidenceQuality: LearningMaturityDimension;
    confidenceStability: LearningMaturityDimension;
  };
};

function levelFromScore(score: number): LearningMaturityLevel {
  if (score >= 70) return "strong";
  if (score >= 35) return "developing";
  return "limited";
}

function dimension(score: number, detail: string, improvementTip: string): LearningMaturityDimension {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return { score: clamped, level: levelFromScore(clamped), detail, improvementTip };
}

const CONFIDENCE_SCORE: Record<ConfidenceLevel, number> = { low: 30, medium: 60, high: 100 };

/** A target of 5 distinct, live patterns is treated as "strong" depth — an
 * arbitrary but stated target, not a fabricated precision score. */
const STRONG_PATTERN_COUNT_TARGET = 5;

function learningDepth(patterns: BusinessPattern[]): LearningMaturityDimension {
  const count = patterns.length;
  const score = (count / STRONG_PATTERN_COUNT_TARGET) * 100;
  return dimension(
    score,
    count === 0
      ? "No learned patterns yet — nothing has been reinforced enough to become a pattern."
      : `${count} learned pattern${count === 1 ? "" : "s"} so far.`,
    "Approve, reject, or give feedback on recommendations so the engine has real outcomes to learn from.",
  );
}

function outcomeCoverage(totalWithOutcome: number, totalRecommendations: number): LearningMaturityDimension {
  if (totalRecommendations === 0) {
    return dimension(
      0,
      "No recommendations yet to track outcomes for.",
      "Once recommendations start arriving, approving or rejecting them builds outcome coverage.",
    );
  }
  const score = (totalWithOutcome / totalRecommendations) * 100;
  return dimension(
    score,
    `${totalWithOutcome} of ${totalRecommendations} recommendations have a tracked outcome.`,
    "Review pending recommendations so more of them move past \"suggested\" into a real outcome.",
  );
}

function recommendationFeedbackRate(
  feedbackCount: number,
  publishedOrMeasuredCount: number,
): LearningMaturityDimension {
  if (publishedOrMeasuredCount === 0) {
    return dimension(
      0,
      "No published recommendations yet to give feedback on.",
      "Once a recommendation is published, telling us whether it helped strengthens future confidence.",
    );
  }
  const score = (feedbackCount / publishedOrMeasuredCount) * 100;
  return dimension(
    score,
    `You've given feedback on ${feedbackCount} of ${publishedOrMeasuredCount} published recommendations.`,
    'Use "This helped" / "This wasn\'t useful" on published recommendations — it directly improves future confidence.',
  );
}

function evidenceQuality(patterns: BusinessPattern[]): LearningMaturityDimension {
  if (patterns.length === 0) {
    return dimension(0, "No patterns yet to assess evidence quality for.", "As patterns form, their evidence quality will show here.");
  }
  const average =
    patterns.reduce((sum, p) => sum + CONFIDENCE_SCORE[p.effectiveConfidence], 0) / patterns.length;
  return dimension(
    average,
    `Average pattern confidence is ${average >= 85 ? "high" : average >= 50 ? "medium" : "low"} across ${patterns.length} pattern${patterns.length === 1 ? "" : "s"}.`,
    "More corroborating sources and reinforcement over time raise pattern confidence.",
  );
}

function confidenceStability(patterns: BusinessPattern[]): LearningMaturityDimension {
  if (patterns.length === 0) {
    return dimension(0, "No patterns yet to assess stability for.", "Stability will show once patterns exist and are reinforced over time.");
  }
  const freshOrDecaying = patterns.filter((p) => p.decayState !== "stale").length;
  const score = (freshOrDecaying / patterns.length) * 100;
  return dimension(
    score,
    `${freshOrDecaying} of ${patterns.length} patterns are still actively reinforced.`,
    "Keep approving, rejecting, and giving feedback regularly — patterns that stop being reinforced lose confidence over time.",
  );
}

/** Real, already-computed totals derived from the action-type outcome
 * breakdown — never a second fetch. */
export function summarizeOutcomeBreakdown(
  breakdowns: ActionTypeOutcomeBreakdown[],
): { totalWithOutcome: number; publishedOrMeasuredCount: number } {
  return breakdowns.reduce(
    (acc, b) => ({
      totalWithOutcome: acc.totalWithOutcome + b.sampleSize,
      publishedOrMeasuredCount: acc.publishedOrMeasuredCount + b.publishedCount,
    }),
    { totalWithOutcome: 0, publishedOrMeasuredCount: 0 },
  );
}

export function computeLearningMaturity(input: {
  patterns: BusinessPattern[];
  totalWithOutcome: number;
  totalRecommendations: number;
  feedbackCount: number;
  publishedOrMeasuredCount: number;
  now?: Date;
}): LearningMaturity {
  const now = input.now ?? new Date();
  const dimensions = {
    learningDepth: learningDepth(input.patterns),
    outcomeCoverage: outcomeCoverage(input.totalWithOutcome, input.totalRecommendations),
    recommendationFeedbackRate: recommendationFeedbackRate(input.feedbackCount, input.publishedOrMeasuredCount),
    evidenceQuality: evidenceQuality(input.patterns),
    confidenceStability: confidenceStability(input.patterns),
  };

  const overallScore = Math.round(
    Object.values(dimensions).reduce((sum, d) => sum + d.score, 0) / Object.values(dimensions).length,
  );

  return { generatedAt: now.toISOString(), overallScore, dimensions };
}
