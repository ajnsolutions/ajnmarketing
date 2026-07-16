import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { buildHeadOfMarketingBriefing } from "../lib/head-of-marketing/briefing.ts";
import { resolveMarketingHealthState } from "../lib/head-of-marketing/marketingHealth.ts";
import {
  HOM_ADVANCED_NAV_HREFS,
  HOM_PRIMARY_NAV_HREFS,
} from "../lib/head-of-marketing/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const emptyWins = {
  reviews: 0,
  views: 0,
  calls: 0,
  clicks: 0,
  posts: 0,
  tasksCompleted: 0,
};

const healthyScores = {
  overall: 72,
  seo: 70,
  google: 80,
  reviews: 70,
  content: 70,
  consistency: 70,
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for One Head of Marketing", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("Marketing Health maps risk signals without guilt language", () => {
  assert.equal(
    resolveMarketingHealthState({
      overallScore: 80,
      gbpConnected: false,
      pendingApprovals: 0,
      unansweredReviews: 0,
      publishFailures: 0,
      openRecommendations: 0,
    }),
    "at_risk",
  );

  assert.equal(
    resolveMarketingHealthState({
      overallScore: 72,
      gbpConnected: true,
      pendingApprovals: 2,
      unansweredReviews: 0,
      publishFailures: 0,
      openRecommendations: 0,
    }),
    "needs_attention",
  );

  assert.equal(
    resolveMarketingHealthState({
      overallScore: 88,
      gbpConnected: true,
      pendingApprovals: 0,
      unansweredReviews: 0,
      publishFailures: 0,
      openRecommendations: 0,
    }),
    "excellent",
  );
});

test("briefing unifies one primary CTA and Magic Moments", () => {
  const briefing = buildHeadOfMarketingBriefing({
    userName: "Sean Carter",
    businessName: "Acme Plumbing",
    websiteUrl: "https://acme.example",
    voiceNotes: "",
    profileCreatedAt: "2026-06-01T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 3,
    openRecommendations: 1,
    publishFailures: 0,
    publishingReadyOrScheduled: 2,
    businessHealth: healthyScores,
    weeklyWins: { ...emptyWins, posts: 2, views: 120 },
    planSummary: "Focus on local trust this month.",
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    now: new Date("2026-07-16T09:00:00"),
  });

  assert.match(briefing.greeting, /Sean/);
  assert.equal(briefing.experienceTitle, "Weekly Briefing");
  assert.equal(briefing.primaryAction.kind, "approve_weekly_package");
  assert.equal(briefing.primaryAction.label, "Review This Week");
  assert.ok(briefing.thisWeek.some((line) => /Published/i.test(line)));
  assert.ok(briefing.recommendation?.expectedBenefit);
  assert.ok(briefing.estimatedReviewMinutes >= 2);
  assert.equal(briefing.cadence.activeCadence, "weekly");
  assert.ok(briefing.journal.entries.length > 0);
});

test("clear briefing celebrates instead of shaming", () => {
  const briefing = buildHeadOfMarketingBriefing({
    userName: "Sean",
    businessName: "Acme",
    websiteUrl: "https://acme.example",
    voiceNotes: "",
    profileCreatedAt: "2026-07-01T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 0,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 0,
    businessHealth: { ...healthyScores, overall: 90 },
    weeklyWins: emptyWins,
    planSummary: null,
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    now: new Date("2026-07-16T15:00:00"),
  });

  assert.equal(briefing.primaryAction.kind, "none");
  assert.match(briefing.magicMoment ?? "", /enjoy your week|under control|let you know/i);
  assert.equal(briefing.timeRespectLabel, "Nothing to review");
  assert.equal(briefing.health.state, "excellent");
  assert.ok(briefing.journal.closing);
});

test("primary nav excludes competing decision centers", () => {
  assert.ok((HOM_PRIMARY_NAV_HREFS as readonly string[]).includes("/dashboard"));
  assert.ok((HOM_PRIMARY_NAV_HREFS as readonly string[]).includes("/dashboard/approvals"));
  assert.equal(
    (HOM_PRIMARY_NAV_HREFS as readonly string[]).includes("/dashboard/tasks"),
    false,
  );
  assert.equal(
    (HOM_PRIMARY_NAV_HREFS as readonly string[]).includes("/dashboard/marketing-plan"),
    false,
  );
  assert.equal(
    (HOM_PRIMARY_NAV_HREFS as readonly string[]).includes(
      "/dashboard/marketing-recommendations",
    ),
    false,
  );
  assert.ok(
    (HOM_ADVANCED_NAV_HREFS as readonly string[]).includes("/dashboard/command-center"),
  );
});

test("One Head of Marketing docs and UI ship expected copy", () => {
  const doc = readFileSync(join(root, "docs/ONE_HEAD_OF_MARKETING.md"), "utf8");
  assert.match(doc, /Unified decision layer/);
  assert.match(doc, /Progressive disclosure/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const page = readFileSync(
    join(root, "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  assert.match(page, /Your Head of Marketing/);
  assert.match(page, /Weekly Briefing/);
  assert.match(page, /primaryAction\.label/);
  assert.match(page, /More tools/);

  const service = readFileSync(join(root, "lib/head-of-marketing/service.ts"), "utf8");
  assert.match(service, /loadCommandCenterContextForCurrentUser/);
  assert.match(service, /buildWeeklyBriefing/);
  assert.equal(service.includes("runMarketingDecisionEngine"), false);
  assert.equal(service.includes("generateCommandCenterInsights"), false);
});
