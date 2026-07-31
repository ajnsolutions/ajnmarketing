/**
 * Deduplication and merging (Part 4) — prevents two providers from
 * surfacing the same real-world opportunity twice, and fuses genuinely
 * corroborating candidates (same type, overlapping topic) into one, richer
 * opportunity with combined evidence — the same topic-overlap technique the
 * Business Knowledge Graph uses for entity clustering, applied here to
 * opportunity candidates instead of graph entities.
 */

import { topicOverlap, TOPIC_MERGE_THRESHOLD } from "@/lib/business-knowledge-graph/topicMatch";
import {
  contributingProvidersFromEvidence,
  type ConfidenceLevel,
  type ImpactLevel,
  type OpportunityCandidateInput,
  type OpportunityEvidence,
  type OpportunityType,
  type UrgencyLevel,
} from "@/lib/opportunity-engine/types";

export type MergedOpportunityCandidate = {
  type: OpportunityType;
  topic: string;
  statement: string;
  whyNow: string;
  expectedOutcome: string;
  confidence: ConfidenceLevel;
  businessImpact: ImpactLevel;
  urgency: UrgencyLevel;
  relatedActionType: string | null;
  evidence: OpportunityEvidence[];
  occurredAt: string | null;
};

const TIER: Record<"low" | "medium" | "high", number> = { low: 1, medium: 2, high: 3 };

function strongerTier<T extends "low" | "medium" | "high">(a: T, b: T): T {
  return (TIER[a] >= TIER[b] ? a : b) as T;
}

function mostRecent(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function candidateToEvidence(candidate: OpportunityCandidateInput, index: number): OpportunityEvidence {
  return {
    id: `evidence_${index}_${candidate.sourceProviderId}`,
    sourceProviderId: candidate.sourceProviderId,
    sourceLabel: candidate.sourceLabel,
    summary: candidate.evidenceSummary,
    occurredAt: candidate.occurredAt,
  };
}

function mergeTwo(
  base: MergedOpportunityCandidate,
  candidate: OpportunityCandidateInput,
  evidenceIndex: number,
): MergedOpportunityCandidate {
  return {
    ...base,
    confidence: strongerTier(base.confidence, candidate.confidence),
    businessImpact: strongerTier(base.businessImpact, candidate.businessImpact),
    urgency: strongerTier(base.urgency, candidate.urgency),
    relatedActionType: base.relatedActionType ?? candidate.relatedActionType ?? null,
    evidence: [...base.evidence, candidateToEvidence(candidate, evidenceIndex)],
    occurredAt: mostRecent(base.occurredAt, candidate.occurredAt),
  };
}

/**
 * Groups candidates of the same opportunity type whose topics overlap above
 * TOPIC_MERGE_THRESHOLD into one merged candidate with combined evidence.
 * Order-preserving: the first candidate in each group sets the representative
 * topic/statement/whyNow/expectedOutcome text.
 */
export function mergeOpportunityCandidates(
  candidates: OpportunityCandidateInput[],
): MergedOpportunityCandidate[] {
  const groups: MergedOpportunityCandidate[] = [];

  candidates.forEach((candidate, index) => {
    const match = groups.find(
      (group) => group.type === candidate.type && topicOverlap(group.topic, candidate.topic) >= TOPIC_MERGE_THRESHOLD,
    );

    if (match) {
      const merged = mergeTwo(match, candidate, index);
      groups[groups.indexOf(match)] = merged;
      return;
    }

    groups.push({
      type: candidate.type,
      topic: candidate.topic,
      statement: candidate.statement,
      whyNow: candidate.whyNow,
      expectedOutcome: candidate.expectedOutcome,
      confidence: candidate.confidence,
      businessImpact: candidate.businessImpact,
      urgency: candidate.urgency,
      relatedActionType: candidate.relatedActionType ?? null,
      evidence: [candidateToEvidence(candidate, index)],
      occurredAt: candidate.occurredAt,
    });
  });

  return groups;
}

export function evidenceContributingProviders(evidence: OpportunityEvidence[]): string[] {
  return contributingProvidersFromEvidence(evidence);
}

export { strongerTier };
