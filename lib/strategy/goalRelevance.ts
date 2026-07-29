/**
 * Lightweight strategy layer — sits between an already-chosen recommendation
 * and Growth Advisor presentation.
 *
 * Does NOT rank, score, or replace the recommendation engine.
 * Explains why the current recommendation supports a selected business goal.
 */

import type { BusinessGoal } from "@/lib/goals/types";
import { GoalStatuses } from "@/lib/goals/types";
import { primaryStrategicFocus } from "@/lib/goals/progress";
import { RecommendedActionTypes } from "@/lib/marketing-decisions/types";

export type GoalRelevance = {
  supportsGoal: string;
  goalKey: string | null;
  whySupportsGoal: string;
};

const ACTION_TO_GOAL_KEYS: Record<string, string[]> = {
  [RecommendedActionTypes.REQUEST_REVIEWS]: ["improve_online_reputation", "generate_more_leads"],
  [RecommendedActionTypes.PUBLISH_GBP_POST]: [
    "generate_more_leads",
    "increase_revenue",
    "improve_online_reputation",
  ],
  [RecommendedActionTypes.CREATE_SEASONAL_CONTENT]: [
    "reduce_seasonality",
    "increase_revenue",
    "launch_new_service",
  ],
  [RecommendedActionTypes.CREATE_TIMELY_CONTENT]: [
    "generate_more_leads",
    "increase_revenue",
    "expand_new_market",
  ],
  [RecommendedActionTypes.INCREASE_POSTING_FREQUENCY]: [
    "save_time_automation",
    "generate_more_leads",
    "increase_recurring_customers",
  ],
  [RecommendedActionTypes.UPDATE_BUSINESS_INFO]: [
    "generate_more_leads",
    "increase_website_conversions",
  ],
  [RecommendedActionTypes.UPLOAD_PHOTOS]: [
    "improve_online_reputation",
    "generate_more_leads",
    "launch_new_service",
  ],
  [RecommendedActionTypes.REFRESH_WEBSITE_CONTENT]: [
    "increase_website_conversions",
    "generate_more_leads",
    "launch_new_service",
  ],
};

const WHY_BY_GOAL: Record<string, string> = {
  increase_revenue:
    "This keeps you visible to people who are closer to buying — a practical step toward revenue.",
  generate_more_leads:
    "This strengthens how new customers find and contact you, which supports lead flow.",
  increase_recurring_customers:
    "Staying consistently present helps customers remember to come back.",
  improve_online_reputation:
    "Trust signals like reviews and an active profile shape whether people choose you.",
  increase_website_conversions:
    "Clearer, fresher online content makes it easier for visitors to take the next step.",
  launch_new_service:
    "Announcing and explaining what's new helps the right customers notice the launch.",
  expand_new_market:
    "Showing up where new audiences look is how expansion starts without guessing.",
  grow_memberships:
    "Consistent presence keeps membership offers in front of people who are deciding.",
  reduce_seasonality:
    "Timely content can create demand in quieter stretches instead of waiting for peak season.",
  save_time_automation:
    "A focused next step here reduces ad-hoc marketing decisions and keeps momentum without extra busywork.",
};

function activeGoals(goals: BusinessGoal[]): BusinessGoal[] {
  return goals
    .filter((goal) => goal.status === GoalStatuses.ACTIVE)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Pick the best-matching customer goal for this recommendation's action type.
 * Falls back to the customer's primary strategic focus — never invents a goal.
 */
export function resolveSupportedGoal(
  goals: BusinessGoal[],
  actionType: string | null | undefined,
): BusinessGoal | null {
  const active = activeGoals(goals);
  if (active.length === 0) return null;

  const preferredKeys = actionType ? ACTION_TO_GOAL_KEYS[actionType] ?? [] : [];
  for (const key of preferredKeys) {
    const match = active.find((goal) => goal.key === key);
    if (match) return match;
  }

  return primaryStrategicFocus(active);
}

export function explainGoalRelevance(
  goals: BusinessGoal[],
  actionType: string | null | undefined,
  recommendationTitle: string,
): GoalRelevance | null {
  const supported = resolveSupportedGoal(goals, actionType);
  if (!supported) {
    return {
      supportsGoal: "Your next growth step",
      goalKey: null,
      whySupportsGoal:
        "Once you share what success looks like, I can tie each recommendation to a specific goal.",
    };
  }

  const why =
    WHY_BY_GOAL[supported.key] ??
    `This supports your focus on ${supported.label.toLowerCase()}.`;

  return {
    supportsGoal: supported.label,
    goalKey: supported.key,
    whySupportsGoal: `${why} (Recommended: ${recommendationTitle})`,
  };
}
