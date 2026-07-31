/**
 * Business Learning Engine adapter — Learning History. Reuses the engine's
 * own persisted, decay-adjusted patterns directly.
 */

import type { BusinessPattern } from "@/lib/business-learning-engine/types";
import { fromConfidenceLevel } from "@/lib/business-brain-inspector/confidence";
import { BrainSections, type KnowledgeCard } from "@/lib/business-brain-inspector/types";

export function businessLearningEngineKnowledgeCards(patterns: BusinessPattern[] | null | undefined): KnowledgeCard[] {
  if (!patterns?.length) return [];

  return patterns.slice(0, 6).map((pattern) => ({
    id: `learning_${pattern.id}`,
    section: BrainSections.LEARNING_HISTORY,
    title: pattern.statement.length > 60 ? `${pattern.statement.slice(0, 57)}...` : pattern.statement,
    statement: pattern.statement,
    confidence: fromConfidenceLevel(pattern.effectiveConfidence),
    confidenceReason: `Reinforced ${pattern.reinforcementCount} time${pattern.reinforcementCount === 1 ? "" : "s"} since ${new Date(pattern.firstObserved).toLocaleDateString()}${pattern.decayState !== "fresh" ? ` — confidence has decayed (${pattern.decayState}) without recent reinforcement.` : "."}`,
    evidenceCount: pattern.evidence.length,
    evidence: pattern.evidence.map((e) => ({
      sourceProviderId: e.sourceProviderId,
      sourceLabel: e.sourceLabel,
      summary: e.summary,
    })),
    correction: { label: "See your full learning history", href: "/dashboard/business-timeline" },
  }));
}
