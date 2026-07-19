import "server-only";

/**
 * Marketing Memory Phase 2 — centralized, documented learning configuration. Every
 * numeric threshold, window, and rule used to derive a Learning lives here, and only
 * here — no arbitrary constant is duplicated or hidden in another module. This mirrors
 * lib/recommendation-learning/weights.ts's own "static, documented, exported constant
 * table" convention, and the confidence rule set matches the illustrative formula
 * already published in docs/MARKETING_MEMORY_ARCHITECTURE.md §10 (finalized here for
 * Phase 2's actual implementation).
 */

// --- Minimum evidence -------------------------------------------------------------

/** Below this sample size, no Learning row is created at all — remains Observations
 * only. Matches the architecture doc's stated minimum-evidence floor. */
export const MIN_SAMPLE_SIZE_TO_CREATE = 2;

/** Below this sample size, confidence is always "early_signal" regardless of any other
 * component. */
export const EARLY_SIGNAL_SAMPLE_CEILING = 3;

// --- Consistency and contradiction -------------------------------------------------

/** Consistency (supporting / (supporting + contradicting), excluding neutral from the
 * denominator — same convention as lib/recommendation-learning/signals.ts's
 * successRateByBucket) below this floor caps confidence at "early_signal". */
export const MIN_CONSISTENCY_FOR_DEVELOPING = 0.6;

/** contradicting / supporting above this ratio caps confidence at "early_signal", even
 * with a large sample size — persistent contradiction is not a developing pattern. */
export const MAX_CONTRADICTION_RATE_FOR_DEVELOPING = 0.3;

// --- Strong pattern thresholds ------------------------------------------------------

export const STRONG_PATTERN_MIN_SAMPLE = 8;
export const STRONG_PATTERN_MIN_CONSISTENCY = 0.7;

/** A Learning can reach "strong_pattern" only if its most recent supporting evidence is
 * within this many days, OR the pattern has recurred across at least one full seasonal
 * cycle (seasonalRecurrenceCount >= 1) — recency and seasonal recurrence are
 * interchangeable paths to "still relevant," matching the architecture doc's decay
 * design (§12–§13). */
export const STRONG_PATTERN_MAX_RECENCY_DAYS = 120;

// --- Effect size and direction -------------------------------------------------------

/** A relative effect smaller than this (5%) is treated as noise, not a directional
 * pattern — prevents a large-but-flat sample from being reported as "positive" or
 * "negative" by chance. */
export const MIN_EFFECT_SIZE_FOR_DIRECTION = 0.05;

// --- Weakening ------------------------------------------------------------------------

/** The trailing window used to decide whether a previously active/strong Learning is
 * now weakening — a materially different, more contradiction-heavy signal within this
 * recent window (independent of the Learning's full historical sample) triggers
 * "weakening" status. */
export const RECENT_WEAKENING_WINDOW_DAYS = 90;

/** If the contradiction rate *within the recent window* meets or exceeds this
 * proportion, an otherwise active/strong Learning transitions to "weakening". */
export const RECENT_CONTRADICTION_RATE_FOR_WEAKENING = 0.5;

// --- Evaluation scope -----------------------------------------------------------------

/** How far back an evaluation run looks for observations, per business, per run —
 * bounded so a single evaluation is never an unbounded full-history scan. */
export const EVALUATION_WINDOW_DAYS = 180;

/** Hard cap on observations considered per evaluation run, defense-in-depth alongside
 * the window above (a business with unusually high volume inside the window still can't
 * force an unbounded query). */
export const MAX_OBSERVATIONS_PER_EVALUATION = 500;

// --- Known structural confounder ------------------------------------------------------

/**
 * lib/analytics/analyticsEngine.ts's syncContentPerformanceRecords allocates a day's
 * aggregate GBP views/clicks evenly across that day's published posts ("aggregate
 * allocation"), not a true per-post measurement — confirmed by reading that function
 * directly during this PR's research. Every performanceScore this codebase produces
 * today inherits that estimation, so the timing_performance family (the only family
 * that uses performanceScore) can never honestly claim "strong_pattern" confidence
 * until the analytics engine measures true per-post performance. This is a structural,
 * system-wide ceiling — not a per-observation confounder flag — documented here as a
 * single centralized rule rather than scattered checks.
 */
export const PERFORMANCE_ESTIMATION_CONFIDENCE_CEILING = "developing_pattern" as const;

// --- Seasonality ------------------------------------------------------------------------

/** A month/season time_dimension Learning is classified as recurring only once evidence
 * spans at least this many distinct calendar-year occurrences of that month/season. */
export const MIN_YEARLY_OCCURRENCES_FOR_RECURRENCE = 2;

// --- Confounder codes -------------------------------------------------------------------

/** Closed vocabulary of structured confounder reason codes — never free-form
 * speculation. */
export const ConfounderCodes = {
  SMALL_SAMPLE: "small_sample",
  ESTIMATED_PERFORMANCE_METRIC: "estimated_performance_metric",
  LOW_BASELINE_QUALITY: "low_baseline_quality",
  INSUFFICIENT_RECENCY: "insufficient_recency",
  MIXED_EVIDENCE: "mixed_evidence",
} as const;

export type ConfounderCode = (typeof ConfounderCodes)[keyof typeof ConfounderCodes];
