/**
 * Business Brain — shared contracts for reusable intelligence sources.
 */

export type {
  BusinessInsight,
  BusinessInsightEvidence,
  BusinessInsightPossibleAction,
  BusinessImpactLevel,
  ConfidenceLevel,
  TimeHorizon,
} from "@/lib/business-brain/insight";

export {
  BusinessImpactLevels,
  ConfidenceLevels,
  TimeHorizons,
  isBusinessInsight,
} from "@/lib/business-brain/insight";
