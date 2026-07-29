/**
 * One meaningful success metric — never fabricated projections or ROI numbers.
 */

import type { BusinessGoal } from "@/lib/goals/types";
import {
  SUCCESS_METRIC_LABELS,
  SuccessMetricKeys,
  type PrimaryObjectiveKey,
  type SuccessMetricKey,
} from "@/lib/growth-planner/types";

const OBJECTIVE_METRIC: Record<PrimaryObjectiveKey, SuccessMetricKey> = {
  increase_service_bookings: SuccessMetricKeys.BOOKINGS,
  improve_review_velocity: SuccessMetricKeys.REVIEW_VOLUME,
  grow_local_awareness: SuccessMetricKeys.LOCAL_VISIBILITY,
  promote_seasonal_services: SuccessMetricKeys.PHONE_CALLS,
  increase_repeat_customers: SuccessMetricKeys.RETURNING_CUSTOMERS,
};

const METRIC_DETAILS: Record<SuccessMetricKey, string> = {
  phone_calls: "Watch for more people calling about the services you’re promoting.",
  bookings: "Watch for more booked jobs or appointments tied to this week’s focus.",
  website_inquiries: "Watch for more form fills or contact requests from your site.",
  review_volume: "Watch for new reviews landing on your Google Business Profile.",
  returning_customers: "Watch for past customers coming back or rebooking.",
  local_visibility: "Watch for stronger local discovery signals (views, searches, profile engagement).",
};

function metricFromGoal(goalLabel: string): SuccessMetricKey | null {
  if (/lead|call|phone|inquiry/i.test(goalLabel)) return SuccessMetricKeys.PHONE_CALLS;
  if (/review|reputation/i.test(goalLabel)) return SuccessMetricKeys.REVIEW_VOLUME;
  if (/repeat|recur|loyal|member/i.test(goalLabel)) return SuccessMetricKeys.RETURNING_CUSTOMERS;
  if (/website|conversion|traffic/i.test(goalLabel)) return SuccessMetricKeys.WEBSITE_INQUIRIES;
  if (/revenue|book|sale/i.test(goalLabel)) return SuccessMetricKeys.BOOKINGS;
  return null;
}

export function resolveSuccessMetric(input: {
  objectiveKey: PrimaryObjectiveKey;
  goals: BusinessGoal[];
}): { key: SuccessMetricKey; label: string; detail: string } {
  const primaryGoal = [...input.goals]
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority)[0];

  const fromGoal = primaryGoal ? metricFromGoal(primaryGoal.label) : null;
  const key = fromGoal ?? OBJECTIVE_METRIC[input.objectiveKey];

  return {
    key,
    label: SUCCESS_METRIC_LABELS[key],
    detail: METRIC_DETAILS[key],
  };
}
