import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  PROACTIVE_FORBIDDEN_TERMS,
  buildProactivePresence,
} from "../lib/head-of-marketing/proactive.ts";
import { buildHeadOfMarketingJournal } from "../lib/head-of-marketing/journal.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { ACTIVITY_EVENT_LABELS } from "../lib/head-of-marketing/proactiveTypes.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const monthlyFocusStub = {
  title: "This Month's Focus" as const,
  intro: "Over the next month I'd like us to focus on:",
  priorities: [
    { label: "Improving local visibility" },
    { label: "Building more positive reviews" },
  ],
  reinforcement: "Everything I'm doing this month supports these priorities.",
  progressLine: "We're on track with what we're working toward this month.",
  successLooksLike: "What success looks like: steady progress.",
  magicMoment: "We're making steady progress.",
  horizon: {
    activeHorizon: "monthly" as const,
    supportedHorizons: ["monthly", "quarterly", "annual"] as Array<
      "monthly" | "quarterly" | "annual"
    >,
    note: "hook",
  },
  styles: {
    supportedStyles: ["hands_on", "weekly", "monthly", "trusted"] as Array<
      "hands_on" | "weekly" | "monthly" | "trusted"
    >,
    note: "hook",
  },
  sourcedFromPlan: true,
};

const emptyWins = {
  reviews: 0,
  views: 0,
  calls: 0,
  clicks: 0,
  posts: 0,
  tasksCompleted: 0,
};

const briefingBase = {
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
  businessHealth: {
    overall: 72,
    seo: 70,
    google: 80,
    reviews: 70,
    content: 70,
    consistency: 70,
  },
  weeklyWins: { ...emptyWins, posts: 1, reviews: 2, views: 40 },
  planSummary: "Build local trust.",
  marketingThemes: ["Local visibility"],
  businessGoals: ["More positive reviews"],
  seasonalHint: null as string | null,
  topPriorityTitle: null as string | null,
  upcomingCalendar: [] as [],
  competitorWatchMessage: null as string | null,
  now: new Date("2026-07-16T09:00:00"),
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Proactive HoM", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("proactive presence reassures on a clear healthy week", () => {
  const presence = buildProactivePresence({
    healthState: "healthy",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 0,
    openRecommendations: 0,
    publishingReadyOrScheduled: 0,
    weeklyWins: emptyWins,
    seasonalHint: null,
    monthlyFocus: monthlyFocusStub,
    isEarlyCustomer: false,
    primaryActionKind: "none",
    now: new Date("2026-07-16T09:00:00"),
  });

  assert.match(presence.primary.message, /on track|attention today/i);
  assert.equal(presence.primary.purpose, "reassure");
  assert.equal(/Good morning|Good afternoon|Good evening/i.test(presence.primary.message), false);
});

test("proactive presence requests a meaningful decision without fear language", () => {
  const presence = buildProactivePresence({
    healthState: "needs_attention",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 3,
    openRecommendations: 1,
    publishingReadyOrScheduled: 2,
    weeklyWins: emptyWins,
    seasonalHint: null,
    monthlyFocus: monthlyFocusStub,
    isEarlyCustomer: false,
    primaryActionKind: "approve_weekly_package",
    now: new Date("2026-07-16T14:00:00"),
  });

  assert.equal(presence.primary.purpose, "decision");
  assert.match(presence.primary.message, /opinion|preparing/i);
  const blob = [
    presence.primary.message,
    ...presence.celebrations.map((c) => c.message),
    ...presence.moreUpdates,
  ].join("\n");
  for (const term of PROACTIVE_FORBIDDEN_TERMS) {
    assert.equal(blob.toUpperCase().includes(term.toUpperCase()), false, term);
  }
});

test("excellent health celebrates without gamification spam", () => {
  const presence = buildProactivePresence({
    healthState: "excellent",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 0,
    openRecommendations: 0,
    publishingReadyOrScheduled: 0,
    weeklyWins: { ...emptyWins, reviews: 4, views: 120 },
    seasonalHint: null,
    monthlyFocus: monthlyFocusStub,
    isEarlyCustomer: false,
    primaryActionKind: "none",
    now: new Date("2026-07-16T09:00:00"),
  });

  assert.equal(presence.primary.purpose, "celebrate");
  assert.ok(presence.celebrations.length <= 3);
  assert.ok(
    presence.celebrations.some((c) => /Excellent|reviews|visibility|focus/i.test(c.message)),
  );
});

test("journal timeline carries activity event kinds", () => {
  const journal = buildHeadOfMarketingJournal({
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 2,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 2,
    businessHealth: {
      overall: 78,
      seo: 70,
      google: 80,
      reviews: 80,
      content: 70,
      consistency: 75,
    },
    healthState: "healthy",
    weeklyWins: { ...emptyWins, posts: 1, reviews: 2, views: 50 },
    planSummary: "Local trust",
    seasonalHint: null,
    topPriorityTitle: null,
    profileCreatedAt: "2026-01-10T00:00:00.000Z",
    websiteUrl: "https://acme.example",
    estimatedReviewMinutes: 4,
    isEarlyCustomer: false,
    now: new Date("2026-07-16T10:00:00"),
  });

  assert.equal(journal.timelineTitle, "Recent Activity");
  assert.ok(journal.entries.every((entry) => entry.eventKind in ACTIVITY_EVENT_LABELS));
  assert.ok(journal.entries.some((entry) => entry.eventKind === "decision_requested"));
  assert.ok(journal.entries.some((entry) => entry.eventKind === "completed_work"));
});

test("Weekly Briefing attaches proactive presence", () => {
  const briefing = buildWeeklyBriefing(briefingBase);
  assert.ok(briefing.proactive.primary.message.length > 0);
  assert.equal(briefing.lead, briefing.proactive.primary.message);
  assert.equal(briefing.journal.timelineTitle, "Recent Activity");
});

test("Proactive HoM docs and UI stay presentation-only", () => {
  const doc = readFileSync(join(root, "docs/PROACTIVE_HEAD_OF_MARKETING.md"), "utf8");
  assert.match(doc, /Design philosophy/);
  assert.match(doc, /Trust model/);
  assert.match(doc, /Message hierarchy/);
  assert.match(doc, /Activity types/);
  assert.match(doc, /Celebration philosophy/);
  assert.match(doc, /Reassurance philosophy/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const proactiveSrc = readFileSync(join(root, "lib/head-of-marketing/proactive.ts"), "utf8");
  assert.equal(proactiveSrc.includes("runMarketingDecisionEngine"), false);
  assert.equal(proactiveSrc.includes("generateWeeklyApprovalPackage"), false);

  const page = readFileSync(
    join(root, "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  assert.match(page, /ProactivePresenceSection/);

  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  assert.equal(nav.includes('label: "Proactive"'), false);
  assert.equal(nav.includes('label: "Notifications"'), false);
});
