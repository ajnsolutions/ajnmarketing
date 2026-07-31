/**
 * Goals adapter — Business Goals. A stated goal is always high confidence
 * (the owner told us directly) — there's nothing to infer.
 */

import type { BusinessGoal } from "@/lib/goals/types";
import { BrainSections, type KnowledgeCard } from "@/lib/business-brain-inspector/types";

export function goalsKnowledgeCards(goals: BusinessGoal[] | null | undefined): KnowledgeCard[] {
  if (!goals?.length) return [];

  return goals
    .filter((goal) => goal.status === "active")
    .sort((a, b) => a.priority - b.priority)
    .map((goal) => ({
      id: `goal_${goal.key}`,
      section: BrainSections.BUSINESS_GOALS,
      title: goal.label,
      statement: `Priority ${goal.priority}: ${goal.label}${goal.targetTimeframe ? ` (target: ${goal.targetTimeframe.replace(/_/g, " ")})` : ""}.`,
      confidence: "high",
      confidenceReason: "You told us this directly.",
      evidenceCount: 1,
      evidence: [{ sourceProviderId: "goals", sourceLabel: "Goals & Strategy", summary: `Stated goal: ${goal.label}.` }],
      correction: { label: "Update your goals", href: "/dashboard/setup/goals" },
    }));
}
