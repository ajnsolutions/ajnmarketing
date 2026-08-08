/**
 * Task 006 — Market Radar evidence for Marketing Director recommendations.
 * The last of Market Radar's four planned "How it surfaces" points
 * (docs/project-magic/MARKET_RADAR.md) — Weekly Briefing (Task 005) and
 * Business Pulse (Task 004) are already shipped; this is the recommendation
 * side. See docs/CLIENT_RECOMMENDATION_EXPERIENCE.md and
 * lib/recommendation-presentation/reasonTranslation.ts's own header comment,
 * which explicitly deferred a "competitor_activity_detected" reason because
 * "there is no competitor-detection opportunity type" at the time it was
 * written — Task 003 is that missing signal source, now real.
 *
 * Deliberately NOT wired through the OpportunityCategory vocabulary
 * (reasonTranslation.ts's existing mechanism): there is no product concept
 * anywhere in this codebase linking a specific recommendation to a specific
 * competitor, and inventing one here would mean generating new opportunity
 * types — a change to opportunity DETECTION, not evidence PRESENTATION, and
 * out of this task's explicit scope ("do not redesign Marketing Director").
 * Instead, this surfaces real, current, sufficiently-confident competitor
 * observations as general business-level competitive context alongside a
 * recommendation — always computed the same honest way, never claimed as
 * the specific cause of any one recommendation. This mirrors how the
 * existing supportingReasons already work: business context, not strict
 * per-recommendation causation.
 *
 * A dedicated field (not folded into the provenance-less ClientReason[]
 * list) because this evidence needs to stay traceable — carrying its own
 * source label and confidence — which ClientReason's flat { text } can't
 * hold. Same reasoning Task 005 used for ExecutiveMarketRadarHighlight
 * instead of reusing ExecutiveBriefItem.
 */

import type { CompetitorObservation } from "@/lib/competitor-observations/types";
import { confidenceLabelText, confidenceExplanation } from "@/lib/competitor-observations/confidenceLabels";
import { buildWhatChangedItems, filterObservationsByConfidence, ObservationConfidenceFilters } from "@/lib/competitor-observations/display";
import type { MarketRadarEntry } from "@/lib/market-radar/types";
import type { ClientCompetitorEvidence } from "@/lib/recommendation-presentation/types";

/**
 * How long a competitor observation stays eligible to inform a
 * recommendation. Reuses lib/marketing-memory/learningConfig.ts's
 * STRONG_PATTERN_MAX_RECENCY_DAYS (120) as precedent for "how many days
 * until a recency-based signal in this codebase is no longer current" —
 * not imported directly (that constant is scoped to a different evidence
 * type, Learning items), but the same number, deliberately, rather than
 * inventing an unrelated cutoff.
 */
export const STALE_OBSERVATION_MAX_AGE_DAYS = 120;

/** Caps how many competitor-evidence entries appear on one recommendation package — a handful of business-level context items, not a wall of every tracked competitor. */
const MAX_COMPETITOR_EVIDENCE = 2;

function isStale(observation: CompetitorObservation, now: Date): boolean {
  const referenceDate = observation.occurredAt ?? observation.createdAt;
  const ageMs = now.getTime() - new Date(referenceDate).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return ageDays > STALE_OBSERVATION_MAX_AGE_DAYS;
}

/** Defensive floor beyond the type system — an observation with no real summary or source has nothing honest to show. */
function isWellFormed(observation: CompetitorObservation): boolean {
  return observation.summary.trim().length > 0 && observation.sourceLabel.trim().length > 0;
}

/**
 * Builds the competitor-evidence list for one business's recommendation
 * packages. Pure — no I/O; `observations` and `entries` are already
 * tenant-scoped by the caller (listCompetitorObservationsForUser /
 * listMarketRadarEntriesForUser), but this still defensively re-filters by
 * businessProfileId (defense in depth, matching this repo's established
 * convention — see lib/opportunity-engine/persistence.ts and similar).
 *
 * Filtering, in order:
 * 1. Tenant isolation — drop anything not actually scoped to this business.
 * 2. Malformed — drop observations with no real summary/source.
 * 3. Relevance — reuses buildWhatChangedItems, which already drops an
 *    observation whose tracked competitor no longer exists in Market Radar
 *    (removed since the observation was recorded) rather than showing it
 *    with a fabricated or missing name.
 * 4. Stale — older than STALE_OBSERVATION_MAX_AGE_DAYS.
 * 5. Confidence — medium and above only (reuses
 *    ObservationConfidenceFilters.MEDIUM_AND_ABOVE), matching this
 *    codebase's existing bar for what's worth showing an owner.
 * 6. Duplicate — one entry per tracked competitor (marketRadarEntryId),
 *    keeping the most recent.
 * 7. Cap — top MAX_COMPETITOR_EVIDENCE by recency.
 *
 * Returns [] (never omitted) when nothing qualifies — the caller's existing
 * behavior is otherwise completely unchanged, per this task's own
 * requirement to preserve existing behavior when no useful evidence exists.
 */
export function buildCompetitorEvidence(
  observations: CompetitorObservation[],
  entries: MarketRadarEntry[],
  businessProfileId: string,
  now: Date = new Date()
): ClientCompetitorEvidence[] {
  const tenantScoped = observations.filter((o) => o.businessProfileId === businessProfileId);
  const wellFormed = tenantScoped.filter(isWellFormed);
  const relevant = buildWhatChangedItems(wellFormed, entries);
  const fresh = relevant.filter((o) => !isStale(o, now));
  const confident = filterObservationsByConfidence(fresh, ObservationConfidenceFilters.MEDIUM_AND_ABOVE);

  const mostRecentByCompetitor = new Map<string, (typeof confident)[number]>();
  for (const observation of confident) {
    const existing = mostRecentByCompetitor.get(observation.marketRadarEntryId);
    const observationDate = new Date(observation.occurredAt ?? observation.createdAt).getTime();
    const existingDate = existing ? new Date(existing.occurredAt ?? existing.createdAt).getTime() : -Infinity;
    if (!existing || observationDate > existingDate) {
      mostRecentByCompetitor.set(observation.marketRadarEntryId, observation);
    }
  }

  const deduped = [...mostRecentByCompetitor.values()].sort((a, b) => {
    const aDate = new Date(a.occurredAt ?? a.createdAt).getTime();
    const bDate = new Date(b.occurredAt ?? b.createdAt).getTime();
    return bDate - aDate;
  });

  return deduped.slice(0, MAX_COMPETITOR_EVIDENCE).map((observation) => ({
    observation: observation.summary,
    competitorName: observation.competitorName,
    confidenceLabel: confidenceLabelText(observation.confidence),
    confidenceExplanation: confidenceExplanation(observation.confidence),
    sourceLabel: observation.sourceLabel,
  }));
}
