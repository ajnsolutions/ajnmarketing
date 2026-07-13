import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketContextBrief,
  MarketContextBriefStatus,
  MarketContextBriefWithItems,
  MarketContextItem,
  ScoredMarketContextItem,
} from "@/lib/market-context/types";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function mapBriefRow(row: Record<string, unknown>): MarketContextBrief {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    brief_start_date: String(row.brief_start_date),
    brief_end_date: String(row.brief_end_date),
    overall_summary: String(row.overall_summary ?? ""),
    recommended_topics: parseStringArray(row.recommended_topics),
    high_opportunity_keywords: parseStringArray(row.high_opportunity_keywords),
    content_angles: parseStringArray(row.content_angles),
    selected_context_item_ids: parseStringArray(row.selected_context_item_ids),
    status: row.status as MarketContextBriefStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapItemRow(row: Record<string, unknown>): MarketContextItem {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    business_profile_id: String(row.business_profile_id),
    category: row.category as MarketContextItem["category"],
    title: String(row.title),
    summary: String(row.summary ?? ""),
    source_name: row.source_name ? String(row.source_name) : null,
    source_url: row.source_url ? String(row.source_url) : null,
    relevance_score: Number(row.relevance_score ?? 0),
    confidence_score: Number(row.confidence_score ?? 0),
    context_date: String(row.context_date),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function formatMarketContextWeekLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function formatMarketContextDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function formatMarketContextStatus(status: MarketContextBriefStatus | null | undefined): string {
  switch (status) {
    case "active":
      return "Active";
    case "generating":
      return "Generating";
    case "failed":
      return "Failed";
    default:
      return "Not Generated";
  }
}

export function formatMarketContextCategory(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getLatestMarketContextBriefForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<MarketContextBrief | null> {
  const { data, error } = await supabase
    .from("market_context_briefs")
    .select("*")
    .eq("user_id", userId)
    .order("brief_start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapBriefRow(data as Record<string, unknown>);
}

export async function getMarketContextItemsByIds(
  supabase: SupabaseClient,
  userId: string,
  itemIds: string[]
): Promise<MarketContextItem[]> {
  if (itemIds.length === 0) return [];

  const { data, error } = await supabase
    .from("market_context_items")
    .select("*")
    .eq("user_id", userId)
    .in("id", itemIds)
    .order("relevance_score", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapItemRow(row as Record<string, unknown>));
}

export async function getLatestMarketContextBriefWithItemsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<MarketContextBriefWithItems | null> {
  const brief = await getLatestMarketContextBriefForUser(supabase, userId);
  if (!brief) return null;

  const items = await getMarketContextItemsByIds(
    supabase,
    userId,
    brief.selected_context_item_ids
  );

  return { brief, items };
}

async function getMarketContextBriefForUserWeek(
  supabase: SupabaseClient,
  userId: string,
  briefStartDate: string,
  briefEndDate: string
): Promise<MarketContextBrief | null> {
  const { data, error } = await supabase
    .from("market_context_briefs")
    .select("*")
    .eq("user_id", userId)
    .eq("brief_start_date", briefStartDate)
    .eq("brief_end_date", briefEndDate)
    .maybeSingle();

  if (error || !data) return null;
  return mapBriefRow(data as Record<string, unknown>);
}

export type UpsertMarketContextBriefGeneratingResult = {
  brief: MarketContextBrief | null;
  /** True when another generation for this user+week is already in flight. */
  alreadyGenerating: boolean;
};

/**
 * Claims (or reclaims) the single Market Context brief row for this user+week.
 * Enforced by unique index market_context_briefs_user_week_uidx.
 * If a row is already `generating`, does not overwrite it — returns alreadyGenerating.
 * Concurrent insert races resolve via 23505 → re-read.
 */
export async function upsertMarketContextBriefGenerating(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    briefStartDate: string;
    briefEndDate: string;
  }
): Promise<UpsertMarketContextBriefGeneratingResult> {
  const existing = await getMarketContextBriefForUserWeek(
    supabase,
    input.userId,
    input.briefStartDate,
    input.briefEndDate
  );

  if (existing?.status === "generating") {
    return { brief: null, alreadyGenerating: true };
  }

  const payload = {
    user_id: input.userId,
    business_profile_id: input.businessProfileId,
    brief_start_date: input.briefStartDate,
    brief_end_date: input.briefEndDate,
    overall_summary: "",
    recommended_topics: [],
    high_opportunity_keywords: [],
    content_angles: [],
    selected_context_item_ids: [],
    status: "generating" as const,
  };

  const { data, error } = await supabase
    .from("market_context_briefs")
    .upsert(payload, { onConflict: "user_id,brief_start_date,brief_end_date" })
    .select("*")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    // Unique-index race: another writer claimed the week first.
    if (code === "23505") {
      const raced = await getMarketContextBriefForUserWeek(
        supabase,
        input.userId,
        input.briefStartDate,
        input.briefEndDate
      );
      if (raced?.status === "generating") {
        return { brief: null, alreadyGenerating: true };
      }
      if (raced) {
        return { brief: raced, alreadyGenerating: false };
      }
    }
    return { brief: null, alreadyGenerating: false };
  }

  if (!data) return { brief: null, alreadyGenerating: false };
  return { brief: mapBriefRow(data as Record<string, unknown>), alreadyGenerating: false };
}

export async function saveMarketContextItems(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    items: ScoredMarketContextItem[];
  }
): Promise<MarketContextItem[]> {
  if (input.items.length === 0) return [];

  const rows = input.items.map((item) => ({
    user_id: input.userId,
    business_profile_id: input.businessProfileId,
    category: item.category,
    title: item.title,
    summary: item.summary,
    source_name: item.sourceName ?? null,
    source_url: item.sourceUrl ?? null,
    relevance_score: item.relevanceScore,
    confidence_score: item.confidenceScore,
    context_date: item.contextDate,
    expires_at: item.expiresAt ?? null,
    metadata: {
      ...(item.metadata ?? {}),
      scoreBreakdown: item.scoreBreakdown,
    },
  }));

  const { data, error } = await supabase.from("market_context_items").insert(rows).select("*");

  if (error || !data) return [];
  return data.map((row) => mapItemRow(row as Record<string, unknown>));
}

export async function saveMarketContextBriefResult(
  supabase: SupabaseClient,
  input: {
    briefId: string;
    userId: string;
    overallSummary: string;
    recommendedTopics: string[];
    highOpportunityKeywords: string[];
    contentAngles: string[];
    selectedContextItemIds: string[];
  }
): Promise<MarketContextBrief | null> {
  const { data, error } = await supabase
    .from("market_context_briefs")
    .update({
      overall_summary: input.overallSummary,
      recommended_topics: input.recommendedTopics,
      high_opportunity_keywords: input.highOpportunityKeywords,
      content_angles: input.contentAngles,
      selected_context_item_ids: input.selectedContextItemIds,
      status: "active",
    })
    .eq("id", input.briefId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapBriefRow(data as Record<string, unknown>);
}

export async function markMarketContextBriefFailed(
  supabase: SupabaseClient,
  briefId: string,
  userId: string
): Promise<void> {
  await supabase
    .from("market_context_briefs")
    .update({ status: "failed" })
    .eq("id", briefId)
    .eq("user_id", userId);
}
