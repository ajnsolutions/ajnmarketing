/**
 * Goals -> graph signals. Pure function — no I/O.
 *
 * GoalKey is a closed set of generic categories (e.g. "launch_new_service"),
 * not a specific service name — so a goal only produces a real `goal_for`
 * relationship once the graph builder finds genuine topic overlap between
 * the goal's own label and another entity's label. A generic goal like
 * "Increase revenue" simply won't overlap with anything, which is correct
 * behavior — never force a link that isn't there.
 */

import type { BusinessGoal } from "@/lib/goals/types";
import { GraphEntityTypes, type GraphSignalInput } from "@/lib/business-knowledge-graph/types";

const PROVIDER_ID = "goals";
const PROVIDER_LABEL = "Goals & Strategy";

export function goalsToGraphSignals(goals: BusinessGoal[] | null | undefined): GraphSignalInput[] {
  if (!goals?.length) return [];

  return goals
    .filter((goal) => goal.status === "active")
    .map((goal) => ({
      sourceProviderId: PROVIDER_ID,
      sourceLabel: PROVIDER_LABEL,
      entityType: GraphEntityTypes.GOAL,
      entityLabel: goal.label,
      confidence: "high" as const,
      evidenceSummary: `Stated goal: ${goal.label}`,
      occurredAt: goal.updatedAt,
    }));
}
