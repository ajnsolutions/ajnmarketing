/**
 * Compose a complete Weekly Growth Plan from Business Brain intelligence.
 * Pure function — no I/O, no execution, no re-ranking of Marketing Director.
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { BusinessGoal } from "@/lib/goals/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import type { SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import { resolveExpectedBusinessOutcomes } from "@/lib/growth-advisor/expectedImpact";
import { buildNextWeekMonitoring } from "@/lib/growth-advisor/nextWeek";
import { synthesizePlanEvidence, buildHistoricalContext } from "@/lib/growth-planner/evidence";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import { resolvePrimaryObjective } from "@/lib/growth-planner/primaryObjective";
import { buildSupportingActions } from "@/lib/growth-planner/supportingActions";
import { resolveSuccessMetric } from "@/lib/growth-planner/successMetric";
import { buildPlanExplainability, isoWeekKey } from "@/lib/growth-planner/weekKey";
import {
  WeeklyPlanStatuses,
  type PlanWatchSignal,
  type WeeklyGrowthPlan,
} from "@/lib/growth-planner/types";

function estimatedEffort(briefing: HeadOfMarketingBriefing): string {
  const label = briefing.timeRespectLabel;
  if (!label || label === "Nothing to review") {
    return "Light — review and approve when ready.";
  }
  return `About ${label} to review and approve.`;
}

const MIN_OPPORTUNITY_SCORE_TO_DRIVE_OBJECTIVE = 60;

function buildWhyNow(input: {
  briefing: HeadOfMarketingBriefing;
  evidenceCount: number;
  objectiveLabel: string;
  topOpportunity?: DetectedOpportunity | null;
}): string {
  // When an active opportunity is strong enough to have driven this week's
  // objective (see primaryObjective.ts), its own "why now" is the most
  // honest answer — it's the actual reason, not a restated label.
  if (input.topOpportunity && input.topOpportunity.score.total >= MIN_OPPORTUNITY_SCORE_TO_DRIVE_OBJECTIVE) {
    return input.topOpportunity.whyNow;
  }

  const detailWhy = input.briefing.topRecommendationDetail?.whyNow?.trim();
  if (detailWhy) return detailWhy;

  if (input.briefing.thisWeek.length > 1) {
    return `This week’s signals point to “${input.objectiveLabel}” as the clearest focus.`;
  }

  if (input.evidenceCount >= 2) {
    return `Several Business Brain signals align around “${input.objectiveLabel}” right now.`;
  }

  return `“${input.objectiveLabel}” is the most practical focus while we keep learning your business.`;
}

function toWatchSignals(input: {
  briefing: HeadOfMarketingBriefing;
  goals: BusinessGoal[];
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
}): PlanWatchSignal[] {
  return buildNextWeekMonitoring({
    briefing: input.briefing,
    goals: input.goals,
    customerVoice: input.customerVoice,
    externalIntelligence: input.externalIntelligence,
  }).map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
  }));
}

export type BuildWeeklyGrowthPlanInput = {
  briefing: HeadOfMarketingBriefing;
  businessDiscovery?: BusinessDiscoveryResult | null;
  goals?: BusinessGoal[];
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  smartUploadFacts?: SmartUploadKnowledgeFactRecord[];
  businessReasoning?: BusinessReasoningResult | null;
  businessLearningPattern?: BusinessPattern | null;
  topOpportunity?: DetectedOpportunity | null;
  now?: Date;
  /** Optional stable id (e.g. when refreshing the same week). */
  planId?: string;
  status?: WeeklyGrowthPlan["status"];
  outcome?: string | null;
};

/**
 * Generate exactly one weekly plan with one primary objective.
 * Recommendations only — never executes marketing actions.
 */
export function buildWeeklyGrowthPlan(input: BuildWeeklyGrowthPlanInput): WeeklyGrowthPlan {
  const now = input.now ?? new Date();
  const goals = input.goals ?? [];
  const objective = resolvePrimaryObjective({
    briefing: input.briefing,
    goals,
    customerVoice: input.customerVoice,
    externalIntelligence: input.externalIntelligence,
    topOpportunity: input.topOpportunity,
  });

  const evidence = synthesizePlanEvidence({
    briefing: input.briefing,
    businessDiscovery: input.businessDiscovery,
    goals,
    customerVoice: input.customerVoice,
    externalIntelligence: input.externalIntelligence,
    smartUploadFacts: input.smartUploadFacts,
    businessReasoning: input.businessReasoning,
    topOpportunity: input.topOpportunity,
  });

  const whyNow = buildWhyNow({
    briefing: input.briefing,
    evidenceCount: evidence.length,
    objectiveLabel: objective.label,
    topOpportunity: input.topOpportunity,
  });

  const impact = resolveExpectedBusinessOutcomes({
    actionType: input.briefing.topRecommendationDetail?.actionType,
    expectedBenefit: input.briefing.topRecommendationDetail?.expectedBenefit,
    supportsGoal: goals[0]?.label ?? null,
  });

  const supportingActions = buildSupportingActions({
    objectiveKey: objective.key,
    briefing: input.briefing,
  });

  const successMetric = resolveSuccessMetric({
    objectiveKey: objective.key,
    goals,
  });

  const whatIllWatch = toWatchSignals({
    briefing: input.briefing,
    goals,
    customerVoice: input.customerVoice,
    externalIntelligence: input.externalIntelligence,
  });

  const explainability = buildPlanExplainability({
    briefing: input.briefing,
    whyNow,
    evidence,
    goals,
    expectedImpact: impact.summary,
  });

  const weekKey = isoWeekKey(now);
  const id = input.planId ?? `wgp_${weekKey}_${now.getTime().toString(36)}`;

  return {
    id,
    weekKey,
    generatedAt: now.toISOString(),
    status: input.status ?? WeeklyPlanStatuses.PROPOSED,
    outcome: input.outcome ?? null,
    primaryObjective: objective,
    whyNow,
    expectedImpact: impact.summary,
    estimatedEffort: estimatedEffort(input.briefing),
    supportingActions,
    successMetric,
    whatIllWatch,
    evidence,
    historicalContext: buildHistoricalContext(input.businessLearningPattern),
    explainability,
  };
}
