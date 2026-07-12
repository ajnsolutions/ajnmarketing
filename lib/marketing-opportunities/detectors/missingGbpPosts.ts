import type { GoogleBusinessDashboardData } from "@/lib/google-business/types";
import type { MarketingOpportunityDraft } from "@/lib/marketing-opportunities/types";
import { OpportunityCategories, OpportunitySeverities } from "@/lib/marketing-opportunities/types";

const STALE_POSTS_THRESHOLD_DAYS = 30;

/**
 * Fires when a connected Google Business Profile has never published a post, or hasn't
 * published one in over 30 days. Not connected -> no opportunity (nothing to detect).
 */
export function detectMissingGbpPosts(
  gbpData: GoogleBusinessDashboardData,
  now: Date = new Date()
): MarketingOpportunityDraft[] {
  if (!gbpData.connected) return [];

  const published = gbpData.posts.published;
  const mostRecent = published
    .map((post) => post.publish_time)
    .filter((time): time is string => Boolean(time))
    .sort()
    .at(-1);

  const daysSinceLastPost = mostRecent
    ? Math.floor((now.getTime() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isMissing =
    published.length === 0 || (daysSinceLastPost !== null && daysSinceLastPost >= STALE_POSTS_THRESHOLD_DAYS);

  if (!isMissing) return [];

  return [
    {
      category: OpportunityCategories.MISSING_GBP_POSTS,
      severity: published.length === 0 ? OpportunitySeverities.HIGH : OpportunitySeverities.MEDIUM,
      confidence: 85,
      title:
        published.length === 0
          ? "No Google Business posts published yet"
          : "Google Business posts have gone stale",
      description:
        published.length === 0
          ? "This business has never published a Google Business Profile post. Regular posts improve local search visibility and give customers a reason to check back."
          : `The most recent Google Business post was published ${daysSinceLastPost} days ago. Regular posting (at least monthly) keeps the profile active in local search.`,
      evidence: {
        publishedPostCount: published.length,
        daysSinceLastPost,
        mostRecentPublishTime: mostRecent ?? null,
      },
      recommendedAction: "Publish a new Google Business post highlighting a recent project, offer, or update.",
      // No natural time window -- stays open until a new post is published (future
      // detection runs would then find isMissing=false and stop redrawing evidence;
      // this branch doesn't auto-resolve the existing row, see persistence.ts docs).
      expiresAt: null,
      dedupeKey: "current",
    },
  ];
}
