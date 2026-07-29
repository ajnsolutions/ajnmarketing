/**
 * Goal Progress — honest states from existing platform signals only.
 * Never fabricates progress when evidence is thin.
 */

import type { BusinessGoal, GoalProgress } from "@/lib/goals/types";
import { GoalProgressStates, GoalStatuses } from "@/lib/goals/types";

export type GoalProgressSignals = {
  gbpConnected: boolean;
  unansweredReviews: number;
  pendingApprovals: number;
  publishFailures: number;
  openRecommendations: number;
  weeklyReviewCount: number;
  weeklyPostCount: number;
  websiteConnected: boolean;
  setupComplete: boolean;
  /** True when the account is brand-new / early — baseline still forming. */
  isEarlyCustomer: boolean;
};

function baseline(goal: BusinessGoal, reason: string): GoalProgress {
  return {
    goalKey: goal.key,
    label: goal.label,
    state: GoalProgressStates.ESTABLISHING_BASELINE,
    detail: reason,
  };
}

function assessOne(goal: BusinessGoal, signals: GoalProgressSignals): GoalProgress {
  if (goal.status !== GoalStatuses.ACTIVE) {
    return {
      goalKey: goal.key,
      label: goal.label,
      state: GoalProgressStates.ESTABLISHING_BASELINE,
      detail: `This goal is ${goal.status.replace(/_/g, " ")} — not tracking active progress.`,
    };
  }

  if (signals.isEarlyCustomer || (!signals.gbpConnected && !signals.websiteConnected)) {
    return baseline(
      goal,
      "I'm still establishing a baseline for this goal — once more of your marketing foundations are in place, I can speak more clearly about progress.",
    );
  }

  switch (goal.key) {
    case "improve_online_reputation": {
      if (signals.unansweredReviews >= 3) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.NEEDS_ATTENTION,
          detail: `${signals.unansweredReviews} reviews are waiting — responding helps reputation goals.`,
        };
      }
      if (signals.weeklyReviewCount > 0) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.ON_TRACK,
          detail: "New review activity this week supports your reputation goal.",
        };
      }
      return baseline(
        goal,
        "I'm still establishing a baseline for review momentum on this goal.",
      );
    }
    case "generate_more_leads":
    case "increase_revenue": {
      if (signals.publishFailures > 0) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.NEEDS_ATTENTION,
          detail: "Publishing issues are blocking visibility work that supports this goal.",
        };
      }
      if (signals.weeklyPostCount > 0 || signals.pendingApprovals > 0) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.ON_TRACK,
          detail: "Visibility and content activity this week support lead and revenue goals.",
        };
      }
      return baseline(
        goal,
        "I'm still establishing a baseline for lead-generation activity tied to this goal.",
      );
    }
    case "increase_website_conversions": {
      if (!signals.websiteConnected) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.NEEDS_ATTENTION,
          detail: "Website analysis isn't available yet — that foundation supports conversion goals.",
        };
      }
      return baseline(
        goal,
        "I'm still establishing a baseline for website conversion signals — I won't invent a trend.",
      );
    }
    case "save_time_automation": {
      if (signals.setupComplete && signals.pendingApprovals <= 2) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.ON_TRACK,
          detail: "Setup is in place and your review load looks manageable.",
        };
      }
      if (!signals.setupComplete) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.NEEDS_ATTENTION,
          detail: "A bit more setup will unlock more of the time-saving workflow.",
        };
      }
      return baseline(goal, "I'm still establishing a baseline for time-saved signals.");
    }
    case "reduce_seasonality": {
      return baseline(
        goal,
        "I'm still establishing a seasonal baseline — I need more cycles before calling progress.",
      );
    }
    default:
      if (signals.openRecommendations === 0 && signals.weeklyPostCount > 1) {
        return {
          goalKey: goal.key,
          label: goal.label,
          state: GoalProgressStates.AHEAD_OF_PLAN,
          detail: "Recent activity looks strong relative to open recommendations — still early signal, not a guarantee.",
        };
      }
      return baseline(
        goal,
        "I'm still establishing a baseline for this goal with the signals I have today.",
      );
  }
}

/** Progress for active goals only, priority order. */
export function buildGoalProgress(
  goals: BusinessGoal[],
  signals: GoalProgressSignals,
): GoalProgress[] {
  return goals
    .filter((goal) => goal.status === GoalStatuses.ACTIVE)
    .sort((a, b) => a.priority - b.priority)
    .map((goal) => assessOne(goal, signals));
}

export function primaryStrategicFocus(goals: BusinessGoal[]): BusinessGoal | null {
  return (
    goals
      .filter((goal) => goal.status === GoalStatuses.ACTIVE)
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  );
}
