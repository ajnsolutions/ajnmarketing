/**
 * External Intelligence Business Impact — not frequency alone.
 * Considers revenue opportunity, lead generation, customer impact,
 * marketing urgency, and operational importance.
 */

import type {
  BusinessImpactLevel,
  ExternalIntelligenceCategory,
} from "@/lib/external-intelligence/types";
import {
  BusinessImpactLevels,
  ExternalIntelligenceCategories,
} from "@/lib/external-intelligence/types";
import type { ConfidenceLevel } from "@/lib/external-intelligence/types";

export type ExternalImpactInput = {
  category: ExternalIntelligenceCategory;
  impactHints: readonly string[];
  evidenceCount: number;
  confidence: ConfidenceLevel;
  timeHorizon: import("@/lib/business-brain/insight").TimeHorizon;
};

const HINT_WEIGHT: Record<string, number> = {
  revenue: 3,
  lead_generation: 3,
  customer_impact: 2,
  marketing_urgency: 2,
  operational: 2,
};

const CATEGORY_BASE: Record<ExternalIntelligenceCategory, number> = {
  [ExternalIntelligenceCategories.SEASONAL_OPPORTUNITIES]: 2,
  [ExternalIntelligenceCategories.LOCAL_EVENTS]: 2,
  [ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS]: 3,
  [ExternalIntelligenceCategories.COMPETITOR_ACTIVITY]: 2,
  [ExternalIntelligenceCategories.INDUSTRY_REGULATORY_UPDATES]: 3,
  [ExternalIntelligenceCategories.WEATHER]: 1,
  [ExternalIntelligenceCategories.HOLIDAY_CALENDAR]: 2,
};

/**
 * High signal volume ≠ high impact. A minor holiday may be medium;
 * a regulatory change affecting operations can be high with thinner evidence.
 */
export function calculateExternalBusinessImpact(input: ExternalImpactInput): BusinessImpactLevel {
  let score = CATEGORY_BASE[input.category] ?? 1;

  for (const hint of input.impactHints) {
    score += HINT_WEIGHT[hint] ?? 1;
  }

  if (input.timeHorizon === "immediate") score += 2;
  else if (input.timeHorizon === "near_term") score += 1;

  if (input.evidenceCount >= 3) score += 1;

  if (input.confidence === "low" && input.evidenceCount < 2) {
    score -= 2;
  }

  if (score >= 8) return BusinessImpactLevels.HIGH;
  if (score >= 4) return BusinessImpactLevels.MEDIUM;
  return BusinessImpactLevels.LOW;
}

export function rollupBusinessImpact(levels: BusinessImpactLevel[]): BusinessImpactLevel {
  if (levels.length === 0) return BusinessImpactLevels.LOW;
  if (levels.includes(BusinessImpactLevels.HIGH)) return BusinessImpactLevels.HIGH;
  if (levels.includes(BusinessImpactLevels.MEDIUM)) return BusinessImpactLevels.MEDIUM;
  return BusinessImpactLevels.LOW;
}

/** Default impact hints by category — providers may supply more specific ones later. */
export function defaultImpactHintsForCategory(
  category: ExternalIntelligenceCategory,
): readonly string[] {
  switch (category) {
    case ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS:
      return ["lead_generation", "marketing_urgency"];
    case ExternalIntelligenceCategories.SEASONAL_OPPORTUNITIES:
    case ExternalIntelligenceCategories.HOLIDAY_CALENDAR:
      return ["revenue", "marketing_urgency"];
    case ExternalIntelligenceCategories.LOCAL_EVENTS:
      return ["lead_generation", "customer_impact"];
    case ExternalIntelligenceCategories.COMPETITOR_ACTIVITY:
      return ["marketing_urgency", "customer_impact"];
    case ExternalIntelligenceCategories.INDUSTRY_REGULATORY_UPDATES:
      return ["operational", "customer_impact"];
    case ExternalIntelligenceCategories.WEATHER:
      return ["operational", "marketing_urgency"];
    default:
      return [];
  }
}
