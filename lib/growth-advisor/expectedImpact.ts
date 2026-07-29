/**
 * Expected impact in business language — never fake numbers.
 */

import type { RecommendedActionType } from "@/lib/marketing-decisions/types";
import { RecommendedActionTypes } from "@/lib/marketing-decisions/types";

/** Business-language outcomes — no counts, rankings, or ROI figures. */
export type ExpectedBusinessOutcome =
  | "More phone calls"
  | "More website visits"
  | "More repeat customers"
  | "Higher review velocity"
  | "Better seasonal visibility"
  | "Stronger local presence"
  | "Clearer business information"
  | "More consistent visibility";

const OUTCOMES_BY_ACTION: Partial<Record<RecommendedActionType, ExpectedBusinessOutcome[]>> = {
  [RecommendedActionTypes.PUBLISH_GBP_POST]: ["Stronger local presence", "More website visits"],
  [RecommendedActionTypes.REQUEST_REVIEWS]: ["Higher review velocity", "More phone calls"],
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: [
    "Better seasonal visibility",
    "More phone calls",
  ],
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: [
    "More consistent visibility",
    "More website visits",
  ],
  [RecommendedActionTypes.INCREASE_POSTING_FREQUENCY]: [
    "More consistent visibility",
    "More website visits",
  ],
  [RecommendedActionTypes.UPDATE_BUSINESS_INFO]: [
    "Clearer business information",
    "More phone calls",
  ],
  [RecommendedActionTypes.UPLOAD_PHOTOS]: ["Stronger local presence", "More website visits"],
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: [
    "More website visits",
    "More phone calls",
  ],
};

const GOAL_OUTCOME_HINTS: Array<{ pattern: RegExp; outcome: ExpectedBusinessOutcome }> = [
  { pattern: /lead|call|phone|inquiry/i, outcome: "More phone calls" },
  { pattern: /visit|traffic|website|click/i, outcome: "More website visits" },
  { pattern: /review|reputation/i, outcome: "Higher review velocity" },
  { pattern: /repeat|loyal|return/i, outcome: "More repeat customers" },
  { pattern: /season/i, outcome: "Better seasonal visibility" },
];

/**
 * Map recommendation context into honest business-language outcomes.
 * Falls back to a softened form of the existing expected-benefit sentence — never invents metrics.
 */
export function resolveExpectedBusinessOutcomes(input: {
  actionType?: RecommendedActionType | string | null;
  expectedBenefit?: string | null;
  supportsGoal?: string | null;
}): { outcomes: ExpectedBusinessOutcome[]; summary: string } {
  const outcomes: ExpectedBusinessOutcome[] = [];
  const seen = new Set<string>();

  const push = (outcome: ExpectedBusinessOutcome) => {
    if (seen.has(outcome)) return;
    seen.add(outcome);
    outcomes.push(outcome);
  };

  const actionType = input.actionType as RecommendedActionType | null | undefined;
  if (actionType && OUTCOMES_BY_ACTION[actionType]) {
    for (const outcome of OUTCOMES_BY_ACTION[actionType]!) push(outcome);
  }

  if (input.supportsGoal) {
    for (const hint of GOAL_OUTCOME_HINTS) {
      if (hint.pattern.test(input.supportsGoal)) push(hint.outcome);
    }
  }

  if (outcomes.length === 0 && input.expectedBenefit?.trim()) {
    // Soften existing benefit into a single business-language summary — no numbers.
    const cleaned = input.expectedBenefit
      .replace(/\d+(\.\d+)?%?/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return {
      outcomes: [],
      summary: cleaned || "Steady progress toward the customers you want.",
    };
  }

  if (outcomes.length === 0) {
    return {
      outcomes: ["More consistent visibility"],
      summary: "More consistent visibility with the customers you want.",
    };
  }

  return {
    outcomes: outcomes.slice(0, 3),
    summary: outcomes.slice(0, 3).join(" · "),
  };
}
