import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentApproval } from "@/lib/content-approval/types";
import {
  buildRecommendationListItem,
  buildRecommendationsSummary,
  type MarketingRecommendationsPageData,
  type RecommendationListItem,
} from "@/lib/marketing-decisions/ui";
import { getActiveMarketingRecommendationsForUser } from "@/lib/marketing-decisions/persistence";
import { getMarketingOpportunitiesByIdsForUser } from "@/lib/marketing-opportunities/persistence";
import { createClient } from "@/lib/supabase/server";

async function getLinkedDraftsForRecommendations(
  supabase: SupabaseClient,
  userId: string,
  recommendationIds: string[]
): Promise<ContentApproval[]> {
  if (recommendationIds.length === 0) return [];

  const { data, error } = await supabase
    .from("content_approvals")
    .select("*")
    .eq("user_id", userId)
    .in("marketing_recommendation_id", recommendationIds)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ContentApproval[];
}

/**
 * Loads active (open / in_progress) marketing recommendations for one user, with
 * related opportunities and linked draft state for the UI. Always scoped by userId.
 */
export async function getMarketingRecommendationsPageDataForUser(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<MarketingRecommendationsPageData> {
  const supabase = supabaseClient ?? (await createClient());

  // Filtered to open/in_progress in SQL -- an active recommendation can never be
  // pushed out by historical dismissed/completed/superseded rows the way a
  // fetch-then-filter-in-JS approach could. Already ordered by priority_score desc,
  // created_at desc, so no further JS sort is needed.
  const active = await getActiveMarketingRecommendationsForUser(supabase, userId);

  const opportunityIds = [...new Set(active.flatMap((row) => row.related_opportunity_ids))];
  const opportunities = await getMarketingOpportunitiesByIdsForUser(
    supabase,
    userId,
    opportunityIds
  );
  const opportunitiesById = new Map(opportunities.map((row) => [row.id, row]));

  const linkedDrafts = await getLinkedDraftsForRecommendations(
    supabase,
    userId,
    active.map((row) => row.id)
  );

  const items: RecommendationListItem[] = active.map((recommendation) => {
    const relatedOpportunities = recommendation.related_opportunity_ids
      .map((id) => opportunitiesById.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const draftsForRecommendation = linkedDrafts.filter(
      (draft) => draft.marketing_recommendation_id === recommendation.id
    );
    const linkedDraft =
      draftsForRecommendation.find(
        (draft) =>
          draft.status === "pending" ||
          draft.status === "approved" ||
          draft.status === "published"
      ) ?? null;
    const hasRejectedDraft = draftsForRecommendation.some((draft) => draft.status === "rejected");

    return buildRecommendationListItem({
      recommendation,
      opportunities: relatedOpportunities,
      linkedDraft,
      hasRejectedDraft,
    });
  });

  return {
    items,
    summary: buildRecommendationsSummary(items),
  };
}

export async function getMarketingRecommendationsPageDataForCurrentUser(): Promise<MarketingRecommendationsPageData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return getMarketingRecommendationsPageDataForUser(user.id, supabase);
}
