/**
 * Centralized relationship/evidence-type allowlists. No caller may construct a
 * DecisionEvidenceTrace with a relationship or evidence type outside these sets — see
 * types.ts for the closed vocabularies themselves.
 */

import {
  DecisionEvidenceRelationshipTypes,
  DecisionEvidenceTypes,
  type DecisionEvidenceRelationshipType,
  type DecisionEvidenceType,
} from "@/lib/decision-intelligence/types";

const EVIDENCE_TYPE_SET = new Set<string>(Object.values(DecisionEvidenceTypes));
const RELATIONSHIP_TYPE_SET = new Set<string>(Object.values(DecisionEvidenceRelationshipTypes));

export function isAllowedEvidenceType(value: string): value is DecisionEvidenceType {
  return EVIDENCE_TYPE_SET.has(value);
}

export function isAllowedRelationshipType(value: string): value is DecisionEvidenceRelationshipType {
  return RELATIONSHIP_TYPE_SET.has(value);
}

/**
 * Allowlisted internal routes evidence may link to — never an arbitrary URL. Extend this
 * map, not ad-hoc string concatenation at call sites.
 */
const SOURCE_TARGET_ROUTES: Record<DecisionEvidenceType, (id: string) => string> = {
  recommendation: () => "/dashboard/marketing-recommendations",
  recommendation_outcome: () => "/dashboard/marketing-recommendations",
  campaign: () => "/dashboard#campaigns-heading",
  campaign_completion: () => "/dashboard#campaigns-heading",
  experiment_proposal: () => "/dashboard#experiments-heading",
  experiment_completion: () => "/dashboard#experiments-heading",
  marketing_memory_observation: () => "/dashboard/decision-intelligence",
  marketing_memory_learning: () => "/dashboard/decision-intelligence",
  marketing_memory_preference: () => "/dashboard/marketing-preferences",
  marketing_memory_override: () => "/dashboard/decision-intelligence",
  market_context: () => "/dashboard/market-context",
};

export function sourceTargetFor(evidenceType: DecisionEvidenceType, evidenceId: string): string {
  return SOURCE_TARGET_ROUTES[evidenceType](evidenceId);
}
