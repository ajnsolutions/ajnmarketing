/**
 * Competitor Observation Engine: evidence + confidence records scoring the
 * existing lib/market-context/providers/competitorProvider.ts signal against
 * an owner's tracked Market Radar competitors. Persistence and types only —
 * see lib/competitor-observations/scoring.ts for the pure "is this
 * meaningful" judgment and lib/competitor-observations/persistence.ts for
 * the tenant-scoped read/write functions. Deliberately not live monitoring;
 * see docs/project-magic/MARKET_RADAR.md.
 */

export const CompetitorObservationConfidences = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type CompetitorObservationConfidence =
  (typeof CompetitorObservationConfidences)[keyof typeof CompetitorObservationConfidences];

/** One row of public.competitor_observations, as read from the database. */
export type CompetitorObservation = {
  id: string;
  userId: string;
  businessProfileId: string;
  /** The tracked market_radar_entries row (kind: "competitor") this observation is about. */
  marketRadarEntryId: string;
  summary: string;
  confidence: CompetitorObservationConfidence;
  /** Human-readable provenance — what produced this observation (e.g. the signal's own source name). */
  sourceLabel: string;
  /** Not every signal has a specific event time (e.g. profile-declared data). */
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
};
