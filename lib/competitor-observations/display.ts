/**
 * Pure display logic for Business Pulse's "What Changed" section: joining a
 * persisted CompetitorObservation back to the tracked MarketRadarEntry it's
 * about (the observations table stores only the id, per
 * lib/competitor-observations/persistence.ts), and filtering the resulting
 * list by a minimum confidence bar. No I/O — safe to unit test directly.
 */

import type { CompetitorObservation, CompetitorObservationConfidence } from "@/lib/competitor-observations/types";
import type { MarketRadarEntry } from "@/lib/market-radar/types";

export type WhatChangedItem = CompetitorObservation & {
  /** The tracked competitor's own name, resolved from its MarketRadarEntry. */
  competitorName: string;
};

/**
 * Joins each observation to its tracked competitor's name. An observation
 * whose entry can no longer be found (e.g. the competitor was since removed
 * from Market Radar) is dropped rather than shown with a fabricated or
 * generic name — there's no honest label left to show for it.
 */
export function buildWhatChangedItems(
  observations: CompetitorObservation[],
  entries: MarketRadarEntry[],
): WhatChangedItem[] {
  const namesById = new Map(entries.map((entry) => [entry.id, entry.name]));
  const items: WhatChangedItem[] = [];
  for (const observation of observations) {
    const competitorName = namesById.get(observation.marketRadarEntryId);
    if (!competitorName) continue;
    items.push({ ...observation, competitorName });
  }
  return items;
}

export const ObservationConfidenceFilters = {
  ALL: "all",
  MEDIUM_AND_ABOVE: "medium_and_above",
  HIGH_ONLY: "high_only",
} as const;

export type ObservationConfidenceFilter =
  (typeof ObservationConfidenceFilters)[keyof typeof ObservationConfidenceFilters];

const CONFIDENCE_RANK: Record<CompetitorObservationConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/**
 * Narrows a list to a minimum confidence bar. Generic over anything carrying
 * a `confidence` field so it works on raw CompetitorObservation[] or the
 * joined WhatChangedItem[] alike.
 */
export function filterObservationsByConfidence<T extends { confidence: CompetitorObservationConfidence }>(
  items: T[],
  filter: ObservationConfidenceFilter,
): T[] {
  if (filter === ObservationConfidenceFilters.ALL) return items;
  const minRank = filter === ObservationConfidenceFilters.HIGH_ONLY ? CONFIDENCE_RANK.high : CONFIDENCE_RANK.medium;
  return items.filter((item) => CONFIDENCE_RANK[item.confidence] >= minRank);
}
