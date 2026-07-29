import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyBriefing, type WeeklyBriefingInput } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { buildGrowthAdvisorBriefing } from "../lib/growth-advisor/buildGrowthAdvisorBriefing.ts";
import { ConfidenceLabels } from "../lib/recommendation-presentation/types.ts";

const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };

const healthyScores = { overall: 72, seo: 70, google: 80, reviews: 70, content: 70, consistency: 70 };

const baseInput: WeeklyBriefingInput = {
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
  marketingThemes: ["Local visibility"],
  businessGoals: ["More positive reviews"],
  seasonalHint: "Back-to-school (August)",
  topPriorityTitle: null,
  upcomingCalendar: [],
  competitorWatchMessage: null,
  now: new Date("2026-07-16T09:00:00"),
};

test("greeting and business name pass through unchanged from the briefing", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.equal(advisor.greeting, briefing.greeting);
  assert.match(advisor.greeting, /Sean/);
  assert.equal(advisor.businessName, "Acme Plumbing");
});

test("what changed reflects real weekly activity as multiple items, not the single fallback line", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.equal(advisor.whatChanged.hasMeaningfulChange, true);
  assert.ok(advisor.whatChanged.items.length > 1);
});

test("what changed honestly says so when nothing meaningful happened, never fabricating activity", () => {
  const quietInput: WeeklyBriefingInput = {
    ...baseInput,
    weeklyWins: emptyWins,
    publishingReadyOrScheduled: 0,
    planSummary: null,
  };
  const briefing = buildWeeklyBriefing(quietInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.equal(advisor.whatChanged.hasMeaningfulChange, false);
  assert.equal(advisor.whatChanged.items.length, 1);
});

test("what I noticed never exceeds 3 observations, each with a headline and why-it-matters", () => {
  const noisyInput: WeeklyBriefingInput = {
    ...baseInput,
    unansweredReviews: 1,
    pendingApprovals: 2,
    seasonalHint: "Back-to-school (August)",
    competitorWatchMessage: "A competitor started running ads.",
  };
  const briefing = buildWeeklyBriefing(noisyInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.ok(advisor.whatINoticed.length <= 3);
  for (const observation of advisor.whatINoticed) {
    assert.ok(observation.headline.length > 0);
    assert.ok(observation.whyItMatters.length > 0);
  }
});

test("exactly one recommendation is ever produced — never a list", () => {
  const briefing = buildWeeklyBriefing({ ...baseInput, pendingApprovals: 1 });
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.ok(advisor.recommendation === null || typeof advisor.recommendation === "object");
  if (advisor.recommendation) {
    assert.equal(typeof advisor.recommendation.title, "string");
    assert.ok(advisor.recommendation.title.length > 0);
  }
});

test("recommendation includes why now, expected impact, estimated effort, and why I believe this", () => {
  const briefing = buildWeeklyBriefing({ ...baseInput, pendingApprovals: 1 });
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.ok(advisor.recommendation);
  assert.ok(advisor.recommendation!.whyNow.length > 0);
  assert.ok(advisor.recommendation!.expectedImpact.length > 0);
  assert.ok(advisor.recommendation!.estimatedEffort.length > 0);
  assert.ok(advisor.recommendation!.whyIBelieve.length > 0);
  assert.ok("supportsGoal" in advisor.recommendation!);
});

test("goal progress empty state is honest when no goals are selected", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing, null, { goals: [] });
  assert.equal(advisor.goalProgress.strategicFocus, null);
  assert.match(advisor.goalProgress.emptyDetail ?? "", /success looks like/i);
});

test("recommendation without real recommendation-presentation detail still gives an honest, non-fabricated 'why I believe' sentence", () => {
  const briefing = buildWeeklyBriefing({ ...baseInput, gbpConnected: false });
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.ok(advisor.recommendation);
  assert.equal(advisor.recommendation!.confidenceLabel, null);
  assert.equal(advisor.recommendation!.confidenceLabelText, null);
  assert.match(advisor.recommendation!.whyIBelieve, /clearest next step/i);
});

test("recommendation with real topRecommendationDetail reuses its confidence explainability, never invents a new one", () => {
  const briefing = buildWeeklyBriefing({
    ...baseInput,
    openRecommendations: 1,
    topRecommendationDetail: {
      recommendationId: "rec-1",
      title: "Post about your summer maintenance special",
      whyNow: "Summer is your highest-demand season.",
      expectedBenefit: "More calls from homeowners planning ahead.",
      confidenceLabel: ConfidenceLabels.STRONG_RECOMMENDATION,
    },
  });
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.ok(advisor.recommendation);
  assert.equal(advisor.recommendation!.title, "Post about your summer maintenance special");
  assert.equal(advisor.recommendation!.confidenceLabel, ConfidenceLabels.STRONG_RECOMMENDATION);
  assert.equal(advisor.recommendation!.confidenceLabelText, "Strong recommendation");
});

test("primary action reassurance flag mirrors the underlying action kind honestly", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.equal(advisor.primaryActionIsReassurance, advisor.primaryAction.kind === "none");
});

test("empty state resolves to disconnected_integration when Google isn't connected", () => {
  const briefing = buildWeeklyBriefing({ ...baseInput, gbpConnected: false });
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.equal(advisor.emptyStateKind, "disconnected_integration");
});

test("empty state resolves to no_recommendation when connected but nothing to recommend", () => {
  const briefing = buildWeeklyBriefing({
    ...baseInput,
    gbpConnected: true,
    pendingApprovals: 0,
    openRecommendations: 0,
    topPriorityTitle: null,
    planSummary: null,
  });
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.equal(advisor.recommendation, null);
  assert.equal(advisor.emptyStateKind, "no_recommendation");
});

test("this function computes no new decision — recommendation always traces back to the briefing's own recommendation/topRecommendationDetail", () => {
  const briefing = buildWeeklyBriefing({ ...baseInput, pendingApprovals: 1 });
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.ok(advisor.recommendation);
  assert.equal(advisor.recommendation!.title, briefing.recommendation?.title);
});

test("supporting context health mirrors the briefing's own Marketing Health verbatim", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.equal(advisor.supporting.health.state, briefing.health.state);
  assert.equal(advisor.supporting.health.label, briefing.health.label);
  assert.equal(advisor.supporting.health.message, briefing.health.message);
});

test("a real Business Discovery growth opportunity supplements What I Noticed only when signals are thin, never displacing a real signal", () => {
  const richBriefing = buildWeeklyBriefing({
    ...baseInput,
    unansweredReviews: 1,
    pendingApprovals: 1,
    seasonalHint: "Back-to-school (August)",
  });
  const businessDiscovery = {
    growthOpportunities: { value: ["Your maintenance plan isn't linked from your homepage"] },
  } as never;

  const advisorRich = buildGrowthAdvisorBriefing(richBriefing, businessDiscovery);
  assert.ok(!advisorRich.whatINoticed.some((item) => item.headline.includes("Your business profile")));

  const thinInput: WeeklyBriefingInput = {
    ...baseInput,
    weeklyWins: emptyWins,
    seasonalHint: null,
    competitorWatchMessage: null,
  };
  const thinBriefing = buildWeeklyBriefing(thinInput);
  const advisorThin = buildGrowthAdvisorBriefing(thinBriefing, businessDiscovery);
  assert.ok(advisorThin.whatINoticed.some((item) => item.headline.includes("Your business profile")));
});
