/**
 * Wave III — Goals & Strategy: reusable Goal model.
 * Lightweight, extensible — not a second planning system.
 */

export const GoalStatuses = {
  ACTIVE: "active",
  PAUSED: "paused",
  ACHIEVED: "achieved",
  DROPPED: "dropped",
} as const;

export type GoalStatus = (typeof GoalStatuses)[keyof typeof GoalStatuses];

export const GoalTimeframes = {
  NINETY_DAYS: "90_days",
  SIX_MONTHS: "6_months",
  ONE_YEAR: "1_year",
} as const;

export type GoalTimeframe = (typeof GoalTimeframes)[keyof typeof GoalTimeframes];

export const GoalProgressStates = {
  ON_TRACK: "on_track",
  NEEDS_ATTENTION: "needs_attention",
  AHEAD_OF_PLAN: "ahead_of_plan",
  ESTABLISHING_BASELINE: "establishing_baseline",
} as const;

export type GoalProgressState =
  (typeof GoalProgressStates)[keyof typeof GoalProgressStates];

/** Canonical catalog key — stable for strategy mapping. */
export type GoalKey =
  | "increase_revenue"
  | "generate_more_leads"
  | "increase_recurring_customers"
  | "improve_online_reputation"
  | "increase_website_conversions"
  | "launch_new_service"
  | "expand_new_market"
  | "grow_memberships"
  | "reduce_seasonality"
  | "save_time_automation";

export type BusinessGoal = {
  key: GoalKey;
  /** Customer-facing label. */
  label: string;
  /** 1 = highest priority. */
  priority: number;
  status: GoalStatus;
  targetTimeframe: GoalTimeframe | null;
  createdAt: string;
  updatedAt: string;
  /** Reserved for future notes / metrics without schema churn. */
  meta?: Record<string, string>;
};

export type GoalProgress = {
  goalKey: GoalKey;
  label: string;
  state: GoalProgressState;
  /** Honest explanation — never fabricates progress. */
  detail: string;
};

export type GoalTimeframeOption = {
  id: GoalTimeframe;
  label: string;
};
