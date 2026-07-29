/**
 * Autonomous Growth Planner — public barrel.
 * Planning engine only. Never auto-executes marketing actions.
 */

export { buildWeeklyGrowthPlan } from "@/lib/growth-planner/buildWeeklyGrowthPlan";
export { synthesizePlanEvidence } from "@/lib/growth-planner/evidence";
export { resolvePrimaryObjective } from "@/lib/growth-planner/primaryObjective";
export { buildSupportingActions } from "@/lib/growth-planner/supportingActions";
export { resolveSuccessMetric } from "@/lib/growth-planner/successMetric";
export {
  WEEKLY_GROWTH_PLANS_MARKER_PREFIX,
  applyWeeklyGrowthPlansToMarketingGoals,
  compareWeeklyPlans,
  decodeWeeklyGrowthPlansFromMarketingGoals,
  encodeWeeklyGrowthPlansMarker,
  latestPlanAndPrevious,
  parseWeeklyGrowthPlansMarker,
  planToHistoryEntry,
  upsertWeeklyPlanHistory,
} from "@/lib/growth-planner/history";
export { planTrustLabel, PlanTrustCertaintyLevels } from "@/lib/growth-planner/trust";
export { isoWeekKey, buildPlanExplainability } from "@/lib/growth-planner/weekKey";
export type {
  PlanEvidenceItem,
  PlanExplainability,
  PlanSupportingAction,
  PlanWatchSignal,
  PrimaryObjectiveKey,
  SuccessMetricKey,
  SupportingActionKind,
  WeeklyGrowthPlan,
  WeeklyGrowthPlanBundle,
  WeeklyPlanComparison,
  WeeklyPlanHistoryEntry,
  WeeklyPlanStatus,
} from "@/lib/growth-planner/types";
export {
  PRIMARY_OBJECTIVE_LABELS,
  PrimaryObjectiveKeys,
  SUCCESS_METRIC_LABELS,
  SUPPORTING_ACTION_LABELS,
  SuccessMetricKeys,
  SupportingActionKinds,
  WeeklyPlanStatuses,
} from "@/lib/growth-planner/types";
