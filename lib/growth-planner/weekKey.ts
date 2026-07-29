/**
 * ISO week helpers + plan explainability builders.
 */

import type { BusinessGoal } from "@/lib/goals/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { confidenceLabelText } from "@/lib/recommendation-presentation/confidenceLabels";
import type { PlanEvidenceItem, PlanExplainability } from "@/lib/growth-planner/types";

/** ISO week key like 2026-W31 (UTC-based for stable history keys). */
export function isoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function buildPlanExplainability(input: {
  briefing: HeadOfMarketingBriefing;
  whyNow: string;
  evidence: PlanEvidenceItem[];
  goals: BusinessGoal[];
  expectedImpact: string;
}): PlanExplainability {
  const detail = input.briefing.topRecommendationDetail;
  const relatedGoals = input.goals
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((g) => g.label);

  const supportingEvidence = input.evidence
    .filter((e) => e.certainty !== "recommended")
    .map((e) => e.statement)
    .slice(0, 4);

  if (supportingEvidence.length === 0 && detail?.whyNow) {
    supportingEvidence.push(detail.whyNow);
  }

  return {
    whyNow: input.whyNow,
    supportingEvidence,
    confidenceLabel: detail?.confidenceLabel ?? null,
    confidenceLabelText: detail?.confidenceLabel
      ? confidenceLabelText(detail.confidenceLabel)
      : null,
    businessImpact: input.expectedImpact,
    relatedGoals,
  };
}
