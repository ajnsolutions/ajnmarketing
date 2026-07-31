/**
 * Pure composition — no I/O. Aggregates every adapter's knowledge cards
 * into one snapshot, grouped by section, plus the unified missing-knowledge
 * list and an honest overall confidence computed from the cards themselves
 * (never re-using a different subsystem's own composite score under a
 * different label).
 */

import type { BusinessDiscoveryResult } from "@/lib/business-discovery/types";
import type { CustomerVoiceIntelligence } from "@/lib/customer-voice/types";
import type { ExternalIntelligence } from "@/lib/external-intelligence/types";
import type { BusinessGoal } from "@/lib/goals/types";
import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import type { DetectedOpportunity } from "@/lib/opportunity-engine/types";
import type { BusinessKnowledgeHealth } from "@/lib/business-knowledge-graph/knowledgeHealth";
import type { WebsiteAnalysis } from "@/lib/website-analysis/types";
import { businessDiscoveryKnowledgeCards } from "@/lib/business-brain-inspector/adapters/businessDiscovery";
import { customerVoiceKnowledgeCards } from "@/lib/business-brain-inspector/adapters/customerVoice";
import { externalIntelligenceKnowledgeCards } from "@/lib/business-brain-inspector/adapters/externalIntelligence";
import { opportunityEngineKnowledgeCards } from "@/lib/business-brain-inspector/adapters/opportunityEngine";
import { goalsKnowledgeCards } from "@/lib/business-brain-inspector/adapters/goals";
import { businessLearningEngineKnowledgeCards } from "@/lib/business-brain-inspector/adapters/businessLearningEngine";
import { buildMissingKnowledge } from "@/lib/business-brain-inspector/missingKnowledge";
import { overallConfidenceFrom } from "@/lib/business-brain-inspector/confidence";
import {
  BRAIN_SECTION_ORDER,
  type BusinessBrainSnapshot,
  type KnowledgeCard,
} from "@/lib/business-brain-inspector/types";

export type BuildBusinessBrainSnapshotInput = {
  businessDiscovery?: BusinessDiscoveryResult | null;
  businessProfile?: { city: string | null; state: string | null } | null;
  websiteAnalysis?: WebsiteAnalysis | null;
  customerVoice?: CustomerVoiceIntelligence | null;
  externalIntelligence?: ExternalIntelligence | null;
  goals?: BusinessGoal[] | null;
  learningPatterns?: BusinessPattern[] | null;
  opportunities?: DetectedOpportunity[] | null;
  businessKnowledgeHealth?: BusinessKnowledgeHealth | null;
  now?: Date;
};

function overallExplanation(cardCount: number, missingCount: number): string {
  if (cardCount === 0) {
    return "We don't have enough evidence yet to describe your business with any confidence.";
  }
  if (missingCount === 0) {
    return `Built from ${cardCount} pieces of evidence-linked knowledge, with no major gaps identified right now.`;
  }
  return `Built from ${cardCount} pieces of evidence-linked knowledge — ${missingCount} area${missingCount === 1 ? "" : "s"} could still use more evidence.`;
}

export function buildBusinessBrainSnapshot(input: BuildBusinessBrainSnapshotInput): BusinessBrainSnapshot {
  const now = input.now ?? new Date();

  const allCards: KnowledgeCard[] = [
    ...businessDiscoveryKnowledgeCards({
      businessDiscovery: input.businessDiscovery,
      businessProfile: input.businessProfile,
      websiteAnalysis: input.websiteAnalysis,
    }),
    ...customerVoiceKnowledgeCards(input.customerVoice),
    ...externalIntelligenceKnowledgeCards(input.externalIntelligence),
    ...opportunityEngineKnowledgeCards(input.opportunities),
    ...goalsKnowledgeCards(input.goals),
    ...businessLearningEngineKnowledgeCards(input.learningPatterns),
  ];

  const sections: BusinessBrainSnapshot["sections"] = {};
  for (const section of BRAIN_SECTION_ORDER) {
    const cardsForSection = allCards.filter((card) => card.section === section);
    if (cardsForSection.length > 0) sections[section] = cardsForSection;
  }

  const missingKnowledge = buildMissingKnowledge({
    businessDiscovery: input.businessDiscovery,
    businessKnowledgeHealth: input.businessKnowledgeHealth,
  });

  return {
    generatedAt: now.toISOString(),
    overallConfidence: overallConfidenceFrom(allCards.map((card) => card.confidence)),
    overallConfidenceExplanation: overallExplanation(allCards.length, missingKnowledge.length),
    sections,
    missingKnowledge,
  };
}
