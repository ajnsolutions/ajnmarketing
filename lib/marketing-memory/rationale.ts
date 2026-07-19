import "server-only";

import { formatRecommendedActionType } from "@/lib/marketing-decisions/ui";
import type { RecommendedActionType } from "@/lib/marketing-decisions/types";
import {
  LearningConfidenceLevels,
  LearningDirections,
  TimeDimensions,
  type ConfidenceComponents,
  type LearningConfidenceLevel,
  type LearningDirection,
  type LearningFamily,
  type TimeDimension,
} from "@/lib/marketing-memory/learningTypes";
import { LearningFamilies } from "@/lib/marketing-memory/learningTypes";

/**
 * Never use these in Learning summary or internal_rationale text — mirrors the
 * MARKETING_DIRECTOR_FORBIDDEN_TERMS / *_FORBIDDEN_TERMS convention already established
 * in lib/marketing-director/types.ts and every Project Magic phase's own forbidden-term
 * list. Enforced by a dedicated test (unit-tests/marketing-memory-rationale.test.ts),
 * not just a style guideline — no template in this file can produce any of these.
 */
export const MARKETING_MEMORY_FORBIDDEN_TERMS = [
  "caused",
  "causes",
  "causing",
  "guarantee",
  "guaranteed",
  "guarantees",
  "always works",
  "will improve",
  "will definitely",
  "proves",
  "proven to",
  "certain to",
] as const;

const DAY_OF_WEEK_LABELS: Record<string, string> = {
  sunday: "Sundays",
  monday: "Mondays",
  tuesday: "Tuesdays",
  wednesday: "Wednesdays",
  thursday: "Thursdays",
  friday: "Fridays",
  saturday: "Saturdays",
};

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SEASON_LABELS: Record<string, string> = {
  winter: "winter",
  spring: "spring",
  summer: "summer",
  fall: "fall",
};

function timeDimensionLabel(timeDimension: TimeDimension, subjectKey: string): string {
  if (timeDimension === TimeDimensions.DAY_OF_WEEK) {
    return DAY_OF_WEEK_LABELS[subjectKey] ?? subjectKey;
  }
  if (timeDimension === TimeDimensions.MONTH) {
    const monthIndex = Number(subjectKey) - 1;
    return MONTH_LABELS[monthIndex] ?? subjectKey;
  }
  return SEASON_LABELS[subjectKey] ?? subjectKey;
}

function subjectPhrase(
  learningFamily: LearningFamily,
  timeDimension: TimeDimension | null,
  subjectKey: string
): string {
  if (learningFamily === LearningFamilies.TIMING_PERFORMANCE && timeDimension) {
    const label = timeDimensionLabel(timeDimension, subjectKey);
    return timeDimension === TimeDimensions.DAY_OF_WEEK
      ? `Posts published on ${label}`
      : `Posts published in ${label}`;
  }

  // recommendation_action_outcome
  const actionLabel = formatRecommendedActionType(subjectKey as RecommendedActionType);
  return `"${actionLabel}" recommendations`;
}

function directionVerbPhrase(learningFamily: LearningFamily, direction: LearningDirection): string {
  const better = learningFamily === LearningFamilies.TIMING_PERFORMANCE
    ? "performed better than your recent average"
    : "been approved more often than your average";
  const worse = learningFamily === LearningFamilies.TIMING_PERFORMANCE
    ? "performed worse than your recent average"
    : "been approved less often than your average";

  if (direction === LearningDirections.POSITIVE) return better;
  if (direction === LearningDirections.NEGATIVE) return worse;
  return "shown no clear pattern yet";
}

/**
 * Customer-safe, correlation-aware summary — generated from a small, fixed set of
 * sentence templates keyed to confidence level, never free-form generation. This is
 * what makes "no causal language" structural rather than a style guideline: there is no
 * code path here that can produce "caused" or "guarantees." Matches the exact template
 * shapes documented in docs/MARKETING_MEMORY_ARCHITECTURE.md §11.
 */
export function buildCustomerSafeSummary(input: {
  learningFamily: LearningFamily;
  timeDimension: TimeDimension | null;
  subjectKey: string;
  direction: LearningDirection;
  confidenceLevel: LearningConfidenceLevel;
}): string {
  const subject = subjectPhrase(input.learningFamily, input.timeDimension, input.subjectKey);
  const verb = directionVerbPhrase(input.learningFamily, input.direction);

  if (input.direction === LearningDirections.NEUTRAL || input.direction === LearningDirections.INCONCLUSIVE) {
    return `${subject} have ${verb} for this business so far — I'll keep watching.`;
  }

  switch (input.confidenceLevel) {
    case LearningConfidenceLevels.EARLY_SIGNAL:
      return `I'm noticing an early signal that ${subject.toLowerCase()} have ${verb} — I'll keep watching.`;
    case LearningConfidenceLevels.DEVELOPING_PATTERN:
      return `There's a developing pattern: ${subject.toLowerCase()} have ${verb} for your business.`;
    case LearningConfidenceLevels.STRONG_PATTERN:
      return `${subject} have historically ${verb} for this business.`;
    default:
      return `${subject} have ${verb} for this business, though the evidence is still limited.`;
  }
}

/**
 * Internal-only — may reference raw component values for auditability, never shown to a
 * customer verbatim. Still correlation-aware (no forbidden terms), since this text is
 * logged and stored, not a private free-for-all.
 */
export function buildInternalRationale(input: {
  learningFamily: LearningFamily;
  subjectKey: string;
  confidenceComponents: ConfidenceComponents;
  comparisonBaseline: string;
}): string {
  const c = input.confidenceComponents;
  return (
    `${input.learningFamily}/${input.subjectKey}: sample_size=${c.sampleSize}, ` +
    `supporting=${c.supportingCount}, contradicting=${c.contradictingCount}, neutral=${c.neutralCount}, ` +
    `consistency=${c.consistency.toFixed(2)}, effect_size=${c.effectSize.toFixed(3)}, ` +
    `recency_days=${c.recencyDays}, seasonal_recurrence=${c.seasonalRecurrenceCount}, ` +
    `baseline="${input.comparisonBaseline}", confounders=[${c.confounderCodes.join(", ")}]. ` +
    `Evidence suggests an association, not a verified causal relationship.`
  );
}

/** Asserts no forbidden causal/absolute term appears in the given text — used by both
 * the dedicated rationale test suite and can be reused by any future consumer that
 * wants a runtime guard before displaying Learning text. */
export function containsForbiddenTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of MARKETING_MEMORY_FORBIDDEN_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}
