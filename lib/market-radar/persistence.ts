import type { SupabaseClient } from "@supabase/supabase-js";

import { sortMarketRadarEntries } from "@/lib/market-radar/sort";
import type { MarketRadarEntry, MarketRadarEntryKind } from "@/lib/market-radar/types";

function mapRow(row: Record<string, unknown>): MarketRadarEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    businessProfileId: String(row.business_profile_id),
    kind: row.kind as MarketRadarEntryKind,
    name: String(row.name),
    priority: (row.priority as number | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listMarketRadarEntriesForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
): Promise<MarketRadarEntry[]> {
  const { data, error } = await supabase
    .from("market_radar_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("business_profile_id", businessProfileId);

  if (error || !data) return [];
  return sortMarketRadarEntries((data as Record<string, unknown>[]).map(mapRow));
}

export type AddMarketRadarEntryInput = {
  kind: MarketRadarEntryKind;
  name: string;
  notes?: string | null;
};

export async function addMarketRadarEntryForUser(
  supabase: SupabaseClient,
  userId: string,
  businessProfileId: string,
  input: AddMarketRadarEntryInput,
): Promise<MarketRadarEntry | null> {
  const { data, error } = await supabase
    .from("market_radar_entries")
    .insert({
      user_id: userId,
      business_profile_id: businessProfileId,
      kind: input.kind,
      name: input.name,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function removeMarketRadarEntryForUser(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("market_radar_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);

  return !error;
}

export async function setMarketRadarEntryPriorityForUser(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
  priority: number | null,
): Promise<MarketRadarEntry | null> {
  const { data, error } = await supabase
    .from("market_radar_entries")
    .update({ priority })
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}
