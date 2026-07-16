import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";

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

const baseInput = {
  userName: "Sean Carter",
  businessName: "Acme Plumbing",
  websiteUrl: "https://acme.example",
  voiceNotes: "",
  profileCreatedAt: "2026-01-15T00:00:00.000Z",
  gbpConnected: true,
  unansweredReviews: 0,
  pendingApprovals: 0,
  openRecommendations: 0,
  publishFailures: 0,
  publishingReadyOrScheduled: 1,
  businessHealth: healthyScores,
  weeklyWins: { ...emptyWins, posts: 1, reviews: 2, views: 40 },
  planSummary: "Build local trust.",
  seasonalHint: "Back-to-school (August)",
  topPriorityTitle: null as string | null,
  upcomingCalendar: [
    {
      day: 20,
      dateLabel: "Mon, Jul 20",
      title: "Local tip post",
      channel: "gbp",
      contentType: "post",
      note: "",
    },
  ],
  competitorWatchMessage: null as string | null,
  now: new Date("2026-07-16T09:00:00"),
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Weekly Briefing", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("Weekly Briefing is a conversation structure with one CTA", () => {
  const briefing = buildWeeklyBriefing({
    ...baseInput,
    pendingApprovals: 2,
  });

  assert.equal(briefing.experienceTitle, "Weekly Briefing");
  assert.ok(briefing.thisWeek.length > 0);
  assert.ok(briefing.noticed.some((line) => /Seasonal|Review|Search|Community/i.test(line)));
  assert.ok(briefing.nextWeek.some((line) => /Jul 20|preparing|plan/i.test(line)));
  assert.equal(briefing.primaryAction.kind, "approve_weekly_package");
  assert.match(briefing.timeRespectLabel, /minutes/);
  assert.match(briefing.relationshipMemory ?? "", /2026|January|working together/i);
});

test("relationship memory never fabricates seasons without data", () => {
  const fresh = buildWeeklyBriefing({
    ...baseInput,
    profileCreatedAt: "2026-07-14T00:00:00.000Z",
    now: new Date("2026-07-16T09:00:00"),
  });
  assert.match(fresh.relationshipMemory ?? "", /first week/i);
  assert.equal(/last spring/i.test(fresh.relationshipMemory ?? ""), false);
});

test("clear week shows time respect and Magic Moment", () => {
  const briefing = buildWeeklyBriefing({
    ...baseInput,
    weeklyWins: emptyWins,
    publishingReadyOrScheduled: 0,
    planSummary: null,
    seasonalHint: null,
    upcomingCalendar: [],
    businessHealth: { ...healthyScores, overall: 90 },
  });

  assert.equal(briefing.primaryAction.kind, "none");
  assert.equal(briefing.timeRespectLabel, "Nothing to review");
  assert.match(briefing.magicMoment ?? "", /enjoy your week|under control|Nothing urgent/i);
});

test("cadence architecture supports future management styles", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  assert.equal(briefing.cadence.activeCadence, "weekly");
  assert.ok(briefing.cadence.supportedStyles.includes("hands_on"));
  assert.ok(briefing.cadence.supportedStyles.includes("trusted"));
});

test("Weekly Briefing docs and orchestration stay presentation-only", () => {
  const doc = readFileSync(join(root, "docs/WEEKLY_BRIEFING.md"), "utf8");
  assert.match(doc, /Customer psychology/);
  assert.match(doc, /Information hierarchy/);
  assert.match(doc, /management-style/i);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const weekly = readFileSync(join(root, "lib/head-of-marketing/weeklyBriefing.ts"), "utf8");
  assert.equal(weekly.includes("runMarketingDecisionEngine"), false);
  assert.equal(weekly.includes("generateWeeklyApprovalPackage"), false);
  assert.equal(weekly.includes("analyzePerformanceForUser"), false);

  const page = readFileSync(
    join(root, "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  assert.match(page, /Weekly Briefing/);
  assert.match(page, /This Week/);
  assert.match(page, /Next Week/);
  assert.match(page, /timeRespectLabel/);
});
