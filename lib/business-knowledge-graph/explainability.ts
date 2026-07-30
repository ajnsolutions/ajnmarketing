/**
 * Shared "why do you believe this" contract (Part 9). Every reasoning output
 * (conclusion, conflict) can be explained through this one shape — customer
 * copy, never internal entity/relationship ids or graph mechanics.
 */

import type { BusinessConclusion, BusinessConflict, OpportunitySignal } from "@/lib/business-knowledge-graph/reasoning";
import type { ConfidenceLevel } from "@/lib/business-knowledge-graph/types";

export type ReasoningExplanation = {
  /** Plain-language summary of the conclusion/conflict itself. */
  summary: string;
  /** Customer-safe evidence bullets — never a raw provider payload or an entity/relationship id. */
  supportingEvidence: string[];
  /** Distinct source labels behind this explanation (e.g. "Search Console", "Smart Uploads"). */
  sources: string[];
  confidence: ConfidenceLevel | null;
};

export function explainConclusion(conclusion: BusinessConclusion): ReasoningExplanation {
  return {
    summary: conclusion.statement,
    supportingEvidence: conclusion.evidence.map((e) => e.summary),
    sources: [...new Set(conclusion.evidence.map((e) => e.sourceLabel))],
    confidence: conclusion.confidence,
  };
}

export function explainOpportunitySignal(signal: OpportunitySignal): ReasoningExplanation {
  return {
    summary: signal.statement,
    supportingEvidence: signal.evidence.map((e) => e.summary),
    sources: [...new Set(signal.evidence.map((e) => e.sourceLabel))],
    confidence: signal.confidence,
  };
}

export function explainConflict(conflict: BusinessConflict): ReasoningExplanation {
  return {
    summary: conflict.summary,
    supportingEvidence: [
      ...conflict.evidenceForA.map((e) => e.summary),
      ...conflict.evidenceForB.map((e) => e.summary),
    ],
    sources: [
      ...new Set([
        ...conflict.evidenceForA.map((e) => e.sourceLabel),
        ...conflict.evidenceForB.map((e) => e.sourceLabel),
      ]),
    ],
    confidence: null,
  };
}
