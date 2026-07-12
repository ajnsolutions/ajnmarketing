import test from "node:test";
import assert from "node:assert/strict";
import { detectMissingGbpPosts } from "../lib/marketing-opportunities/detectors/missingGbpPosts.ts";
import { detectLowReviewActivity } from "../lib/marketing-opportunities/detectors/lowReviewActivity.ts";
import { detectSeasonalOpportunity } from "../lib/marketing-opportunities/detectors/seasonal.ts";
import { detectHolidayOpportunities } from "../lib/marketing-opportunities/detectors/holiday.ts";
import { detectWeatherOpportunity } from "../lib/marketing-opportunities/detectors/weather.ts";
import { detectLocalEventOpportunities } from "../lib/marketing-opportunities/detectors/localEvent.ts";
import { detectDecliningEngagement } from "../lib/marketing-opportunities/detectors/decliningEngagement.ts";
import { detectMissingBusinessInfo } from "../lib/marketing-opportunities/detectors/missingBusinessInfo.ts";
import { detectMissingPhotos } from "../lib/marketing-opportunities/detectors/missingPhotos.ts";
import { detectStaleWebsiteContent } from "../lib/marketing-opportunities/detectors/staleWebsiteContent.ts";
import type { GoogleBusinessDashboardData } from "../lib/google-business/types.ts";
import type { BusinessProfile } from "../lib/business-profile.ts";
import type { MarketContextItem } from "../lib/market-context/types.ts";
import type { AnalyticsSnapshot } from "../lib/analytics/analyticsTypes.ts";
import type { WebsiteAnalysis } from "../lib/website-analysis/types.ts";

const NOW = new Date("2026-07-11T12:00:00.000Z");

function baseGbpData(overrides: Partial<GoogleBusinessDashboardData> = {}): GoogleBusinessDashboardData {
  return {
    connected: true,
    setupRequired: false,
    connectionStatus: "Connected",
    lastSyncedAt: null,
    latestSync: null,
    location: null,
    reviewSummary: { averageRating: null, reviewCount: 0, newReviewsThisMonth: 0, unansweredCount: 0 },
    recentReviews: [],
    unansweredReviews: [],
    posts: { published: [], scheduled: [], draft: [] },
    insights: {
      searchViews: 0,
      mapsViews: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
      monthlyTrends: [],
    },
    syncHistory: [],
    ...overrides,
  } as GoogleBusinessDashboardData;
}

function baseBusinessProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  return {
    id: "biz-1",
    user_id: "user-1",
    business_name: "Test Business",
    industry: "plumbing",
    website: "https://example.com",
    phone: "555-1234",
    city: "Springfield",
    state: "IL",
    primary_service_area: null,
    nearby_cities: null,
    primary_services: "Drain cleaning",
    emergency_services: null,
    seasonal_services: null,
    specialty_services: null,
    competitors: null,
    marketing_goals: null,
    brand_voice_tone: null,
    preferred_words: null,
    avoid_words: null,
    voice_notes: null,
    onboarding_completed: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// --- missingGbpPosts ---

test("detectMissingGbpPosts: no opportunity when not connected", () => {
  const result = detectMissingGbpPosts(baseGbpData({ connected: false }), NOW);
  assert.deepEqual(result, []);
});

test("detectMissingGbpPosts: fires with high severity when zero posts ever published", () => {
  const [opp] = detectMissingGbpPosts(baseGbpData(), NOW);
  assert.equal(opp.category, "missing_gbp_posts");
  assert.equal(opp.severity, "high");
  assert.equal(opp.dedupeKey, "current");
});

test("detectMissingGbpPosts: fires with medium severity when last post is 30+ days old", () => {
  const gbpData = baseGbpData({
    posts: {
      published: [{ publish_time: "2026-06-01T00:00:00.000Z" } as never],
      scheduled: [],
      draft: [],
    },
  });
  const [opp] = detectMissingGbpPosts(gbpData, NOW);
  assert.equal(opp.severity, "medium");
});

test("detectMissingGbpPosts: no opportunity when a recent post exists", () => {
  const gbpData = baseGbpData({
    posts: { published: [{ publish_time: "2026-07-05T00:00:00.000Z" } as never], scheduled: [], draft: [] },
  });
  assert.deepEqual(detectMissingGbpPosts(gbpData, NOW), []);
});

// --- lowReviewActivity ---

test("detectLowReviewActivity: no opportunity when not connected", () => {
  assert.deepEqual(detectLowReviewActivity(baseGbpData({ connected: false })), []);
});

test("detectLowReviewActivity: high severity when zero reviews ever", () => {
  const [opp] = detectLowReviewActivity(baseGbpData());
  assert.equal(opp.severity, "high");
});

test("detectLowReviewActivity: medium severity when reviews exist but none this month", () => {
  const gbpData = baseGbpData({
    reviewSummary: { averageRating: 4.5, reviewCount: 12, newReviewsThisMonth: 0, unansweredCount: 0 },
  });
  const [opp] = detectLowReviewActivity(gbpData);
  assert.equal(opp.severity, "medium");
});

test("detectLowReviewActivity: no opportunity when there are new reviews this month", () => {
  const gbpData = baseGbpData({
    reviewSummary: { averageRating: 4.5, reviewCount: 12, newReviewsThisMonth: 2, unansweredCount: 0 },
  });
  assert.deepEqual(detectLowReviewActivity(gbpData), []);
});

// --- seasonal ---

test("detectSeasonalOpportunity: no opportunity when seasonal_services is empty", () => {
  assert.deepEqual(detectSeasonalOpportunity(baseBusinessProfile({ seasonal_services: null }), NOW), []);
  assert.deepEqual(detectSeasonalOpportunity(baseBusinessProfile({ seasonal_services: "  " }), NOW), []);
});

test("detectSeasonalOpportunity: fires for the current season with a season+year dedupe key", () => {
  const [opp] = detectSeasonalOpportunity(
    baseBusinessProfile({ seasonal_services: "Snow removal, gutter cleaning" }),
    NOW
  );
  assert.equal(opp.category, "seasonal");
  assert.equal(opp.dedupeKey, "summer-2026"); // July -> summer
  assert.ok(opp.expiresAt && new Date(opp.expiresAt) > NOW);
});

test("detectSeasonalOpportunity: winter season spans into the next calendar year for its expiry", () => {
  const winterNow = new Date("2026-12-15T00:00:00.000Z");
  const [opp] = detectSeasonalOpportunity(
    baseBusinessProfile({ seasonal_services: "Holiday lighting" }),
    winterNow
  );
  assert.equal(opp.dedupeKey, "winter-2026");
  assert.ok(opp.expiresAt && new Date(opp.expiresAt).getUTCFullYear() === 2027);
});

// --- holiday / weather / localEvent ---

function marketContextItem(overrides: Partial<MarketContextItem> = {}): MarketContextItem {
  return {
    id: "mci-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    category: "holiday",
    title: "Independence Day",
    summary: "US holiday",
    source_name: null,
    source_url: null,
    relevance_score: 80,
    confidence_score: 90,
    context_date: "2026-07-04",
    expires_at: "2026-07-20T00:00:00.000Z",
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

test("detectHolidayOpportunities: maps unexpired holiday items, uses item id as dedupeKey", () => {
  const items = [marketContextItem({ category: "holiday" })];
  const [opp] = detectHolidayOpportunities(items, NOW);
  assert.equal(opp.category, "holiday");
  assert.equal(opp.dedupeKey, "mci-1");
  assert.equal(opp.severity, "high"); // relevance_score 80 -> high
});

test("detectHolidayOpportunities: excludes expired items and wrong categories", () => {
  const expired = marketContextItem({ id: "mci-2", expires_at: "2026-01-01T00:00:00.000Z" });
  const wrongCategory = marketContextItem({ id: "mci-3", category: "weather" });
  assert.deepEqual(detectHolidayOpportunities([expired, wrongCategory], NOW), []);
});

test("detectWeatherOpportunity: maps only weather category items", () => {
  const items = [marketContextItem({ id: "mci-4", category: "weather", relevance_score: 30 })];
  const [opp] = detectWeatherOpportunity(items, NOW);
  assert.equal(opp.category, "weather");
  assert.equal(opp.severity, "low"); // relevance_score 30 -> low
});

test("detectLocalEventOpportunities: maps only local_event category items", () => {
  const items = [marketContextItem({ id: "mci-5", category: "local_event", relevance_score: 50 })];
  const [opp] = detectLocalEventOpportunities(items, NOW);
  assert.equal(opp.category, "local_event");
  assert.equal(opp.severity, "medium");
});

// --- decliningEngagement ---

function snapshot(overrides: Partial<AnalyticsSnapshot> = {}): AnalyticsSnapshot {
  return {
    id: "snap-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    snapshot_date: "2026-07-11",
    google_views: 100,
    searches: 50,
    calls: 5,
    direction_requests: 2,
    website_clicks: 10,
    review_count: 12,
    average_rating: 4.5,
    posts_published: 3,
    engagement_score: 50,
    metadata: {},
    created_at: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

test("detectDecliningEngagement: no opportunity with fewer than two snapshots", () => {
  assert.deepEqual(detectDecliningEngagement([]), []);
  assert.deepEqual(detectDecliningEngagement([snapshot()]), []);
});

test("detectDecliningEngagement: no opportunity when engagement is flat or improving", () => {
  const latest = snapshot({ engagement_score: 60 });
  const previous = snapshot({ snapshot_date: "2026-07-10", engagement_score: 50 });
  assert.deepEqual(detectDecliningEngagement([latest, previous]), []);
});

test("detectDecliningEngagement: fires with severity scaled to percent decline", () => {
  const latest = snapshot({ engagement_score: 60 });
  const previous = snapshot({ snapshot_date: "2026-07-10", engagement_score: 100 });
  const [opp] = detectDecliningEngagement([latest, previous]);
  assert.equal(opp.category, "declining_engagement");
  assert.equal(opp.severity, "critical"); // 40% decline
  assert.equal(opp.dedupeKey, "2026-07-11");
});

// --- missingBusinessInfo ---

test("detectMissingBusinessInfo: no opportunity when all required fields are present", () => {
  assert.deepEqual(detectMissingBusinessInfo(baseBusinessProfile()), []);
});

test("detectMissingBusinessInfo: lists every missing field and scales severity", () => {
  const profile = baseBusinessProfile({ website: null, phone: "", city: null });
  const [opp] = detectMissingBusinessInfo(profile);
  assert.equal(opp.severity, "high"); // 3 missing fields
  assert.deepEqual(opp.evidence.missingFields, ["website", "phone number", "city"]);
});

// --- missingPhotos ---

test("detectMissingPhotos: no opportunity when not connected or no location", () => {
  assert.deepEqual(detectMissingPhotos(baseGbpData({ connected: false })), []);
  assert.deepEqual(detectMissingPhotos(baseGbpData({ location: null })), []);
});

test("detectMissingPhotos: no opportunity when profile_metadata has no known photo signal (current real-world case)", () => {
  const gbpData = baseGbpData({
    location: { profile_metadata: { hasPendingEdits: false } } as never,
  });
  assert.deepEqual(detectMissingPhotos(gbpData), []);
});

test("detectMissingPhotos: fires when a photo count signal is present and low", () => {
  const gbpData = baseGbpData({
    location: { profile_metadata: { photoCount: 1 } } as never,
  });
  const [opp] = detectMissingPhotos(gbpData);
  assert.equal(opp.severity, "medium");
  assert.equal(opp.evidence.photoCount, 1);
});

// --- staleWebsiteContent ---

function websiteAnalysis(overrides: Partial<WebsiteAnalysis> = {}): WebsiteAnalysis {
  return {
    id: "wa-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    website: "https://example.com",
    analysis_status: "completed",
    analysis_score: 80,
    brand_voice: null,
    tone: null,
    keywords: [],
    services: [],
    cities: [],
    seo_score: 70,
    seo_findings: [],
    raw_summary: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("detectStaleWebsiteContent: no opportunity when there is no analysis or it's incomplete", () => {
  assert.deepEqual(detectStaleWebsiteContent(null, NOW), []);
  assert.deepEqual(detectStaleWebsiteContent(websiteAnalysis({ analysis_status: "pending" }), NOW), []);
});

test("detectStaleWebsiteContent: no opportunity when analysis is recent", () => {
  const recent = websiteAnalysis({ updated_at: "2026-07-01T00:00:00.000Z" });
  assert.deepEqual(detectStaleWebsiteContent(recent, NOW), []);
});

test("detectStaleWebsiteContent: fires when analysis is 90+ days old", () => {
  const stale = websiteAnalysis({ updated_at: "2026-01-01T00:00:00.000Z" });
  const [opp] = detectStaleWebsiteContent(stale, NOW);
  assert.equal(opp.category, "stale_website_content");
  assert.equal(opp.severity, "high"); // > 180 days
});
