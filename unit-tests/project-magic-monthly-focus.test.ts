import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  MONTHLY_FOCUS_FORBIDDEN_TERMS,
  buildMonthlyFocus,
} from "../lib/head-of-marketing/monthlyFocus.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const baseFocusInput = {
  gbpConnected: true,
  unansweredReviews: 0,
  openRecommendations: 0,
  healthState: "healthy" as const,
  planSummary: "Build local trust.",
  marketingThemes: [] as string[],
  businessGoals: [] as string[],
  seasonalHint: null as string | null,
  isEarlyCustomer: false,
  now: new Date("2026-07-16T09:00:00"),
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
  weeklyWins: {
    reviews: 2,
    views: 40,
    calls: 0,
    clicks: 0,
    posts: 1,
    tasksCompleted: 0,
  },
  planSummary: "Build local trust.",
  marketingThemes: ["Local visibility", "Reputation"],
  businessGoals: ["More positive reviews"],
  seasonalHint: "Back-to-school (August)" as string | null,
  topPriorityTitle: null as string | null,
  upcomingCalendar: [] as [],
  competitorWatchMessage: null as string | null,
  now: new Date("2026-07-16T09:00:00"),
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Monthly Focus", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("Monthly Focus uses collaborative customer language", () => {
  const focus = buildMonthlyFocus(baseFocusInput);

  assert.equal(focus.title, "This Month's Focus");
  assert.match(focus.intro, /I'd like us to focus/i);
  assert.ok(focus.priorities.length >= 2);
  assert.ok(focus.priorities.length <= 4);
  assert.match(focus.reinforcement, /Everything I'm doing this month/i);
  assert.match(focus.successLooksLike, /What success looks like/i);
  assert.match(focus.progressLine, /on track|progress|attention/i);
});

test("plan themes become priorities without planning-engine language", () => {
  const focus = buildMonthlyFocus({
    ...baseFocusInput,
    marketingThemes: ["Improving local visibility", "Building more positive reviews"],
    businessGoals: ["Preparing seasonal marketing"],
    seasonalHint: "Holiday rush",
  });

  assert.equal(focus.sourcedFromPlan, true);
  const blob = [
    focus.intro,
    focus.reinforcement,
    focus.successLooksLike,
    focus.progressLine,
    focus.magicMoment ?? "",
    ...focus.priorities.flatMap((p) => [p.label, p.why ?? ""]),
  ].join("\n");

  for (const term of MONTHLY_FOCUS_FORBIDDEN_TERMS) {
    assert.equal(blob.includes(term), false, `forbidden term leaked: ${term}`);
  }
});

test("excellent health offers a calm Magic Moment", () => {
  const focus = buildMonthlyFocus({
    ...baseFocusInput,
    healthState: "excellent",
  });
  assert.match(focus.magicMoment ?? "", /enjoy your month|Nothing needs to change/i);
  assert.match(focus.progressLine, /excellent progress/i);
});

test("horizon and style hooks support future Quarterly / Annual / management styles", () => {
  const focus = buildMonthlyFocus(baseFocusInput);
  assert.equal(focus.horizon.activeHorizon, "monthly");
  assert.ok(focus.horizon.supportedHorizons.includes("quarterly"));
  assert.ok(focus.horizon.supportedHorizons.includes("annual"));
  assert.ok(focus.styles.supportedStyles.includes("hands_on"));
  assert.ok(focus.styles.supportedStyles.includes("trusted"));
});

test("Weekly Briefing attaches Monthly Focus and Health references it", () => {
  const briefing = buildWeeklyBriefing(briefingBase);
  assert.equal(briefing.monthlyFocus.title, "This Month's Focus");
  assert.ok(briefing.monthlyFocus.priorities.length >= 2);
  assert.match(briefing.health.reason, /this month/i);
});

test("Monthly Focus docs and UI stay presentation-only on HoM surface", () => {
  const doc = readFileSync(join(root, "docs/MONTHLY_FOCUS.md"), "utf8");
  assert.match(doc, /Relationship philosophy/);
  assert.match(doc, /Weekly Briefing/);
  assert.match(doc, /Journal/);
  assert.match(doc, /Marketing Health/);
  assert.match(doc, /Quarterly/);
  assert.match(doc, /Annual/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const focusSrc = readFileSync(join(root, "lib/head-of-marketing/monthlyFocus.ts"), "utf8");
  assert.equal(focusSrc.includes("runMarketingDecisionEngine"), false);
  assert.equal(focusSrc.includes("generateWeeklyApprovalPackage"), false);
  assert.equal(focusSrc.includes("createMarketingPlan"), false);

  const page = readFileSync(
    join(root, "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  assert.match(page, /MonthlyFocusSection/);

  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  assert.equal(nav.includes('label: "Monthly Focus"'), false);
  assert.equal(nav.includes('label: "This Month\'s Focus"'), false);
});
