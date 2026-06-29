import "server-only";

import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  getGoogleBusinessProfileConnectionStatusForCurrentUser,
} from "@/lib/google-business-profile/service";
import { formatGbpConnectionStatus } from "@/lib/google-business-profile/persistence";
import {
  formatGoogleSyncDate,
  getGoogleBusinessInsightsForUser,
  getGoogleBusinessPostsForUser,
  getGoogleBusinessReviewById,
  getGoogleBusinessReviewsForUser,
  getGoogleBusinessSyncHistory,
  getLatestGoogleBusinessSyncLog,
  getPrimaryGoogleBusinessLocationForUser,
  getUnansweredGoogleBusinessReviews,
  markGoogleBusinessReviewResponded,
  updateGoogleBusinessReviewDraftReply,
} from "@/lib/google-business/persistence";
import { generateGoogleReviewReplyDraft } from "@/lib/google-business/review-reply";
import { runGoogleBusinessSyncForUser } from "@/lib/google-business/sync";
import type {
  GoogleBusinessDashboardData,
  GoogleBusinessHomeStats,
  GoogleBusinessInsightSummary,
  GoogleBusinessPost,
  GoogleBusinessPostsSummary,
  GoogleBusinessReviewReplyDraftResult,
  GoogleBusinessReviewSummary,
  GoogleBusinessSyncResult,
} from "@/lib/google-business/types";
import { getPublishingQueueForUser } from "@/lib/publishing-queue/persistence";
import { createClient } from "@/lib/supabase/server";

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildReviewSummary(reviews: Awaited<ReturnType<typeof getGoogleBusinessReviewsForUser>>, locationAverage: number | null, locationCount: number): GoogleBusinessReviewSummary {
  const monthStart = startOfMonth();
  const newReviewsThisMonth = reviews.filter(
    (review) => review.review_created_at && new Date(review.review_created_at) >= monthStart
  ).length;

  const unansweredCount = reviews.filter((review) =>
    ["unanswered", "draft"].includes(review.reply_status)
  ).length;

  const ratedReviews = reviews.filter((review) => review.rating > 0);
  const computedAverage =
    ratedReviews.length > 0
      ? Math.round(
          (ratedReviews.reduce((sum, review) => sum + review.rating, 0) / ratedReviews.length) * 100
        ) / 100
      : null;

  return {
    averageRating: locationAverage ?? computedAverage,
    reviewCount: locationCount || reviews.length,
    newReviewsThisMonth,
    unansweredCount,
  };
}

function buildInsightSummary(
  insightDays: Awaited<ReturnType<typeof getGoogleBusinessInsightsForUser>>
): GoogleBusinessInsightSummary {
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const currentMonthDays = insightDays.filter((day) => day.period_month === currentMonth);

  const totals = currentMonthDays.reduce(
    (acc, day) => ({
      searchViews: acc.searchViews + day.search_views,
      mapsViews: acc.mapsViews + day.maps_views,
      websiteClicks: acc.websiteClicks + day.website_clicks,
      phoneCalls: acc.phoneCalls + day.phone_calls,
      directionRequests: acc.directionRequests + day.direction_requests,
    }),
    {
      searchViews: 0,
      mapsViews: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    }
  );

  const monthlyMap = new Map<
    string,
    {
      searchViews: number;
      mapsViews: number;
      websiteClicks: number;
      phoneCalls: number;
      directionRequests: number;
    }
  >();

  for (const day of insightDays) {
    const existing = monthlyMap.get(day.period_month) ?? {
      searchViews: 0,
      mapsViews: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    };

    monthlyMap.set(day.period_month, {
      searchViews: existing.searchViews + day.search_views,
      mapsViews: existing.mapsViews + day.maps_views,
      websiteClicks: existing.websiteClicks + day.website_clicks,
      phoneCalls: existing.phoneCalls + day.phone_calls,
      directionRequests: existing.directionRequests + day.direction_requests,
    });
  }

  const monthlyTrends = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, values]) => ({ month, ...values }));

  const topPerformingMonths = [...monthlyMap.entries()]
    .map(([month, values]) => ({
      month,
      totalEngagement:
        values.searchViews +
        values.mapsViews +
        values.websiteClicks +
        values.phoneCalls +
        values.directionRequests,
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 3);

  const recentDays = [...insightDays]
    .sort((a, b) => a.metric_date.localeCompare(b.metric_date))
    .slice(-30);

  const growthCharts = {
    labels: recentDays.map((day) =>
      new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
        new Date(`${day.metric_date}T00:00:00`)
      )
    ),
    profileViews: recentDays.map((day) => day.search_views + day.maps_views),
    websiteClicks: recentDays.map((day) => day.website_clicks),
    phoneCalls: recentDays.map((day) => day.phone_calls),
  };

  return {
    ...totals,
    monthlyTrends,
    topPerformingMonths,
    growthCharts,
  };
}

async function buildLocalPublishingPosts(
  userId: string,
  businessProfileId: string
): Promise<GoogleBusinessPost[]> {
  const supabase = await createClient();
  const queue = await getPublishingQueueForUser(supabase, userId);

  return queue
    .filter((item) => item.platform === "google_business_profile")
    .map((item) => ({
      id: item.id,
      user_id: userId,
      business_profile_id: businessProfileId,
      location_id: null,
      google_post_id: null,
      post_type: "local",
      status: item.status === "scheduled" ? "scheduled" : item.status === "published" ? "published" : "draft",
      title: item.title,
      summary: item.content,
      call_to_action: null,
      media_json: [],
      publish_time: item.published_at,
      scheduled_time: item.scheduled_for,
      source: "local" as const,
      publishing_queue_id: item.id,
      content_approval_id: item.content_approval_id,
      raw_json: {},
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
}

function buildPostsSummary(
  googlePosts: GoogleBusinessPost[],
  localPosts: GoogleBusinessPost[]
): GoogleBusinessPostsSummary {
  const combined = [...localPosts, ...googlePosts];

  return {
    published: combined.filter((post) => post.status === "published"),
    scheduled: combined.filter((post) => post.status === "scheduled"),
    draft: combined.filter((post) => post.status === "draft" || post.status === "rejected"),
  };
}

const EMPTY_INSIGHTS: GoogleBusinessInsightSummary = {
  searchViews: 0,
  mapsViews: 0,
  websiteClicks: 0,
  phoneCalls: 0,
  directionRequests: 0,
  monthlyTrends: [],
  topPerformingMonths: [],
  growthCharts: { labels: [], profileViews: [], websiteClicks: [], phoneCalls: [] },
};

function buildEmptyDashboard(
  overrides: Partial<GoogleBusinessDashboardData>
): GoogleBusinessDashboardData {
  return {
    connected: false,
    setupRequired: false,
    connectionStatus: "Not Connected",
    lastSyncedAt: null,
    latestSync: null,
    location: null,
    reviewSummary: {
      averageRating: null,
      reviewCount: 0,
      newReviewsThisMonth: 0,
      unansweredCount: 0,
    },
    recentReviews: [],
    unansweredReviews: [],
    posts: { published: [], scheduled: [], draft: [] },
    insights: EMPTY_INSIGHTS,
    syncHistory: [],
    ...overrides,
  };
}

export async function getGoogleBusinessDashboardDataForCurrentUser(): Promise<GoogleBusinessDashboardData> {
  const connectionStatus = await getGoogleBusinessProfileConnectionStatusForCurrentUser();

  if (connectionStatus.setupRequired || !connectionStatus.connected) {
    return buildEmptyDashboard({
      connected: connectionStatus.connected,
      setupRequired: connectionStatus.setupRequired,
      setupMessage: connectionStatus.setupMessage,
      connectionStatus: formatGbpConnectionStatus(
        connectionStatus.connection?.connection_status ?? "not_connected"
      ),
      lastSyncedAt: connectionStatus.connection?.last_synced_at ?? null,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildEmptyDashboard({});
  }

  const profile = await getBusinessProfileForUser();
  const location = await getPrimaryGoogleBusinessLocationForUser(supabase, user.id);
  const reviews = await getGoogleBusinessReviewsForUser(supabase, user.id, 50);
  const unansweredReviews = await getUnansweredGoogleBusinessReviews(supabase, user.id);
  const googlePosts = await getGoogleBusinessPostsForUser(supabase, user.id);
  const insightDays = await getGoogleBusinessInsightsForUser(
    supabase,
    user.id,
    location?.id
  );
  const latestSync = await getLatestGoogleBusinessSyncLog(supabase, user.id);
  const syncHistory = await getGoogleBusinessSyncHistory(supabase, user.id, 10);
  const localPosts = profile
    ? await buildLocalPublishingPosts(user.id, profile.id)
    : [];

  return {
    connected: true,
    setupRequired: false,
    connectionStatus: formatGbpConnectionStatus(connectionStatus.connection?.connection_status),
    lastSyncedAt: connectionStatus.connection?.last_synced_at ?? null,
    latestSync,
    syncHistory,
    location,
    reviewSummary: buildReviewSummary(
      reviews,
      location?.average_rating ?? null,
      location?.review_count ?? 0
    ),
    recentReviews: reviews.slice(0, 6),
    unansweredReviews: unansweredReviews.slice(0, 6),
    posts: buildPostsSummary(googlePosts, localPosts),
    insights: buildInsightSummary(insightDays),
  };
}

export async function getGoogleBusinessHomeStatsForCurrentUser(): Promise<GoogleBusinessHomeStats> {
  const dashboard = await getGoogleBusinessDashboardDataForCurrentUser();

  return {
    connected: dashboard.connected,
    averageRating: dashboard.reviewSummary.averageRating,
    newReviewsThisMonth: dashboard.reviewSummary.newReviewsThisMonth,
    profileViews: dashboard.insights.searchViews + dashboard.insights.mapsViews,
    websiteClicks: dashboard.insights.websiteClicks,
    phoneCalls: dashboard.insights.phoneCalls,
    pendingReviewReplies: dashboard.reviewSummary.unansweredCount,
    recentReviews: dashboard.recentReviews.slice(0, 2),
  };
}

export async function syncGoogleBusinessForCurrentUser(): Promise<GoogleBusinessSyncResult> {
  const profile = await getBusinessProfileForUser();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, syncLog: null, error: "Unauthorized" };
  }

  if (!profile) {
    return { success: false, syncLog: null, error: "Business profile not found." };
  }

  return runGoogleBusinessSyncForUser({
    userId: user.id,
    businessProfileId: profile.id,
  });
}

export async function draftGoogleReviewReplyForUser(
  userId: string,
  reviewId: string
): Promise<GoogleBusinessReviewReplyDraftResult> {
  const supabase = await createClient();

  const review = await getGoogleBusinessReviewById(supabase, userId, reviewId);
  if (!review) {
    return { review: null, error: "Review not found." };
  }

  try {
    const draft = await generateGoogleReviewReplyDraft({ userId, review });
    const updated = await updateGoogleBusinessReviewDraftReply(
      supabase,
      userId,
      reviewId,
      draft
    );
    return { review: updated };
  } catch (error) {
    return {
      review: null,
      error: error instanceof Error ? error.message : "Unable to draft review reply",
    };
  }
}

export async function draftGoogleReviewReplyForCurrentUser(
  reviewId: string
): Promise<GoogleBusinessReviewReplyDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { review: null, error: "Unauthorized" };
  }

  return draftGoogleReviewReplyForUser(user.id, reviewId);
}

export async function markGoogleReviewRespondedForCurrentUser(
  reviewId: string
): Promise<GoogleBusinessReviewReplyDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { review: null, error: "Unauthorized" };
  }

  const updated = await markGoogleBusinessReviewResponded(supabase, user.id, reviewId);
  if (!updated) {
    return { review: null, error: "Review not found." };
  }

  return { review: updated };
}

export { formatGoogleSyncDate };
