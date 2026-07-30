/**
 * Adapter: Business Knowledge Graph reasoning -> LearningSignalInput[].
 *
 * A multi-source Business Conclusion is itself real, fused evidence — this
 * adapter cites it as supporting context for the Learning Engine's own
 * patterns, it does not re-run the graph's reasoning. A detected conflict is
 * genuine uncertainty, not a negative outcome, so it's normalized as
 * "inconclusive" rather than misrepresented as a negative pattern.
 */

import type { BusinessReasoningResult } from "@/lib/business-knowledge-graph/reasoning";
import type { LearningSignalInput } from "@/lib/business-learning-engine/types";

export function businessReasoningToLearningSignals(
  reasoning: BusinessReasoningResult | null | undefined,
): LearningSignalInput[] {
  if (!reasoning) return [];

  const conclusionSignals: LearningSignalInput[] = reasoning.conclusions.map((conclusion) => ({
    sourceProviderId: "business_knowledge_graph",
    sourceLabel: "Business Knowledge Graph",
    patternKey: `business_knowledge_graph:${conclusion.entityId}`,
    statement: conclusion.statement,
    direction: "positive",
    confidence: conclusion.confidence,
    evidenceSummary: conclusion.reasoning,
    occurredAt: conclusion.lastUpdated,
  }));

  const conflictSignals: LearningSignalInput[] = reasoning.conflicts.map((conflict) => ({
    sourceProviderId: "business_knowledge_graph",
    sourceLabel: "Business Knowledge Graph",
    patternKey: `business_knowledge_graph_conflict:${conflict.id}`,
    statement: conflict.summary,
    direction: "inconclusive",
    confidence: "low",
    evidenceSummary: conflict.summary,
    occurredAt: null,
  }));

  return [...conclusionSignals, ...conflictSignals];
}
