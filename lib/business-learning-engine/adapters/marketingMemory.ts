/**
 * Adapter: Marketing Memory learnings -> LearningSignalInput[].
 *
 * lib/marketing-memory/ already statistically evaluates timing_performance
 * and recommendation_action_outcome patterns from real observations — this
 * adapter does not re-derive anything, it normalizes those already-vetted
 * conclusions into the Business Learning Engine's shared contract. A
 * superseded or archived learning is history, not a live pattern, so it's
 * excluded; an inconclusive learning is real evidence of "no clear signal
 * yet" and is included as such, never dressed up as positive or negative.
 */

import type { MarketingMemoryLearning } from "@/lib/marketing-memory/learningTypes";
import type { LearningSignalInput } from "@/lib/business-learning-engine/types";

const LIVE_STATUSES = new Set(["emerging", "active", "weakening", "inconclusive"]);

const CONFIDENCE_FROM_LEARNING_LEVEL: Record<MarketingMemoryLearning["confidence_level"], LearningSignalInput["confidence"]> = {
  early_signal: "low",
  developing_pattern: "medium",
  strong_pattern: "high",
};

export function marketingMemoryLearningsToLearningSignals(
  learnings: MarketingMemoryLearning[] | null | undefined,
): LearningSignalInput[] {
  if (!learnings?.length) return [];

  return learnings
    .filter((learning) => LIVE_STATUSES.has(learning.status))
    .map((learning) => ({
      sourceProviderId: "marketing_memory",
      sourceLabel: "Marketing Memory",
      patternKey: `marketing_memory:${learning.learning_key}`,
      statement: learning.summary,
      direction:
        learning.direction === "positive" || learning.direction === "negative"
          ? learning.direction
          : learning.direction === "inconclusive"
            ? "inconclusive"
            : "neutral",
      confidence: CONFIDENCE_FROM_LEARNING_LEVEL[learning.confidence_level],
      evidenceSummary: learning.summary,
      occurredAt: learning.last_observed_at,
    }));
}
