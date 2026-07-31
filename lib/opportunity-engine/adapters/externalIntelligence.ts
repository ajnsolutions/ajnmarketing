/**
 * External Intelligence adapter (Search Console + market signals) — Search
 * Console demand, seasonal timing, local events, and competitor activity
 * are already distinct categories on ExternalIntelligence, so this one
 * adapter covers four opportunity types without inventing new detection
 * logic — it only relabels already-computed, evidence-linked insights.
 */

import type { ExternalIntelligence, ExternalIntelligenceInsight } from "@/lib/external-intelligence/types";
import { OpportunityTypes, type OpportunityCandidateInput, type OpportunityType } from "@/lib/opportunity-engine/types";

const SOURCE_PROVIDER_ID = "external_intelligence";
const SOURCE_LABEL = "External Intelligence";

function toCandidate(
  insight: ExternalIntelligenceInsight,
  type: OpportunityType,
  whyNow: string,
  expectedOutcome: string,
): OpportunityCandidateInput {
  return {
    sourceProviderId: SOURCE_PROVIDER_ID,
    sourceLabel: SOURCE_LABEL,
    type,
    topic: insight.insight,
    statement: insight.insight,
    whyNow,
    expectedOutcome,
    confidence: insight.confidence,
    businessImpact: insight.businessImpact,
    urgency: type === OpportunityTypes.SEASONAL || type === OpportunityTypes.LOCAL_EVENT ? "high" : "medium",
    evidenceSummary: insight.insight,
    occurredAt: insight.lastUpdated,
  };
}

export function externalIntelligenceOpportunityCandidates(
  externalIntelligence: ExternalIntelligence | null | undefined,
): OpportunityCandidateInput[] {
  if (!externalIntelligence || externalIntelligence.emptyState === "no_evidence") return [];

  const candidates: OpportunityCandidateInput[] = [];

  for (const insight of externalIntelligence.seasonalOpportunities.slice(0, 2)) {
    candidates.push(
      toCandidate(
        insight,
        OpportunityTypes.SEASONAL,
        "This seasonal window is active now — timing matters more than usual.",
        "Content that rides the current season typically sees stronger engagement while it's relevant.",
      ),
    );
  }

  for (const insight of externalIntelligence.localEvents.slice(0, 2)) {
    candidates.push(
      toCandidate(
        insight,
        OpportunityTypes.LOCAL_EVENT,
        "A local event tied to your area is happening now.",
        "Tying content to a real local event helps you show up in what your community is already paying attention to.",
      ),
    );
  }

  for (const insight of externalIntelligence.searchDemandTrends.slice(0, 2)) {
    candidates.push(
      toCandidate(
        insight,
        OpportunityTypes.TRENDING_SEARCH,
        "Search demand for this is measurably rising right now.",
        "Publishing while demand is rising gives new content the best chance of being found.",
      ),
    );
  }

  for (const insight of externalIntelligence.competitorActivity.slice(0, 1)) {
    candidates.push(
      toCandidate(
        insight,
        OpportunityTypes.COMPETITIVE_POSITIONING,
        "A competitor shift creates a window to differentiate.",
        "Clarifying your own positioning while this is fresh helps customers tell you apart from competitors.",
      ),
    );
  }

  return candidates;
}
