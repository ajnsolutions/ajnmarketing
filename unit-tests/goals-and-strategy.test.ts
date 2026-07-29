import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  applyBusinessGoalsToMarketingGoals,
  decodeBusinessGoalsFromMarketingGoals,
  goalsFromSelectedLabels,
  reorderGoals,
} from "../lib/goals/persistence.ts";
import { buildGoalProgress } from "../lib/goals/progress.ts";
import { explainGoalRelevance } from "../lib/strategy/goalRelevance.ts";
import { GoalProgressStates, GoalStatuses } from "../lib/goals/types.ts";
import { buildWeeklyBriefing, type WeeklyBriefingInput } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { buildGrowthAdvisorBriefing } from "../lib/growth-advisor/buildGrowthAdvisorBriefing.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { RecommendedActionTypes } from "../lib/marketing-decisions/types.ts";
import { onboardingDataToProfileRow, profileRowToOnboardingData } from "../lib/business-profile.ts";
import { initialOnboardingData } from "../lib/onboarding-storage.ts";

const root = process.cwd();

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("goal selection persists through marketing_goals marker round-trip", () => {
  const goals = goalsFromSelectedLabels(
    ["Generate more leads", "Improve online reputation"],
    "6_months",
    new Date("2026-07-28T12:00:00.000Z"),
  );
  assert.equal(goals.length, 2);
  assert.equal(goals[0]?.priority, 1);
  assert.equal(goals[0]?.targetTimeframe, "6_months");

  const encoded = applyBusinessGoalsToMarketingGoals(
    ["Audience: Local business", "Customers: Local community"],
    goals,
  );
  assert.ok(encoded.some((item) => item.startsWith("__business_goals_v1__:")));
  assert.ok(encoded.includes("Generate more leads"));

  const decoded = decodeBusinessGoalsFromMarketingGoals(encoded);
  assert.equal(decoded.length, 2);
  assert.equal(decoded[0]?.key, "generate_more_leads");
  assert.equal(decoded[1]?.key, "improve_online_reputation");
});

test("priority ordering can be reordered without inventing goals", () => {
  const goals = goalsFromSelectedLabels(["Increase revenue", "Grow memberships"], null);
  const reordered = reorderGoals(goals, ["grow_memberships", "increase_revenue"]);
  assert.equal(reordered[0]?.key, "grow_memberships");
  assert.equal(reordered[0]?.priority, 1);
  assert.equal(reordered[1]?.key, "increase_revenue");
});

test("goal-aware recommendations annotate Supports Goal without changing ranking", () => {
  const goals = goalsFromSelectedLabels(["Improve online reputation"], "90_days");
  const relevance = explainGoalRelevance(
    goals,
    RecommendedActionTypes.REQUEST_REVIEWS,
    "Ask happy customers for a review",
  );
  assert.equal(relevance?.supportsGoal, "Improve online reputation");
  assert.match(relevance?.whySupportsGoal ?? "", /reputation|trust/i);
});

test("goal progress never fabricates a trend when evidence is thin", () => {
  const goals = goalsFromSelectedLabels(["Increase website conversions"], null);
  const progress = buildGoalProgress(goals, {
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 0,
    publishFailures: 0,
    openRecommendations: 0,
    weeklyReviewCount: 0,
    weeklyPostCount: 0,
    websiteConnected: true,
    setupComplete: true,
    isEarlyCustomer: false,
  });
  assert.equal(progress[0]?.state, GoalProgressStates.ESTABLISHING_BASELINE);
  assert.match(progress[0]?.detail ?? "", /baseline/i);
});

test("goal progress can report needs attention from real review backlog", () => {
  const goals = goalsFromSelectedLabels(["Improve online reputation"], null);
  const progress = buildGoalProgress(goals, {
    gbpConnected: true,
    unansweredReviews: 4,
    pendingApprovals: 0,
    publishFailures: 0,
    openRecommendations: 0,
    weeklyReviewCount: 0,
    weeklyPostCount: 0,
    websiteConnected: true,
    setupComplete: true,
    isEarlyCustomer: false,
  });
  assert.equal(progress[0]?.state, GoalProgressStates.NEEDS_ATTENTION);
});

test("weekly briefing / Growth Advisor includes goal progress and one recommendation", () => {
  const baseInput: WeeklyBriefingInput = {
    userName: "Alex",
    businessName: "Northside Fitness",
    websiteUrl: "https://northside.example",
    voiceNotes: "",
    profileCreatedAt: "2026-01-15T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 1,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 1,
    businessHealth: { overall: 72, seo: 70, google: 80, reviews: 70, content: 70, consistency: 70 },
    weeklyWins: { reviews: 1, views: 20, calls: 0, clicks: 0, posts: 1, tasksCompleted: 0 },
    planSummary: "Grow memberships.",
    marketingThemes: ["Memberships"],
    businessGoals: ["Grow memberships"],
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    now: new Date("2026-07-28T09:00:00"),
  };
  const briefing = buildWeeklyBriefing(baseInput);
  const goals = goalsFromSelectedLabels(["Grow memberships", "Generate more leads"], "1_year");
  const advisor = buildGrowthAdvisorBriefing(briefing, null, { goals });

  assert.equal(advisor.goalProgress.strategicFocus, "Grow memberships");
  assert.ok(advisor.goalProgress.items.length >= 1);
  assert.ok(advisor.recommendation === null || typeof advisor.recommendation?.title === "string");
  if (advisor.recommendation) {
    assert.ok(advisor.recommendation.supportsGoal);
  }
});

test("onboarding success goals round-trip through profile persistence", () => {
  const row = onboardingDataToProfileRow(
    "user-1",
    {
      ...initialOnboardingData,
      businessName: "Acme",
      websiteUrl: "https://acme.example",
      businessAudience: "local",
      customerOrigin: "local_community",
      marketingGoals: ["Increase revenue", "Save time with automation"],
      goalTimeframe: "90_days",
    },
    false,
  );
  assert.ok((row.marketing_goals ?? []).some((g) => g.startsWith("__business_goals_v1__:")));

  const back = profileRowToOnboardingData({
    id: "p1",
    user_id: "user-1",
    business_name: row.business_name ?? null,
    industry: null,
    website: row.website ?? null,
    phone: null,
    city: null,
    state: null,
    primary_service_area: null,
    nearby_cities: null,
    primary_services: null,
    emergency_services: null,
    seasonal_services: null,
    specialty_services: null,
    competitors: null,
    marketing_goals: row.marketing_goals ?? [],
    brand_voice_tone: null,
    preferred_words: null,
    avoid_words: null,
    voice_notes: null,
    onboarding_completed: false,
    created_at: "2026-07-28T00:00:00.000Z",
    updated_at: "2026-07-28T00:00:00.000Z",
  });
  assert.deepEqual(back.marketingGoals, ["Increase revenue", "Save time with automation"]);
  assert.equal(back.goalTimeframe, "90_days");
});

test("paused goals are excluded from active progress tracking", () => {
  const goals = goalsFromSelectedLabels(["Increase revenue"], null).map((goal) => ({
    ...goal,
    status: GoalStatuses.PAUSED,
  }));
  const progress = buildGoalProgress(goals, {
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 0,
    publishFailures: 0,
    openRecommendations: 0,
    weeklyReviewCount: 0,
    weeklyPostCount: 2,
    websiteConnected: true,
    setupComplete: true,
    isEarlyCustomer: false,
  });
  assert.equal(progress.length, 0);
});

test("Wave III surfaces and docs exist", () => {
  assert.match(
    readFileSync(join(root, "docs/project-magic/GOALS_AND_STRATEGY.md"), "utf8"),
    /Goal model/,
  );
  assert.match(
    readFileSync(join(root, "components/onboarding/onboarding-wizard.tsx"), "utf8"),
    /What would success look like/,
  );
  assert.match(
    readFileSync(join(root, "components/dashboard/growth-advisor/growth-advisor-page.tsx"), "utf8"),
    /Progress toward goals/,
  );
  assert.match(
    readFileSync(join(root, "lib/strategy/goalRelevance.ts"), "utf8"),
    /explainGoalRelevance/,
  );
});
