import "server-only";

import { MIN_YEARLY_OCCURRENCES_FOR_RECURRENCE } from "@/lib/marketing-memory/learningConfig";
import {
  RecurrencePatterns,
  TimeDimensions,
  type LearningEvidenceItem,
  type RecurrencePattern,
  type TimeDimension,
} from "@/lib/marketing-memory/learningTypes";

/**
 * Deterministic mapping from a time_dimension to its recurrence shape — day_of_week
 * patterns recur weekly (decay/recency alone governs relevance, per
 * STRONG_PATTERN_MAX_RECENCY_DAYS); month/season patterns recur annually. A Learning
 * with no time_dimension (recommendation_action_outcome) is not a seasonal pattern at
 * all. Never hardcodes a specific business's calendar — this is a structural mapping
 * from Phase 1's own three time_dimension values, not a per-business rule.
 */
export function recurrencePatternForTimeDimension(timeDimension: TimeDimension | null): RecurrencePattern {
  if (timeDimension === TimeDimensions.DAY_OF_WEEK) return RecurrencePatterns.RECURRING_WEEKLY;
  if (timeDimension === TimeDimensions.MONTH) return RecurrencePatterns.ANNUAL_MONTH;
  if (timeDimension === TimeDimensions.SEASON) return RecurrencePatterns.ANNUAL_RANGE;
  return RecurrencePatterns.NONE;
}

/**
 * Counts distinct calendar years represented in the evidence for an annually-recurring
 * (month/season) pattern — e.g. evidence from December 2025 and December 2024 yields 2.
 * A pattern only counts as "recurring" (as opposed to a one-time event within a single
 * year) once it reaches MIN_YEARLY_OCCURRENCES_FOR_RECURRENCE. Returns 0 for
 * non-annual time dimensions (day_of_week, or none), where this concept doesn't apply.
 */
export function seasonalRecurrenceCount(
  items: LearningEvidenceItem[],
  timeDimension: TimeDimension | null
): number {
  if (timeDimension !== TimeDimensions.MONTH && timeDimension !== TimeDimensions.SEASON) return 0;

  const years = new Set(items.map((item) => new Date(item.occurredAt).getUTCFullYear()));
  return years.size >= MIN_YEARLY_OCCURRENCES_FOR_RECURRENCE ? years.size : 0;
}
