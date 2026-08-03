import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAiMarketingProfileForUser } from "@/lib/ai-marketing-profile/persistence";
import type { BusinessProfile } from "@/lib/business-profile";
import { scoreCompetitorSignal } from "@/lib/competitor-observations/scoring";
import type {
  CompetitorObservation,
  CompetitorObservationConfidence,
} from "@/lib/competitor-observations/types";
import { CompetitorProvider } from "@/lib/market-context/providers/competitorProvider";
import type { MarketContextProviderContext } from "@/lib/market-context/types";
import { listMarketRadarEntriesForUser } from "@/lib/market-radar/persistence";
import { MarketRadarEntryKinds } from "@/lib/market-radar/types";

function mapRow(row: Record<string, unknown>): CompetitorObservation {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    businessProfileId: String(row.business_profile_id),
    marketRadarEntryId: String(row.market_radar_entry_id),
    summary: String(row.summary),
    confidence: row.confidence as CompetitorObservationConfidence,
    sourceLabel: String(row.source_label),
    occurredAt: (row.occurred_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listCompetitorObservationsForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<CompetitorObservation[]> {
  const { data, error } = await supabase
    .from("competitor_observations")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export type RecordCompetitorObservationInput = {
  marketRadarEntryId: string;
  summary: string;
  confidence: CompetitorObservationConfidence;
  sourceLabel: string;
  occurredAt?: string | null;
};

export async function recordCompetitorObservationForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  observation: RecordCompetitorObservationInput,
): Promise<CompetitorObservation | null> {
  const { data, error } = await supabase
    .from("competitor_observations")
    .insert({
      user_id: userId,
      business_profile_id: businessProfileId,
      market_radar_entry_id: observation.marketRadarEntryId,
      summary: observation.summary,
      confidence: observation.confidence,
      source_label: observation.sourceLabel,
      occurred_at: observation.occurredAt ?? null,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Two observations are the same recorded signal if they're about the same
 * tracked competitor and carry the same summary text — competitorProvider.ts's
 * profile-declared signal is deterministic per business-profile state, so a
 * re-run against unchanged profile data must not create a duplicate row. */
function dedupeKey(marketRadarEntryId: string, summary: string): string {
  return `${marketRadarEntryId}::${summary}`;
}

/**
 * Orchestration: lists the owner's tracked competitors (Task 001), pulls
 * current competitor signal from the existing lib/market-context provider
 * pipeline, runs each tracked-competitor/signal pair through
 * scoreCompetitorSignal, and persists the ones that qualify. Not live
 * monitoring — see lib/competitor-observations/scoring.ts and
 * docs/project-magic/MARKET_RADAR.md.
 */
export async function generateCompetitorObservationsForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<CompetitorObservation[]> {
  const trackedEntries = (
    await listMarketRadarEntriesForUser(supabase, userId, businessProfileId)
  ).filter((entry) => entry.kind === MarketRadarEntryKinds.COMPETITOR);

  if (trackedEntries.length === 0) return [];

  const { data: profileRow, error: profileError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("id", businessProfileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profileRow) return [];

  const aiMarketingProfile = await getAiMarketingProfileForUser(supabase, userId);

  const providerContext: MarketContextProviderContext = {
    businessProfile: profileRow as BusinessProfile,
    aiMarketingProfile,
    referenceDate: new Date(),
  };

  const signals = await new CompetitorProvider().fetchItems(providerContext);

  const existing = await listCompetitorObservationsForUser(supabase, userId, businessProfileId);
  const seenKeys = new Set(existing.map((o) => dedupeKey(o.marketRadarEntryId, o.summary)));

  const created: CompetitorObservation[] = [];

  for (const entry of trackedEntries) {
    for (const signal of signals) {
      const result = scoreCompetitorSignal(signal, entry);
      if (!result || !result.meaningful) continue;

      const key = dedupeKey(entry.id, result.summary);
      if (seenKeys.has(key)) continue;

      const recorded = await recordCompetitorObservationForUser(supabase, userId, businessProfileId, {
        marketRadarEntryId: entry.id,
        summary: result.summary,
        confidence: result.confidence,
        sourceLabel: signal.sourceName ?? "AJN Market Context (competitor)",
        occurredAt: signal.contextDate ?? null,
      });

      if (recorded) {
        created.push(recorded);
        seenKeys.add(key);
      }
    }
  }

  return created;
}
