import "server-only";

import {
  getContentPerformanceForUser,
  getAnalyticsSnapshotsForUser,
  getLatestAnalyticsSnapshotForUser,
  getActiveRecommendationsForUser,
  replaceActiveRecommendations,
  updateRecommendationStatus,
  upsertAnalyticsSnapshot,
  upsertContentPerformanceRecord,
} from "@/lib/analytics/analyticsPersistence";
import {
  analyzePerformance,
  computeEngagementScore,
} from "@/lib/analytics/performanceAnalyzer";
import { detectTrends } from "@/lib/analytics/trendDetector";
import {
  generateRecommendations,
  recommendationToInsight,
} from "@/lib/analytics/recommendationEngine";
import {
  buildAnalyticsFeedback,
  formatAnalyticsFeedbackForPrompt,
} from "@/lib/analytics/feedbackLoop";
import type {
  AnalyticsFeedback,
  AnalyticsPageData,
  CaptureSnapshotResult,
} from "@/lib/analytics/analyticsTypes";
import { getGoogleBusinessDashboardDataForUser } from "@/lib/google-business/service";
import { getPublishingJobsForUser } from "@/lib/publishing/publishingHistory";
import { getPublishingQueueItemById } from "@/lib/publishing-queue/persistence";
import { getContentApprovalById } from "@/lib/content-approval/persistence";
import { recordPerformanceMeasuredOutcome } from "@/lib/recommendation-outcomes/service";
import { measurementWindowKey } from "@/lib/recommendation-outcomes/idempotency";
import { AuditActions, logAuditEvent } from "@/lib/audit-log-server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordObservationForAnalyticsSnapshot } from "@/lib/marketing-memory/service";
import { classifyError } from "@/lib/marketing-memory/metadata";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitCompetitors(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[\n,;|•]/).map((item) => item.trim()).filter(Boolean);
}

async function resolveBusinessProfileId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("business_profiles")
    .select("id, competitors")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.id ?? null;
}

function estimatePublishingSuccessRate(
  jobs: Awaited<ReturnType<typeof getPublishingJobsForUser>>
): number | null {
  const terminal = jobs.filter((job) =>
    ["published", "verified", "failed", "cancelled"].includes(job.status)
  );
  if (terminal.length === 0) return null;

  const successful = terminal.filter((job) =>
    ["published", "verified"].includes(job.status)
  ).length;

  return Math.round((successful / terminal.length) * 100);
}

async function syncContentPerformanceRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  businessProfileId: string,
  aggregateViews: number,
  aggregateClicks: number
): Promise<number> {
  const jobs = await getPublishingJobsForUser(supabase, userId);
  const publishedJobs = jobs
    .filter((job) => ["published", "verified"].includes(job.status))
    .slice(0, 12);

  if (publishedJobs.length === 0) return 0;

  const perPostViews = Math.round(aggregateViews / publishedJobs.length);
  const perPostClicks = Math.round(aggregateClicks / publishedJobs.length);
  let saved = 0;

  for (const job of publishedJobs) {
    const queueItem = await getPublishingQueueItemById(supabase, userId, job.content_id);
    if (!queueItem) continue;

    const title = queueItem.title;
    const keywordBoost = /local|season|review|offer|service/i.test(`${title} ${queueItem.content}`)
      ? 12
      : 0;
    const performanceScore = Math.min(
      100,
      Math.round(perPostViews * 0.35 + perPostClicks * 8 + keywordBoost + 20)
    );

    const record = await upsertContentPerformanceRecord(supabase, {
      content_id: job.content_id,
      publishing_job_id: job.id,
      provider: job.provider,
      published_at: job.published_at,
      views: perPostViews,
      clicks: perPostClicks,
      engagement: perPostViews + perPostClicks,
      conversions: perPostClicks,
      performance_score: performanceScore,
      metadata: {
        title,
        estimation: "aggregate_allocation",
        providerPostId: job.provider_post_id,
      },
    });

    if (record) {
      saved += 1;

      const approval = await getContentApprovalById(supabase, userId, queueItem.content_approval_id);
      if (approval?.marketing_recommendation_id) {
        await recordPerformanceMeasuredOutcome(supabase, {
          userId,
          businessProfileId,
          recommendationId: approval.marketing_recommendation_id,
          contentApprovalId: approval.id,
          publishingJobId: job.id,
          windowKey: measurementWindowKey(),
          metrics: {
            views: perPostViews,
            clicks: perPostClicks,
            engagement: perPostViews + perPostClicks,
            conversions: perPostClicks,
            performanceScore,
          },
        });
      }
    }
  }

  await logAuditEvent(supabase, {
    userId,
    businessProfileId,
    action: AuditActions.ANALYTICS_CONTENT_PERFORMANCE_CAPTURED,
    entityType: "analytics_content_performance",
    status: "success",
    metadata: { recordsSaved: saved },
  });

  return saved;
}

/**
 * Captures one analytics snapshot for a business. Accepts an optional injected Supabase
 * client — when omitted, defaults to the request-scoped cookie client exactly as before,
 * so every existing caller (queueAnalyticsCaptureForUser via the background job worker)
 * is unchanged. Pass a privileged client here to run this for any tenant from
 * scheduled/background execution with no cookies or authenticated browser session.
 * Every database access in this function, including the Google Business Profile data
 * fetch, is threaded through the same client — there is no internal fallback that
 * silently constructs its own request-scoped client.
 */
export async function captureSnapshotForUser(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<CaptureSnapshotResult> {
  const supabase = supabaseClient ?? (await createClient());
  const businessProfileId = await resolveBusinessProfileId(supabase, userId);

  if (!businessProfileId) {
    return { snapshot: null, contentPerformanceCount: 0 };
  }

  const [gbpData, publishingJobs] = await Promise.all([
    getGoogleBusinessDashboardDataForUser(userId, supabase),
    getPublishingJobsForUser(supabase, userId),
  ]);

  const googleViews = gbpData.insights.searchViews + gbpData.insights.mapsViews;
  const postsPublished =
    publishingJobs.filter((job) => ["published", "verified"].includes(job.status)).length +
    gbpData.posts.published.length;

  const engagementScore = computeEngagementScore({
    googleViews,
    websiteClicks: gbpData.insights.websiteClicks,
    phoneCalls: gbpData.insights.phoneCalls,
    directionRequests: gbpData.insights.directionRequests,
    reviewCount: gbpData.reviewSummary.reviewCount,
    averageRating: gbpData.reviewSummary.averageRating,
    postsPublished,
  });

  const snapshot = await upsertAnalyticsSnapshot(supabase, {
    user_id: userId,
    business_profile_id: businessProfileId,
    snapshot_date: todayIsoDate(),
    google_views: googleViews,
    searches: gbpData.insights.searchViews,
    calls: gbpData.insights.phoneCalls,
    direction_requests: gbpData.insights.directionRequests,
    website_clicks: gbpData.insights.websiteClicks,
    review_count: gbpData.reviewSummary.reviewCount,
    average_rating: gbpData.reviewSummary.averageRating,
    posts_published: postsPublished,
    engagement_score: engagementScore,
    metadata: {
      connected: gbpData.connected,
      publishingJobsTracked: publishingJobs.length,
      monthlyTrends: gbpData.insights.monthlyTrends.slice(0, 6),
    },
  });

  const contentPerformanceCount = snapshot
    ? await syncContentPerformanceRecords(
        supabase,
        userId,
        businessProfileId,
        googleViews,
        gbpData.insights.websiteClicks + gbpData.insights.phoneCalls
      )
    : 0;

  if (snapshot) {
    // Marketing Memory Phase 1: best-effort, non-blocking evidence recording. Never
    // allowed to affect this function's return value — a memory-recording failure must
    // never be mistaken for a failed analytics capture. See
    // docs/MARKETING_MEMORY_FOUNDATION.md.
    try {
      await recordObservationForAnalyticsSnapshot(supabase, snapshot);
    } catch (err) {
      console.error("[MarketingMemory]", {
        event: "ingestion_failed",
        businessProfileId,
        result: "error",
        errorClass: classifyError(err),
      });
    }
  }

  if (snapshot) {
    await logAuditEvent(supabase, {
      userId,
      businessProfileId,
      action: AuditActions.ANALYTICS_SNAPSHOT_CAPTURED,
      entityType: "analytics_snapshot",
      entityId: snapshot.id,
      status: "success",
      metadata: {
        engagementScore,
        googleViews,
        contentPerformanceCount,
      },
    });
  }

  return { snapshot, contentPerformanceCount };
}

/**
 * Accepts an optional injected client — defaults to the request-scoped cookie client
 * exactly as before, preserving current callers (generateRecommendationsForUser,
 * getAnalyticsFeedbackForUser) unchanged.
 */
export async function analyzePerformanceForUser(userId: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient ?? (await createClient());
  const [snapshots, contentPerformance, jobs] = await Promise.all([
    getAnalyticsSnapshotsForUser(supabase, userId, 8),
    getContentPerformanceForUser(supabase, userId),
    getPublishingJobsForUser(supabase, userId),
  ]);

  return analyzePerformance({
    latestSnapshot: snapshots[0] ?? null,
    previousSnapshot: snapshots[1] ?? null,
    contentPerformance,
    publishingSuccessRate: estimatePublishingSuccessRate(jobs),
  });
}

/** Same injectable-client contract as analyzePerformanceForUser above. */
export async function detectTrendsForUser(userId: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient ?? (await createClient());
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("competitors")
    .eq("user_id", userId)
    .maybeSingle();

  const [snapshots, contentPerformance, jobs] = await Promise.all([
    getAnalyticsSnapshotsForUser(supabase, userId, 8),
    getContentPerformanceForUser(supabase, userId),
    getPublishingJobsForUser(supabase, userId),
  ]);

  const recentPublished = jobs.filter((job) =>
    ["published", "verified"].includes(job.status)
  ).length;

  return detectTrends({
    snapshots,
    contentPerformance,
    competitorConfigured: splitCompetitors(profile?.competitors).length > 0,
    publishingFrequencyPerWeek: recentPublished > 0 ? Math.min(recentPublished, 7) : 0,
  });
}

/**
 * Generates and replaces active recommendations for a business. Accepts an optional
 * injected Supabase client, threaded through this function's own queries and through
 * analyzePerformanceForUser/detectTrendsForUser/getGoogleBusinessDashboardDataForUser —
 * every database access in this path uses the same client. When omitted, defaults to
 * the request-scoped cookie client exactly as before, so existing callers (the analytics
 * API route, runAnalyticsFeedbackLoopForUser) are unchanged. Recommendation logic and
 * output are unchanged — only how the underlying data is fetched.
 */
export async function generateRecommendationsForUser(userId: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient ?? (await createClient());
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id, competitors")
    .eq("user_id", userId)
    .maybeSingle();

  const businessProfileId = profile?.id;
  if (!businessProfileId) return [];

  const gbpData = await getGoogleBusinessDashboardDataForUser(userId, supabase);
  const [performance, trends] = await Promise.all([
    analyzePerformanceForUser(userId, supabase),
    detectTrendsForUser(userId, supabase),
  ]);

  const drafts = generateRecommendations({
    performance,
    trends,
    unansweredReviews: gbpData.reviewSummary.unansweredCount,
    competitorConfigured: splitCompetitors(profile.competitors).length > 0,
    postsPublished: performance?.contentWinners.length ?? 0,
  });

  const recommendations = await replaceActiveRecommendations(
    supabase,
    userId,
    drafts.map((draft) => ({
      businessProfileId,
      category: draft.category,
      priority: draft.priority,
      title: draft.title,
      description: draft.description,
      reason: draft.reason,
      confidence: draft.confidence,
      metadata: draft.metadata,
    }))
  );

  await logAuditEvent(supabase, {
    userId,
    businessProfileId,
    action: AuditActions.ANALYTICS_RECOMMENDATIONS_GENERATED,
    entityType: "ai_recommendation",
    status: "success",
    metadata: { count: recommendations.length },
  });

  return recommendations;
}

export async function applyFeedbackForUser(
  userId: string,
  recommendationId: string,
  status: "applied" | "dismissed"
) {
  const supabase = await createClient();
  const updated = await updateRecommendationStatus(supabase, userId, recommendationId, status);

  if (updated) {
    await logAuditEvent(supabase, {
      userId,
      businessProfileId: updated.business_profile_id,
      action:
        status === "applied"
          ? AuditActions.ANALYTICS_RECOMMENDATION_APPLIED
          : AuditActions.ANALYTICS_RECOMMENDATION_DISMISSED,
      entityType: "ai_recommendation",
      entityId: updated.id,
      status: "success",
    });
  }

  return updated;
}

export async function runAnalyticsFeedbackLoopForUser(userId: string): Promise<AnalyticsFeedback> {
  await captureSnapshotForUser(userId);
  await generateRecommendationsForUser(userId);
  return getAnalyticsFeedbackForUser(userId);
}

export async function getAnalyticsFeedbackForUser(userId: string): Promise<AnalyticsFeedback> {
  const supabase = await createClient();
  const [latestSnapshot, snapshots, recommendations, performanceAnalysis, trends] =
    await Promise.all([
      getLatestAnalyticsSnapshotForUser(supabase, userId),
      getAnalyticsSnapshotsForUser(supabase, userId, 8),
      getActiveRecommendationsForUser(supabase, userId),
      analyzePerformanceForUser(userId),
      detectTrendsForUser(userId),
    ]);

  return buildAnalyticsFeedback({
    latestSnapshot: latestSnapshot ?? snapshots[0] ?? null,
    performanceAnalysis,
    trends,
    recommendations,
  });
}

export async function getAnalyticsPageDataForUser(userId: string): Promise<AnalyticsPageData> {
  const supabase = await createClient();
  const feedback = await getAnalyticsFeedbackForUser(userId);
  const [snapshots, recommendations, contentPerformance] = await Promise.all([
    getAnalyticsSnapshotsForUser(supabase, userId, 12),
    getActiveRecommendationsForUser(supabase, userId, 12),
    getContentPerformanceForUser(supabase, userId, 12),
  ]);

  return {
    feedback: {
      ...feedback,
      topInsights:
        feedback.topInsights.length > 0
          ? feedback.topInsights
          : recommendations.slice(0, 3).map(recommendationToInsight),
    },
    snapshots,
    recommendations,
    contentPerformance,
  };
}

export async function getAnalyticsPageDataForCurrentUser(): Promise<AnalyticsPageData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getAnalyticsPageDataForUser(user.id);
}

export async function getAnalyticsFeedbackForCurrentUser(): Promise<AnalyticsFeedback | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getAnalyticsFeedbackForUser(user.id);
}

export { buildAnalyticsFeedback, formatAnalyticsFeedbackForPrompt };

export async function queueAnalyticsCaptureForUser(userId: string, businessProfileId: string) {
  const supabase = await createClient();
  const { enqueueBackgroundJob } = await import("@/lib/background-jobs/queue");
  const { scheduleBackgroundJobProcessing } = await import("@/lib/background-jobs/scheduler");
  const { BackgroundJobTypes } = await import("@/lib/background-jobs/types");

  const result = await enqueueBackgroundJob({
    userId,
    businessProfileId,
    jobType: BackgroundJobTypes.ANALYTICS_CAPTURE,
    priority: "normal",
    payload: { source: "analytics_engine" },
    force: true,
  });

  if (result.job && !result.duplicate) {
    scheduleBackgroundJobProcessing(result.job.id);
  }

  await logAuditEvent(supabase, {
    userId,
    businessProfileId,
    action: AuditActions.ANALYTICS_CAPTURE_QUEUED,
    entityType: "analytics_snapshot",
    status: "success",
    metadata: { backgroundJobId: result.job?.id ?? null },
  });
}
