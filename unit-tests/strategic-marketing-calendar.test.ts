import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { aggregateStrategicMarketingCalendar } from "../lib/strategic-marketing-calendar/calendar-aggregator.ts";
import {
  dedupeCalendarEvents,
  sortCalendarEvents,
} from "../lib/strategic-marketing-calendar/calendar-ordering.ts";
import {
  normalizeCampaignCards,
  normalizeExecutivePriorities,
  normalizeMarketContextItems,
  normalizePendingApprovals,
  normalizePublishingItems,
} from "../lib/strategic-marketing-calendar/calendar-normalizers.ts";
import { resolveCalendarRange } from "../lib/strategic-marketing-calendar/calendar-range.ts";
import {
  addDateKeyDays,
  allDayStartAt,
  resolveBusinessTimezone,
  zonedDateKey,
} from "../lib/strategic-marketing-calendar/calendar-timezone.ts";
import {
  DEFAULT_BUSINESS_TIMEZONE,
  StrategicCalendarCategories,
  StrategicCalendarViews,
  type StrategicMarketingCalendarEvent,
} from "../lib/strategic-marketing-calendar/calendar-types.ts";
import { buildCalendarPreview } from "../lib/strategic-marketing-calendar/calendar-presentation.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { CampaignStatuses, CampaignTypes } from "../lib/campaign-intelligence/campaign-types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-03-08T12:00:00.000Z"); // near US DST spring-forward window
const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };

function range(today = "2026-07-19") {
  return {
    businessProfileId: "biz-1",
    rangeStart: "2026-07-13",
    rangeEnd: "2026-07-19",
    timezone: "UTC",
    todayKey: today,
  };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Strategic Marketing Calendar", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("timezone falls back to UTC when business has no configured zone", () => {
  assert.equal(resolveBusinessTimezone(null), DEFAULT_BUSINESS_TIMEZONE);
  assert.equal(resolveBusinessTimezone("Not/AZone"), DEFAULT_BUSINESS_TIMEZONE);
  assert.equal(resolveBusinessTimezone("America/New_York"), "America/New_York");
});

test("range handling: day/week/month, invalid, excessive, start after end", () => {
  const day = resolveCalendarRange({ view: "day", anchor: "2026-07-19", now: NOW });
  assert.equal(day.ok, true);
  if (day.ok) {
    assert.equal(day.rangeStart, "2026-07-19");
    assert.equal(day.rangeEnd, "2026-07-19");
  }

  const week = resolveCalendarRange({ view: "week", anchor: "2026-07-19", now: NOW });
  assert.equal(week.ok, true);
  if (week.ok) {
    assert.equal(week.rangeStart, "2026-07-13");
    assert.equal(week.rangeEnd, "2026-07-19");
  }

  const month = resolveCalendarRange({ view: "month", anchor: "2026-07-19", now: NOW });
  assert.equal(month.ok, true);
  if (month.ok) {
    assert.equal(month.rangeStart, "2026-07-01");
    assert.equal(month.rangeEnd, "2026-07-31");
  }

  assert.equal(resolveCalendarRange({ start: "2026-07-20", end: "2026-07-19" }).ok, false);
  assert.equal(resolveCalendarRange({ start: "nope", end: "2026-07-19" }).ok, false);
  assert.equal(
    resolveCalendarRange({
      view: "month",
      start: "2026-01-01",
      end: "2026-06-30",
    }).ok,
    false,
  );
});

test("DST: all-day anchors stay on the intended calendar date", () => {
  // US spring-forward 2026-03-08 — noon UTC date keys remain stable.
  const key = "2026-03-08";
  assert.equal(allDayStartAt(key).slice(0, 10), key);
  assert.equal(zonedDateKey(allDayStartAt(key), "America/New_York"), key);
  assert.equal(zonedDateKey(allDayStartAt(key), "UTC"), key);
  assert.equal(addDateKeyDays(key, 1), "2026-03-09");
});

test("business timezone different from a typical browser local zone still keys correctly", () => {
  const iso = "2026-07-19T02:30:00.000Z";
  assert.equal(zonedDateKey(iso, "UTC"), "2026-07-19");
  assert.equal(zonedDateKey(iso, "America/Los_Angeles"), "2026-07-18");
  assert.equal(zonedDateKey(iso, "Asia/Tokyo"), "2026-07-19");
});

test("publishing normalization skips unscheduled items and maps statuses honestly", () => {
  const events = normalizePublishingItems(
    [
      {
        id: "p1",
        user_id: "u1",
        business_profile_id: "biz-1",
        content_approval_id: "a1",
        platform: "google_business_profile",
        title: "GBP post",
        content: "hi",
        status: "scheduled",
        scheduled_for: "2026-07-15T15:00:00.000Z",
        published_at: null,
        publish_error: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "p2",
        user_id: "u1",
        business_profile_id: "biz-1",
        content_approval_id: "a2",
        platform: "facebook",
        title: "Draft social",
        content: "hi",
        status: "ready",
        scheduled_for: null,
        published_at: null,
        publish_error: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
    range(),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.category, StrategicCalendarCategories.GOOGLE_BUSINESS);
  assert.equal(events[0]!.status, "scheduled");
  assert.equal(events[0]!.confidenceState, "confirmed");
  assert.equal(events[0]!.detailTarget, "/dashboard/publishing");
});

test("campaign and campaign-step normalization", () => {
  const events = normalizeCampaignCards(
    [
      {
        id: "c1",
        campaignType: CampaignTypes.HIRING,
        title: "Hiring",
        objective: "Hire",
        status: CampaignStatuses.IN_PROGRESS,
        nextMilestone: "Post",
        completionPercent: 30,
        recentProgress: [],
        timeline: [
          {
            key: "s1",
            label: "Publish hiring post",
            actionType: "publish_gbp_post",
            status: "scheduled",
            dayOffset: 0,
            scheduledFor: "2026-07-16",
            completedAt: null,
          },
          {
            key: "s2",
            label: "Undated step",
            actionType: "request_reviews",
            status: "pending",
            dayOffset: 1,
            scheduledFor: null,
            completedAt: null,
          },
        ],
      },
    ],
    range(),
  );
  assert.ok(events.some((event) => event.category === StrategicCalendarCategories.CAMPAIGN));
  assert.ok(events.some((event) => event.category === StrategicCalendarCategories.CAMPAIGN_STEP));
  assert.ok(!events.some((event) => event.title === "Undated step"));
});

test("approval normalization anchors pending items to today, never as scheduled publish", () => {
  const events = normalizePendingApprovals(
    [
      {
        id: "a1",
        user_id: "u1",
        business_profile_id: "biz-1",
        content_type: "gbp_post",
        title: "Needs opinion",
        content: "x",
        status: "pending",
        source: "recommendation",
        version: 1,
        ai_score: null,
        notes: null,
        marketing_recommendation_id: "rec-1",
        approved_at: null,
        approved_by: null,
        rejected_reason: null,
        rejection_reason_code: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
    range("2026-07-19"),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.status, "awaiting_approval");
  assert.equal(events[0]!.actionRequired, true);
  assert.match(events[0]!.summary, /not scheduled/i);
});

test("market context stays informational; news/competitor skipped", () => {
  const events = normalizeMarketContextItems(
    [
      {
        id: "m1",
        user_id: "u1",
        business_profile_id: "biz-1",
        category: "holiday",
        title: "Local holiday",
        summary: "Town holiday",
        source_name: null,
        source_url: null,
        relevance_score: 1,
        confidence_score: 1,
        context_date: "2026-07-18",
        expires_at: null,
        metadata: {},
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "m2",
        user_id: "u1",
        business_profile_id: "biz-1",
        category: "news",
        title: "Political news",
        summary: "should skip",
        source_name: null,
        source_url: null,
        relevance_score: 1,
        confidence_score: 1,
        context_date: "2026-07-18",
        expires_at: null,
        metadata: {},
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
    range(),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.confidenceState, "informational");
  assert.equal(events[0]!.metadata.informational, true);
});

test("executive priority normalization + MD wins dedupe over brief", () => {
  const briefing = buildWeeklyBriefing({
    userName: "Alex",
    businessName: "Demo",
    websiteUrl: null,
    voiceNotes: null,
    profileCreatedAt: "2026-01-01T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 1,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 0,
    businessHealth: {
      overall: 70,
      seo: 70,
      google: 70,
      reviews: 70,
      content: 70,
      consistency: 70,
    },
    weeklyWins: emptyWins,
    planSummary: null,
    marketingThemes: [],
    businessGoals: [],
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    now: NOW,
  });

  const priorities = normalizeExecutivePriorities({
    primaryAction: briefing.primaryAction,
    executiveBrief: {
      ...briefing.executiveBrief,
      today: [{ text: briefing.primaryAction.label }],
    },
    range: range(zonedDateKey(NOW, "UTC")),
  });

  const deduped = dedupeCalendarEvents(priorities);
  const titles = deduped
    .filter((event) => event.category === "executive_priority")
    .map((event) => event.title);
  assert.equal(new Set(titles).size, titles.length);
});

test("ordering: action-required before informational; identical inputs identical order", () => {
  const events: StrategicMarketingCalendarEvent[] = [
    {
      id: "i1",
      businessProfileId: "biz-1",
      sourceType: "market_context",
      sourceId: "m1",
      category: "holiday",
      title: "Holiday",
      summary: "info",
      startAt: "2026-07-15T12:00:00.000Z",
      endAt: null,
      allDay: true,
      status: "informational",
      priority: "informational",
      confidenceState: "informational",
      actionRequired: false,
      detailTarget: "/dashboard/market-context",
      campaignId: null,
      recommendationId: null,
      metadata: {},
      timezone: "UTC",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "a1",
      businessProfileId: "biz-1",
      sourceType: "content_approval",
      sourceId: "ap1",
      category: "approval",
      title: "Approve",
      summary: "needs you",
      startAt: "2026-07-15T12:00:00.000Z",
      endAt: null,
      allDay: true,
      status: "awaiting_approval",
      priority: "approval",
      confidenceState: "recommended",
      actionRequired: true,
      detailTarget: "/dashboard/approvals",
      campaignId: null,
      recommendationId: null,
      metadata: {},
      timezone: "UTC",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ];
  const sorted = sortCalendarEvents(events);
  assert.equal(sorted[0]!.id, "a1");
  assert.deepEqual(sortCalendarEvents(events), sortCalendarEvents(events));
});

test("aggregator is deterministic and preview prioritizes action-required", () => {
  const briefing = buildWeeklyBriefing({
    userName: "Alex",
    businessName: "Demo",
    websiteUrl: null,
    voiceNotes: null,
    profileCreatedAt: "2026-01-01T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 0,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 0,
    businessHealth: {
      overall: 80,
      seo: 80,
      google: 80,
      reviews: 80,
      content: 80,
      consistency: 80,
    },
    weeklyWins: emptyWins,
    planSummary: null,
    marketingThemes: [],
    businessGoals: [],
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    now: new Date("2026-07-19T12:00:00.000Z"),
  });

  const sources = {
    briefing: { ...briefing, campaigns: [], calendarPreview: null },
    campaigns: [],
    publishing: [
      {
        id: "p1",
        user_id: "u1",
        business_profile_id: "biz-1",
        content_approval_id: "a1",
        platform: "google_business_profile" as const,
        title: "Scheduled GBP",
        content: "x",
        status: "scheduled" as const,
        scheduled_for: "2026-07-16T15:00:00.000Z",
        published_at: null,
        publish_error: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
    approvals: [],
    marketContextItems: [],
    pendingApprovalCount: 2,
    warnings: [],
  };

  // Place scheduled publish inside the upcoming 7-day preview window.
  sources.publishing[0]!.scheduled_for = "2026-07-20T15:00:00.000Z";

  const input = {
    businessProfileId: "biz-1",
    view: StrategicCalendarViews.WEEK,
    timezone: "UTC",
    rangeStart: "2026-07-19",
    rangeEnd: "2026-07-25",
    todayKey: "2026-07-19",
    sources,
    now: new Date("2026-07-19T12:00:00.000Z"),
  };

  assert.deepEqual(
    aggregateStrategicMarketingCalendar(input),
    aggregateStrategicMarketingCalendar(input),
  );

  const calendar = aggregateStrategicMarketingCalendar(input);
  const preview = buildCalendarPreview(calendar, "2026-07-19");
  assert.equal(preview.pendingApprovalCount, 2);
  assert.equal(preview.fullCalendarHref, "/dashboard/strategic-marketing-calendar");
  assert.ok(preview.nextEvents.some((event) => event.title === "Scheduled GBP"));
});

test("UI ships read-only calendar page + HoM preview without edit/drag controls", () => {
  const page = readFileSync(
    join(root, "components/dashboard/strategic-marketing-calendar-page.tsx"),
    "utf8",
  );
  assert.match(page, /Strategic Marketing Calendar/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /hom-focusable/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /Escape/);
  assert.doesNotMatch(page, /drag|reschedule|onDrop|quick-create|contentEditable/i);

  const preview = readFileSync(
    join(root, "components/dashboard/strategic-calendar-preview.tsx"),
    "utf8",
  );
  assert.match(preview, /Open full calendar/);
  assert.match(preview, /Pending approvals/);

  const hom = readFileSync(join(root, "components/dashboard/head-of-marketing-page.tsx"), "utf8");
  assert.match(hom, /StrategicCalendarPreviewSection/);
  assert.ok(
    hom.indexOf("<CampaignsSection") < hom.indexOf("<StrategicCalendarPreviewSection"),
  );
  assert.ok(
    hom.indexOf("<StrategicCalendarPreviewSection") < hom.indexOf("<AskHeadOfMarketingPanel"),
  );

  const api = readFileSync(
    join(root, "app/api/strategic-marketing-calendar/route.ts"),
    "utf8",
  );
  assert.match(api, /export async function GET/);
  assert.doesNotMatch(api, /export async function POST|PATCH|DELETE/);

  const gate = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(gate, /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/);

  const doc = readFileSync(join(root, "docs/STRATEGIC_MARKETING_CALENDAR.md"), "utf8");
  assert.match(doc, /source-of-truth|Source-of-truth/i);
  assert.match(doc, /read-only/i);
  assert.match(doc, /UTC/);
});

test("regression: calendar modules do not mutate campaigns/publishing/recommendations", () => {
  const agg = readFileSync(
    join(root, "lib/strategic-marketing-calendar/calendar-aggregator.ts"),
    "utf8",
  );
  const svc = readFileSync(
    join(root, "lib/strategic-marketing-calendar/calendar-service.ts"),
    "utf8",
  );
  const blob = `${agg}\n${svc}`;
  assert.doesNotMatch(blob, /initiateCampaign|completeCampaignStep|\.update\(|insertMarketing/);
  assert.doesNotMatch(blob, /openai|createRecommendation|schedules\.task/i);
});
