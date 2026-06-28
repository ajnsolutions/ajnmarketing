export type GoogleBusinessPostStatus = "published" | "scheduled" | "draft" | "expired" | "rejected";

export type GoogleBusinessReviewReplyStatus =
  | "unanswered"
  | "draft"
  | "responded"
  | "marked_responded";

export type GoogleBusinessSyncStatus = "running" | "success" | "partial" | "failed";

export type GoogleBusinessLocation = {
  id: string;
  user_id: string;
  business_profile_id: string;
  connection_id: string;
  google_location_id: string;
  google_account_id: string;
  location_title: string | null;
  primary_category: string | null;
  phone: string | null;
  website_uri: string | null;
  address_json: Record<string, unknown>;
  profile_metadata: Record<string, unknown>;
  average_rating: number | null;
  review_count: number;
  verification_status: string | null;
  is_primary: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleBusinessPost = {
  id: string;
  user_id: string;
  business_profile_id: string;
  location_id: string | null;
  google_post_id: string | null;
  post_type: string;
  status: GoogleBusinessPostStatus;
  title: string | null;
  summary: string | null;
  call_to_action: string | null;
  media_json: unknown[];
  publish_time: string | null;
  scheduled_time: string | null;
  source: "google" | "local";
  publishing_queue_id: string | null;
  content_approval_id: string | null;
  raw_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GoogleBusinessReview = {
  id: string;
  user_id: string;
  business_profile_id: string;
  location_id: string | null;
  google_review_id: string;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  rating: number;
  comment: string | null;
  review_reply: string | null;
  reply_status: GoogleBusinessReviewReplyStatus;
  ai_draft_reply: string | null;
  google_review_url: string | null;
  review_created_at: string | null;
  reply_updated_at: string | null;
  raw_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GoogleBusinessInsightDay = {
  id: string;
  user_id: string;
  business_profile_id: string;
  location_id: string;
  metric_date: string;
  period_month: string;
  search_views: number;
  maps_views: number;
  website_clicks: number;
  phone_calls: number;
  direction_requests: number;
  raw_metrics_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GoogleBusinessSyncLog = {
  id: string;
  user_id: string;
  business_profile_id: string;
  connection_id: string | null;
  sync_status: GoogleBusinessSyncStatus;
  locations_synced: number;
  reviews_synced: number;
  posts_synced: number;
  insights_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type GoogleBusinessInsightSummary = {
  searchViews: number;
  mapsViews: number;
  websiteClicks: number;
  phoneCalls: number;
  directionRequests: number;
  monthlyTrends: Array<{
    month: string;
    searchViews: number;
    mapsViews: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  }>;
  topPerformingMonths: Array<{
    month: string;
    totalEngagement: number;
  }>;
  growthCharts: {
    labels: string[];
    profileViews: number[];
    websiteClicks: number[];
    phoneCalls: number[];
  };
};

export type GoogleBusinessReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  newReviewsThisMonth: number;
  unansweredCount: number;
};

export type GoogleBusinessPostsSummary = {
  published: GoogleBusinessPost[];
  scheduled: GoogleBusinessPost[];
  draft: GoogleBusinessPost[];
};

export type GoogleBusinessDashboardData = {
  connected: boolean;
  setupRequired: boolean;
  setupMessage?: string;
  connectionStatus: string;
  lastSyncedAt: string | null;
  latestSync: GoogleBusinessSyncLog | null;
  location: GoogleBusinessLocation | null;
  reviewSummary: GoogleBusinessReviewSummary;
  recentReviews: GoogleBusinessReview[];
  unansweredReviews: GoogleBusinessReview[];
  posts: GoogleBusinessPostsSummary;
  insights: GoogleBusinessInsightSummary;
  syncHistory: GoogleBusinessSyncLog[];
};

export type GoogleBusinessHomeStats = {
  connected: boolean;
  averageRating: number | null;
  newReviewsThisMonth: number;
  profileViews: number;
  websiteClicks: number;
  phoneCalls: number;
  pendingReviewReplies: number;
  recentReviews: GoogleBusinessReview[];
};

export type GoogleBusinessSyncResult = {
  success: boolean;
  syncLog: GoogleBusinessSyncLog | null;
  error?: string;
};

export type GoogleBusinessReviewReplyDraftResult = {
  review: GoogleBusinessReview | null;
  error?: string;
};

export type GoogleApiAccount = {
  name: string;
  accountName?: string;
  type?: string;
};

export type GoogleApiLocation = {
  name: string;
  title?: string;
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  storefrontAddress?: Record<string, unknown>;
  categories?: { primaryCategory?: { displayName?: string } };
  metadata?: Record<string, unknown>;
};

export type GoogleApiReview = {
  reviewId?: string;
  name?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating?: string;
  comment?: string;
  reviewReply?: { comment?: string; updateTime?: string };
  createTime?: string;
  updateTime?: string;
};

export type GoogleApiLocalPost = {
  name?: string;
  languageCode?: string;
  summary?: string;
  callToAction?: { actionType?: string; url?: string };
  state?: string;
  topicType?: string;
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
  media?: Array<{ googleUrl?: string; mediaFormat?: string }>;
};
