/**
 * What I Noticed — 3–5 concise Business Brain observations.
 * Combines Discovery, Goals, Customer Voice, External Intelligence, and briefing signals.
 * Explains why each matters. Never fabricates.
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import { growthAdvisorCustomerVoiceLines } from "@/lib/customer-voice/presentation";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { BusinessGoal } from "@/lib/goals/types";
import { buildGoalProgress, type GoalProgressSignals } from "@/lib/goals/progress";
import type { HeadOfMarketingBriefing } from "@/lib/head-of-marketing/types";
import {
  TrustCertaintyLevels,
  type TrustCertainty,
} from "@/lib/growth-advisor/trust";
import { findSearchDemandCrossovers, findWebsiteContentGaps } from "@/lib/smart-uploads/crossover";
import type { SmartUploadDocumentRecord, SmartUploadKnowledgeFactRecord } from "@/lib/smart-uploads/types";
import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";

export type GrowthAdvisorObservationV2 = {
  headline: string;
  whyItMatters: string;
  certainty: TrustCertainty;
  /** Opaque evidence source for explainability — never chain-of-thought. */
  evidenceSource: string;
  /**
   * Present only for a synthesized, multi-source Business Knowledge Graph
   * conclusion — customer-safe evidence bullets citing each corroborating
   * source. Absent for a single-source observation.
   */
  supportingEvidence?: string[];
};

const WHY_IT_MATTERS: Record<string, string> = {
  "Search visibility": "That's often the first way a new customer finds you.",
  "Review trends": "Reviews shape whether someone trusts you enough to reach out.",
  "Competitor activity": "Knowing what others are doing helps keep your offer sharp.",
  "Seasonal opportunities": "Timing well means less competition for the same customers.",
  "Community & content": "A few minutes now keeps your content moving without it piling up.",
};

const GENERIC_WHY = "Worth keeping an eye on as the week goes on.";

function fromBriefingSignal(item: string): GrowthAdvisorObservationV2 | null {
  if (/^Nothing urgent/.test(item)) return null;
  const separatorIndex = item.indexOf(": ");
  if (separatorIndex === -1) {
    return {
      headline: item,
      whyItMatters: GENERIC_WHY,
      certainty: TrustCertaintyLevels.LIKELY,
      evidenceSource: "weekly_briefing",
    };
  }
  const category = item.slice(0, separatorIndex);
  const headline = item.slice(separatorIndex + 2);
  return {
    headline,
    whyItMatters: WHY_IT_MATTERS[category] ?? GENERIC_WHY,
    certainty: TrustCertaintyLevels.OBSERVED,
    evidenceSource: `weekly_briefing:${category}`,
  };
}

function customerVoiceObservation(
  intelligence: CustomerVoiceIntelligence | null | undefined,
): GrowthAdvisorObservationV2 | null {
  const lines = growthAdvisorCustomerVoiceLines(intelligence);
  if (!lines.noticedLine) return null;
  const strength = intelligence?.strengths.find(
    (t) => t.evidenceCount >= 2 && t.confidence !== "low",
  );
  return {
    headline: lines.noticedLine,
    whyItMatters: "Customer language is one of the strongest cues for authentic marketing.",
    certainty:
      strength && strength.confidence === "high"
        ? TrustCertaintyLevels.OBSERVED
        : TrustCertaintyLevels.LIKELY,
    evidenceSource: "customer_voice",
  };
}

function goalObservation(
  goals: BusinessGoal[],
  signals: GoalProgressSignals,
): GrowthAdvisorObservationV2 | null {
  if (goals.length === 0) return null;
  const progress = buildGoalProgress(goals, signals);
  const attention = progress.find((p) => p.state === "needs_attention");
  if (attention) {
    return {
      headline: `${attention.label} needs attention.`,
      whyItMatters: attention.detail,
      certainty: TrustCertaintyLevels.OBSERVED,
      evidenceSource: "goals",
    };
  }
  const establishing = progress.find((p) => p.state === "establishing_baseline");
  if (establishing) {
    return {
      headline: `I'm still establishing a baseline for ${establishing.label.toLowerCase()}.`,
      whyItMatters: establishing.detail,
      certainty: TrustCertaintyLevels.LIKELY,
      evidenceSource: "goals",
    };
  }
  const primary = progress[0];
  if (!primary) return null;
  return {
    headline: `Progress on ${primary.label.toLowerCase()} looks ${primary.state.replace(/_/g, " ")}.`,
    whyItMatters: primary.detail,
    certainty: TrustCertaintyLevels.OBSERVED,
    evidenceSource: "goals",
  };
}

function businessDiscoveryObservation(
  businessDiscovery: BusinessDiscoveryResult | null | undefined,
): GrowthAdvisorObservationV2 | null {
  const opportunities = businessDiscovery?.growthOpportunities;
  if (!opportunities?.value?.length) return null;
  const tier = opportunities.confidenceTier;
  return {
    headline: `Your business profile: ${opportunities.value[0]}`,
    whyItMatters: "Something I noticed while studying your business and website.",
    certainty:
      tier === "known"
        ? TrustCertaintyLevels.OBSERVED
        : tier === "assumed"
          ? TrustCertaintyLevels.LIKELY
          : TrustCertaintyLevels.SUGGESTED,
    evidenceSource: "business_discovery",
  };
}

function externalIntelligenceObservation(
  intelligence: ExternalIntelligence | null | undefined,
): GrowthAdvisorObservationV2 | null {
  if (!intelligence || intelligence.emptyState === "no_evidence") return null;
  const top = intelligence.insights.find((i) => i.confidence !== "low") ?? intelligence.insights[0];
  if (!top) return null;
  return {
    headline: top.insight,
    whyItMatters:
      top.businessImpact === "high"
        ? "This could affect near-term marketing urgency or opportunity."
        : "External context helps time marketing without guessing.",
    certainty:
      top.confidence === "high"
        ? TrustCertaintyLevels.LIKELY
        : top.confidence === "medium"
          ? TrustCertaintyLevels.LIKELY
          : TrustCertaintyLevels.PREDICTED,
    evidenceSource: `external_intelligence:${top.category}`,
  };
}

/**
 * Smart Upload knowledge, cited standalone — e.g. "Your brochure highlights
 * commercial roofing but your website has very little content targeting that
 * service." Only fires when the fact's topic is genuinely underrepresented on
 * the website — never invents a gap.
 */
function websiteContentGapObservation(
  smartUploadFacts: SmartUploadKnowledgeFactRecord[] | undefined,
  smartUploadDocuments: SmartUploadDocumentRecord[] | undefined,
  businessDiscovery: BusinessDiscoveryResult | null | undefined,
): GrowthAdvisorObservationV2 | null {
  const websiteServices = businessDiscovery?.primaryServices?.value ?? [];
  if (!smartUploadFacts?.length || websiteServices.length === 0) return null;

  const documentFileNameById = new Map((smartUploadDocuments ?? []).map((doc) => [doc.id, doc.file_name]));
  const [gap] = findWebsiteContentGaps(smartUploadFacts, documentFileNameById, websiteServices);
  if (!gap) return null;

  return {
    headline: `${gap.documentFileName} highlights "${gap.fact.fact}" but your website has very little content targeting that.`,
    whyItMatters: "Content that matches what you already tell customers directly helps the right people find you.",
    certainty: TrustCertaintyLevels.OBSERVED,
    evidenceSource: `smart_uploads:${gap.fact.category}`,
  };
}

/**
 * Cross-provider evidence: a Search Console demand signal and an uploaded
 * document covering the same topic — e.g. "commercial roofing searches
 * increasing" + "commercial roofing brochure." Cites both sources explicitly;
 * never states a conclusion neither source actually supports.
 */
function searchDemandCrossoverObservation(
  smartUploadFacts: SmartUploadKnowledgeFactRecord[] | undefined,
  externalIntelligence: ExternalIntelligence | null | undefined,
): GrowthAdvisorObservationV2 | null {
  if (!smartUploadFacts?.length || !externalIntelligence?.searchDemandTrends.length) return null;

  const [match] = findSearchDemandCrossovers(smartUploadFacts, externalIntelligence.searchDemandTrends);
  if (!match) return null;

  return {
    headline: `${match.insight.insight} Your uploaded documents also mention: "${match.fact.fact}".`,
    whyItMatters: "When search demand and your own materials point the same direction, it's a stronger signal than either alone.",
    certainty: TrustCertaintyLevels.LIKELY,
    evidenceSource: `crossover:external_intelligence+smart_uploads`,
  };
}

/**
 * The Business Knowledge Graph's top fused conclusion, synthesized into one
 * observation citing every corroborating source — e.g. "We believe
 * commercial roofing represents your best near-term growth opportunity
 * because: search demand increased; your uploaded brochure highlights the
 * service; customers consistently praise it; growing commercial work
 * matches your stated goals." Never fabricates: only fires when the
 * reasoning engine found genuine multi-source corroboration (2+ distinct
 * providers) for a real entity.
 */
function synthesizedInsightObservation(
  reasoning: BusinessReasoningResult | null | undefined,
): GrowthAdvisorObservationV2 | null {
  const top = reasoning?.conclusions[0];
  if (!top) return null;

  const topic = top.statement.replace(/^"|"$|" is a [a-z-]+ growth opportunity\.$/g, "");

  return {
    headline: `We believe ${topic} represents your best near-term growth opportunity.`,
    whyItMatters: `${top.contributingProviderCount} independent sources agree — that's stronger evidence than any one signal alone.`,
    certainty: top.confidence === "high" ? TrustCertaintyLevels.LIKELY : TrustCertaintyLevels.SUGGESTED,
    evidenceSource: `business_reasoning:${top.entityId}`,
    supportingEvidence: top.evidence.map((e) => e.summary),
  };
}

/**
 * Build 3–5 observations from Business Brain sources.
 * Prefer real signals; never pad with fabricated insights.
 */
export function buildWhatINoticedObservations(input: {
  briefing: HeadOfMarketingBriefing;
  businessDiscovery?: BusinessDiscoveryResult | null;
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  goals?: BusinessGoal[];
  progressSignals?: GoalProgressSignals;
  smartUploadFacts?: SmartUploadKnowledgeFactRecord[];
  smartUploadDocuments?: SmartUploadDocumentRecord[];
  businessReasoning?: BusinessReasoningResult | null;
}): GrowthAdvisorObservationV2[] {
  const goals = input.goals ?? [];
  const collected: GrowthAdvisorObservationV2[] = [];
  const seenHeadlines = new Set<string>();

  const push = (obs: GrowthAdvisorObservationV2 | null) => {
    if (!obs) return;
    const key = obs.headline.toLowerCase();
    if (seenHeadlines.has(key)) return;
    seenHeadlines.add(key);
    collected.push(obs);
  };

  // A fused, multi-source Business Knowledge Graph conclusion is the
  // strongest available evidence — prioritize it ahead of everything else.
  push(synthesizedInsightObservation(input.businessReasoning));
  // Crossover evidence is the next-strongest signal (two independent
  // sources agreeing) — prioritize it ahead of single-source observations.
  push(searchDemandCrossoverObservation(input.smartUploadFacts, input.externalIntelligence));
  push(customerVoiceObservation(input.customerVoice));

  if (input.progressSignals) {
    push(goalObservation(goals, input.progressSignals));
  }

  for (const item of input.briefing.noticed) {
    push(fromBriefingSignal(item));
    if (collected.length >= 5) break;
  }

  push(externalIntelligenceObservation(input.externalIntelligence));
  push(websiteContentGapObservation(input.smartUploadFacts, input.smartUploadDocuments, input.businessDiscovery));
  push(businessDiscoveryObservation(input.businessDiscovery));

  return collected.slice(0, 5);
}
