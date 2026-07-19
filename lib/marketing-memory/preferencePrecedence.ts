import "server-only";

import type { MarketingMemoryPreferenceSummary } from "@/lib/marketing-memory/preferenceTypes";

/**
 * Read-time precedence ordinal from MARKETING_MEMORY_ARCHITECTURE.md §16.
 *
 * This is a ranking vocabulary for future Marketing Director evidence consumption
 * (Phase 4). Phase 3 implements and tests the ordinal, and applies it when sorting
 * preference summaries for API responses — it does **not** wire into
 * resolveMarketingDirectorDecision or any recommendation scorer.
 *
 * Highest to lowest:
 * 1. Legal / compliance (not modeled here — existing safety rails always win)
 * 2. Explicit customer preferences (this module)
 * 3. Current business goals (business_profiles.marketing_goals — external, authoritative)
 * 4. Strong historical learnings
 * 5. Developing / early learnings
 * 6. Generic best practices
 */

export const MemoryPrecedenceLayers = {
  LEGAL_COMPLIANCE: "legal_compliance",
  EXPLICIT_PREFERENCE: "explicit_preference",
  BUSINESS_GOALS: "business_goals",
  STRONG_LEARNING: "strong_learning",
  DEVELOPING_LEARNING: "developing_learning",
  GENERIC_BEST_PRACTICE: "generic_best_practice",
} as const;

export type MemoryPrecedenceLayer =
  (typeof MemoryPrecedenceLayers)[keyof typeof MemoryPrecedenceLayers];

/** Lower number = higher precedence. */
export const MEMORY_PRECEDENCE_RANK: Record<MemoryPrecedenceLayer, number> = {
  [MemoryPrecedenceLayers.LEGAL_COMPLIANCE]: 1,
  [MemoryPrecedenceLayers.EXPLICIT_PREFERENCE]: 2,
  [MemoryPrecedenceLayers.BUSINESS_GOALS]: 3,
  [MemoryPrecedenceLayers.STRONG_LEARNING]: 4,
  [MemoryPrecedenceLayers.DEVELOPING_LEARNING]: 5,
  [MemoryPrecedenceLayers.GENERIC_BEST_PRACTICE]: 6,
};

export function compareMemoryPrecedenceLayers(
  a: MemoryPrecedenceLayer,
  b: MemoryPrecedenceLayer
): number {
  return MEMORY_PRECEDENCE_RANK[a] - MEMORY_PRECEDENCE_RANK[b];
}

/**
 * Within the explicit-preference layer, active preferences outrank inactive history;
 * among actives, newer updated_at / created_at wins for stable presentation ordering.
 * Does not claim to beat business_profiles fields — those live in a separate layer.
 */
export function sortPreferenceSummariesForPrecedence(
  preferences: MarketingMemoryPreferenceSummary[]
): MarketingMemoryPreferenceSummary[] {
  return [...preferences].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    // Stable secondary: preference type then instruction text.
    const typeCmp = a.preferenceType.localeCompare(b.preferenceType);
    if (typeCmp !== 0) return typeCmp;
    return a.instructionText.localeCompare(b.instructionText);
  });
}

/**
 * Active context_category_toggle preferences with factor_value = disable.
 * Pure filter — callers in Phase 4 will use this to drop context types before ranking.
 * Phase 3 exposes it for settings/API honesty only; nothing in MD consumes it yet.
 */
export function listDisabledContextCategories(
  preferences: MarketingMemoryPreferenceSummary[]
): string[] {
  const disabled = new Set<string>();
  for (const preference of preferences) {
    if (
      preference.isActive &&
      preference.preferenceType === "context_category_toggle" &&
      preference.factorValue === "disable" &&
      preference.factorType
    ) {
      disabled.add(preference.factorType);
    }
  }
  return [...disabled].sort();
}
