import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GoogleBusinessInsightDay,
  GoogleBusinessLocation,
  GoogleBusinessPost,
  GoogleBusinessReview,
  GoogleBusinessSyncLog,
} from "@/lib/google-business/types";

export function formatGoogleSyncDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Not synced yet";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export async function getPrimaryGoogleBusinessLocationForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleBusinessLocation | null> {
  const { data, error } = await supabase
    .from("google_business_locations")
    .select("*")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessLocation;
}

export async function upsertGoogleBusinessLocation(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    connectionId: string;
    googleLocationId: string;
    googleAccountId: string;
    locationTitle: string | null;
    primaryCategory: string | null;
    phone: string | null;
    websiteUri: string | null;
    addressJson: Record<string, unknown>;
    profileMetadata: Record<string, unknown>;
    averageRating: number | null;
    reviewCount: number;
    verificationStatus: string | null;
    isPrimary: boolean;
  }
): Promise<GoogleBusinessLocation | null> {
  const { data, error } = await supabase
    .from("google_business_locations")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        connection_id: input.connectionId,
        google_location_id: input.googleLocationId,
        google_account_id: input.googleAccountId,
        location_title: input.locationTitle,
        primary_category: input.primaryCategory,
        phone: input.phone,
        website_uri: input.websiteUri,
        address_json: input.addressJson,
        profile_metadata: input.profileMetadata,
        average_rating: input.averageRating,
        review_count: input.reviewCount,
        verification_status: input.verificationStatus,
        is_primary: input.isPrimary,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,google_location_id" }
    )
    .select("*")
    .single();

  if (error || !data) return null;
  return data as GoogleBusinessLocation;
}

export async function upsertGoogleBusinessReview(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    locationId: string;
    googleReviewId: string;
    reviewerName: string | null;
    reviewerPhotoUrl: string | null;
    rating: number;
    comment: string | null;
    reviewReply: string | null;
    replyStatus: GoogleBusinessReview["reply_status"];
    googleReviewUrl: string | null;
    reviewCreatedAt: string | null;
    replyUpdatedAt: string | null;
    rawJson: Record<string, unknown>;
  }
): Promise<GoogleBusinessReview | null> {
  const { data: existing } = await supabase
    .from("google_business_reviews")
    .select("reply_status, ai_draft_reply")
    .eq("user_id", input.userId)
    .eq("google_review_id", input.googleReviewId)
    .maybeSingle();

  const preserveReplyStatus =
    existing?.reply_status === "marked_responded" ||
    existing?.reply_status === "draft";

  const { data, error } = await supabase
    .from("google_business_reviews")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        location_id: input.locationId,
        google_review_id: input.googleReviewId,
        reviewer_name: input.reviewerName,
        reviewer_photo_url: input.reviewerPhotoUrl,
        rating: input.rating,
        comment: input.comment,
        review_reply: input.reviewReply,
        reply_status: preserveReplyStatus
          ? existing!.reply_status
          : input.replyStatus,
        ai_draft_reply: existing?.ai_draft_reply ?? null,
        google_review_url: input.googleReviewUrl,
        review_created_at: input.reviewCreatedAt,
        reply_updated_at: input.replyUpdatedAt,
        raw_json: input.rawJson,
      },
      { onConflict: "user_id,google_review_id" }
    )
    .select("*")
    .single();

  if (error || !data) return null;
  return data as GoogleBusinessReview;
}

export async function upsertGoogleBusinessPost(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    locationId: string;
    googlePostId: string;
    postType: string;
    status: GoogleBusinessPost["status"];
    title: string | null;
    summary: string | null;
    callToAction: string | null;
    mediaJson: unknown[];
    publishTime: string | null;
    scheduledTime: string | null;
    rawJson: Record<string, unknown>;
    publishingQueueId?: string | null;
    contentApprovalId?: string | null;
    source?: GoogleBusinessPost["source"];
  }
): Promise<GoogleBusinessPost | null> {
  const { data, error } = await supabase
    .from("google_business_posts")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        location_id: input.locationId,
        google_post_id: input.googlePostId,
        post_type: input.postType,
        status: input.status,
        title: input.title,
        summary: input.summary,
        call_to_action: input.callToAction,
        media_json: input.mediaJson,
        publish_time: input.publishTime,
        scheduled_time: input.scheduledTime,
        source: input.source ?? "google",
        publishing_queue_id: input.publishingQueueId ?? null,
        content_approval_id: input.contentApprovalId ?? null,
        raw_json: input.rawJson,
      },
      { onConflict: "user_id,google_post_id" }
    )
    .select("*")
    .single();

  if (error || !data) return null;
  return data as GoogleBusinessPost;
}

export async function upsertGoogleBusinessInsightDay(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    locationId: string;
    metricDate: string;
    periodMonth: string;
    searchViews: number;
    mapsViews: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
    rawMetricsJson: Record<string, unknown>;
  }
): Promise<GoogleBusinessInsightDay | null> {
  const { data, error } = await supabase
    .from("google_business_insights")
    .upsert(
      {
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        location_id: input.locationId,
        metric_date: input.metricDate,
        period_month: input.periodMonth,
        search_views: input.searchViews,
        maps_views: input.mapsViews,
        website_clicks: input.websiteClicks,
        phone_calls: input.phoneCalls,
        direction_requests: input.directionRequests,
        raw_metrics_json: input.rawMetricsJson,
      },
      { onConflict: "location_id,metric_date" }
    )
    .select("*")
    .single();

  if (error || !data) return null;
  return data as GoogleBusinessInsightDay;
}

export async function getGoogleBusinessReviewsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<GoogleBusinessReview[]> {
  const { data, error } = await supabase
    .from("google_business_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("review_created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];
  return data as GoogleBusinessReview[];
}

export async function getUnansweredGoogleBusinessReviews(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleBusinessReview[]> {
  const { data, error } = await supabase
    .from("google_business_reviews")
    .select("*")
    .eq("user_id", userId)
    .in("reply_status", ["unanswered", "draft"])
    .order("review_created_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data as GoogleBusinessReview[];
}

export async function getGoogleBusinessPostsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleBusinessPost[]> {
  const { data, error } = await supabase
    .from("google_business_posts")
    .select("*")
    .eq("user_id", userId)
    .order("publish_time", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data as GoogleBusinessPost[];
}

export async function getGoogleBusinessInsightsForUser(
  supabase: SupabaseClient,
  userId: string,
  locationId?: string
): Promise<GoogleBusinessInsightDay[]> {
  let query = supabase
    .from("google_business_insights")
    .select("*")
    .eq("user_id", userId)
    .order("metric_date", { ascending: true });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as GoogleBusinessInsightDay[];
}

export async function createGoogleBusinessSyncLog(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessProfileId: string;
    connectionId: string;
  }
): Promise<GoogleBusinessSyncLog | null> {
  const { data, error } = await supabase
    .from("google_business_sync_log")
    .insert({
      user_id: input.userId,
      business_profile_id: input.businessProfileId,
      connection_id: input.connectionId,
      sync_status: "running",
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return data as GoogleBusinessSyncLog;
}

export async function completeGoogleBusinessSyncLog(
  supabase: SupabaseClient,
  syncLogId: string,
  input: {
    syncStatus: GoogleBusinessSyncLog["sync_status"];
    locationsSynced: number;
    reviewsSynced: number;
    postsSynced: number;
    insightsSynced: number;
    errorMessage?: string | null;
  }
): Promise<GoogleBusinessSyncLog | null> {
  const { data, error } = await supabase
    .from("google_business_sync_log")
    .update({
      sync_status: input.syncStatus,
      locations_synced: input.locationsSynced,
      reviews_synced: input.reviewsSynced,
      posts_synced: input.postsSynced,
      insights_synced: input.insightsSynced,
      error_message: input.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", syncLogId)
    .select("*")
    .single();

  if (error || !data) return null;
  return data as GoogleBusinessSyncLog;
}

export async function getGoogleBusinessSyncHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<GoogleBusinessSyncLog[]> {
  const { data, error } = await supabase
    .from("google_business_sync_log")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as GoogleBusinessSyncLog[];
}

export async function getLatestGoogleBusinessSyncLog(
  supabase: SupabaseClient,
  userId: string
): Promise<GoogleBusinessSyncLog | null> {
  const { data, error } = await supabase
    .from("google_business_sync_log")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessSyncLog;
}

export async function getGoogleBusinessReviewById(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string
): Promise<GoogleBusinessReview | null> {
  const { data, error } = await supabase
    .from("google_business_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("id", reviewId)
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessReview;
}

export async function updateGoogleBusinessReviewDraftReply(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  aiDraftReply: string
): Promise<GoogleBusinessReview | null> {
  const { data, error } = await supabase
    .from("google_business_reviews")
    .update({
      ai_draft_reply: aiDraftReply,
      reply_status: "draft",
    })
    .eq("user_id", userId)
    .eq("id", reviewId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessReview;
}

export async function markGoogleBusinessReviewResponded(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string
): Promise<GoogleBusinessReview | null> {
  const { data, error } = await supabase
    .from("google_business_reviews")
    .update({ reply_status: "marked_responded" })
    .eq("user_id", userId)
    .eq("id", reviewId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return data as GoogleBusinessReview;
}

export async function updateGoogleBusinessConnectionAfterSync(
  supabase: SupabaseClient,
  connectionId: string,
  input: {
    gbpAccountId: string;
    gbpLocationId: string;
    gbpLocationName: string;
  }
): Promise<void> {
  await supabase
    .from("google_business_profile_connections")
    .update({
      gbp_account_id: input.gbpAccountId,
      gbp_location_id: input.gbpLocationId,
      gbp_location_name: input.gbpLocationName,
      last_synced_at: new Date().toISOString(),
      connection_status: "connected",
    })
    .eq("id", connectionId);
}
