/**
 * Named, exported weighting constants -- this codebase has no existing configurable-
 * weights system (checked: no feature-flag/config service for scoring weights exists
 * anywhere in lib/), so these follow the same "static, documented, exported constant
 * table" convention already used for ACTION_TYPE_IMPACT/ACTION_TYPE_EFFORT
 * (lib/marketing-decisions/actionTypeMapping.ts) and CATEGORY_PRIORITY
 * (lib/market-context/contextScoringService.ts) rather than being inline magic numbers.
 */

/** Current market opportunity remains the primary driver of a recommendation's score. */
export const CURRENT_MARKET_WEIGHT = 0.7;
/** Historical business outcomes are an adjustment layer on top, never the primary driver. */
export const HISTORICAL_WEIGHT = 0.3;

/**
 * Sample size at which confidenceInHistory saturates to 1.0. Below this, confidence
 * (and therefore the historical adjustment's real-world effect, since the adjustment is
 * itself scaled by confidenceInHistory) scales down linearly -- see
 * docs/ADAPTIVE_RECOMMENDATION_INTELLIGENCE.md's cold-start section for the 0/5/20/100
 * worked examples.
 */
export const COLD_START_FULL_CONFIDENCE_SAMPLE_SIZE = 20;

/**
 * Maximum magnitude (in the same 0-100 points scale as priorityScore) the historical
 * adjustment layer may ever apply, independent of confidence scaling. Prevents history
 * alone from ever flipping a recommendation's rank order on its own -- it can only ever
 * nudge within this band.
 */
export const MAX_HISTORICAL_ADJUSTMENT_POINTS = 20;

/** A success/rejection rate below this many observations is too small to weight meaningfully on its own. */
export const MIN_BUCKET_SAMPLE_SIZE_FOR_REASON = 3;

/**
 * A category's edit rate above this threshold is considered "heavily edited" and applies
 * a negative-only adjustment (editing itself is never rewarded, only heavy editing is
 * penalized -- there is no "increase score because rarely edited" rule).
 */
export const HEAVY_EDIT_RATE_THRESHOLD = 0.5;
