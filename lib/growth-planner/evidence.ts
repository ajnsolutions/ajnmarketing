/**
 * Evidence synthesis for weekly plans — cites multiple Business Brain sources.
 * Distinguishes Observed / Likely / Recommended. Never exposes chain-of-thought.
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { BusinessGoal } from "@/lib/goals/types";
import type {
  CustomerVoiceIntelligence,
  CustomerVoiceTheme,
} from "@/lib/customer-voice/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import { PlanTrustCertaintyLevels } from "@/lib/growth-planner/trust";
import type { PlanEvidenceItem } from "@/lib/growth-planner/types";
import { findSearchDemandCrossovers } from "@/lib/smart-uploads/crossover";
import type { SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";

function firstVoiceTheme(cv: CustomerVoiceIntelligence): CustomerVoiceTheme | null {
  return (
    cv.strengths[0] ??
    cv.concerns[0] ??
    cv.opportunities[0] ??
    cv.commonCustomerLanguage[0] ??
    null
  );
}

export function synthesizePlanEvidence(input: {
  briefing: HeadOfMarketingBriefing;
  businessDiscovery?: BusinessDiscoveryResult | null;
  goals: BusinessGoal[];
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  smartUploadFacts?: SmartUploadKnowledgeFactRecord[];
  businessReasoning?: BusinessReasoningResult | null;
}): PlanEvidenceItem[] {
  const items: PlanEvidenceItem[] = [];
  const seen = new Set<string>();

  const push = (item: PlanEvidenceItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  // A fused, multi-source Business Knowledge Graph conclusion is the
  // strongest available evidence — cite it first, ahead of single-source items.
  const topConclusion = input.businessReasoning?.conclusions[0];
  if (topConclusion) {
    push({
      id: "business_reasoning_conclusion",
      certainty:
        topConclusion.confidence === "high"
          ? PlanTrustCertaintyLevels.OBSERVED
          : PlanTrustCertaintyLevels.LIKELY,
      statement: topConclusion.statement,
      source: "business_reasoning",
    });
  }

  if (input.briefing.thisWeek.length > 0) {
    push({
      id: "briefing_this_week",
      certainty: PlanTrustCertaintyLevels.OBSERVED,
      statement: input.briefing.thisWeek[0]!,
      source: "weekly_briefing",
    });
  }

  const activeGoals = input.goals.filter((g) => g.status === "active");
  if (activeGoals.length > 0) {
    const primary = [...activeGoals].sort((a, b) => a.priority - b.priority)[0]!;
    push({
      id: "goals_primary",
      certainty: PlanTrustCertaintyLevels.OBSERVED,
      statement: `Your strategic focus includes “${primary.label}.”`,
      source: "goals",
    });
  }

  const cv = input.customerVoice;
  if (cv && cv.emptyState !== "no_evidence") {
    const theme = firstVoiceTheme(cv);
    if (theme) {
      push({
        id: "cv_theme",
        certainty:
          theme.confidence === "high"
            ? PlanTrustCertaintyLevels.OBSERVED
            : PlanTrustCertaintyLevels.LIKELY,
        statement: `Customers often mention “${theme.label}.”`,
        source: "customer_voice",
      });
    }
  }

  const ei = input.externalIntelligence;
  if (ei && ei.emptyState !== "no_evidence") {
    if (ei.seasonalOpportunities.length > 0) {
      const seasonal = ei.seasonalOpportunities[0]!;
      push({
        id: "ei_seasonal",
        certainty:
          seasonal.confidence === "high"
            ? PlanTrustCertaintyLevels.OBSERVED
            : PlanTrustCertaintyLevels.LIKELY,
        statement: seasonal.insight,
        source: "external_intelligence",
      });
    } else if (ei.competitorActivity.length > 0) {
      const competitor = ei.competitorActivity[0]!;
      push({
        id: "ei_competitor",
        certainty: PlanTrustCertaintyLevels.LIKELY,
        statement: competitor.insight,
        source: "external_intelligence",
      });
    } else if (ei.searchDemandTrends.length > 0) {
      const trend = ei.searchDemandTrends[0]!;
      push({
        id: "ei_search",
        certainty: PlanTrustCertaintyLevels.LIKELY,
        statement: trend.insight,
        source: "external_intelligence",
      });
    }
  }

  const activeFacts = (input.smartUploadFacts ?? []).filter((fact) => !fact.superseded_by);
  if (activeFacts.length > 0) {
    const crossover =
      ei && ei.searchDemandTrends.length > 0
        ? findSearchDemandCrossovers(activeFacts, ei.searchDemandTrends)[0]
        : undefined;

    if (crossover) {
      push({
        id: "smart_uploads_search_crossover",
        certainty: PlanTrustCertaintyLevels.LIKELY,
        statement: `${crossover.insight.insight} Your uploaded documents also mention: "${crossover.fact.fact}".`,
        source: "smart_uploads",
      });
    } else {
      const confidenceRank: Record<string, number> = { low: 1, medium: 2, high: 3 };
      const topFact = [...activeFacts].sort(
        (a, b) => (confidenceRank[b.confidence] ?? 0) - (confidenceRank[a.confidence] ?? 0),
      )[0]!;
      push({
        id: "smart_uploads_fact",
        certainty: topFact.confidence === "high" ? PlanTrustCertaintyLevels.OBSERVED : PlanTrustCertaintyLevels.LIKELY,
        statement: topFact.fact,
        source: "smart_uploads",
      });
    }
  }

  const discovery = input.businessDiscovery;
  const serviceValues = discovery?.primaryServices.value;
  if (serviceValues && serviceValues.length > 0) {
    const services = discovery!.primaryServices;
    push({
      id: "bd_services",
      certainty:
        services.confidenceTier === "known"
          ? PlanTrustCertaintyLevels.OBSERVED
          : PlanTrustCertaintyLevels.LIKELY,
      statement: `We understand your core services include ${serviceValues.slice(0, 2).join(" and ")}.`,
      source: "business_discovery",
    });
  }

  if (input.briefing.topRecommendationDetail?.title) {
    push({
      id: "md_recommendation",
      certainty: PlanTrustCertaintyLevels.RECOMMENDED,
      statement: `This week’s recommended focus: ${input.briefing.topRecommendationDetail.title}.`,
      source: "weekly_briefing",
    });
  }

  return items.slice(0, 6);
}
