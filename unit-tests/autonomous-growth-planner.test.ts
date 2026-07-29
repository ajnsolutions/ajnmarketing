import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildWeeklyBriefing, type WeeklyBriefingInput } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { buildWeeklyGrowthPlan } from "../lib/growth-planner/buildWeeklyGrowthPlan.ts";
import { synthesizePlanEvidence } from "../lib/growth-planner/evidence.ts";
import { resolvePrimaryObjective } from "../lib/growth-planner/primaryObjective.ts";
import {
  WEEKLY_GROWTH_PLANS_MARKER_PREFIX,
  applyWeeklyGrowthPlansToMarketingGoals,
  compareWeeklyPlans,
  decodeWeeklyGrowthPlansFromMarketingGoals,
  planToHistoryEntry,
  upsertWeeklyPlanHistory,
} from "../lib/growth-planner/history.ts";
import { PlanTrustCertaintyLevels } from "../lib/growth-planner/trust.ts";
import {
  PrimaryObjectiveKeys,
  WeeklyPlanStatuses,
} from "../lib/growth-planner/types.ts";
import { composeExternalIntelligence } from "../lib/external-intelligence/compose.ts";
import { normalizeProviderBatch } from "../lib/external-intelligence/normalize.ts";
import {
  ExternalIntelligenceCategories,
  ExternalIntelligenceProviderIds,
} from "../lib/external-intelligence/types.ts";
import { composeCustomerVoiceIntelligence } from "../lib/customer-voice/compose.ts";
import { normalizeProviderBatch as normalizeVoiceBatch } from "../lib/customer-voice/normalize.ts";
import { CustomerVoiceProviderIds } from "../lib/customer-voice/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { RecommendedActionTypes } from "../lib/marketing-decisions/types.ts";
import { ConfidenceLabels } from "../lib/recommendation-presentation/types.ts";
import { GoalStatuses, type BusinessGoal } from "../lib/goals/types.ts";
import { applyBusinessGoalsToMarketingGoals } from "../lib/goals/persistence.ts";
import { stripMagicGoalMarkers } from "../lib/onboarding-storage.ts";

const root = process.cwd();
const now = new Date("2026-07-29T12:00:00.000Z");

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
  pendingApprovals: 1,
  openRecommendations: 1,
  publishFailures: 0,
  publishingReadyOrScheduled: 1,
  businessHealth: healthyScores,
  weeklyWins: { ...emptyWins, posts: 1, reviews: 2, views: 40 },
  planSummary: "Build local trust.",
  marketingThemes: ["Local visibility"],
  businessGoals: ["More phone calls"],
  seasonalHint: "Back-to-school (August)",
  topPriorityTitle: "Publish a Google Business update",
  upcomingCalendar: [],
  competitorWatchMessage: "A competitor started running ads.",
  now: new Date("2026-07-16T09:00:00"),
};

const sampleGoals: BusinessGoal[] = [
  {
    key: "generate_more_leads",
    label: "Generate more leads",
    priority: 1,
    status: GoalStatuses.ACTIVE,
    targetTimeframe: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("docs and modules ship for Autonomous Growth Planner", () => {
  assert.ok(existsSync(join(root, "docs/project-magic/AUTONOMOUS_GROWTH_PLANNER.md")));
  assert.ok(existsSync(join(root, "lib/growth-planner/buildWeeklyGrowthPlan.ts")));
  assert.ok(existsSync(join(root, "lib/growth-planner/history.ts")));
  assert.ok(existsSync(join(root, "components/dashboard/growth-advisor/weekly-growth-plan-section.tsx")));
  const docs = readFileSync(join(root, "docs/project-magic/AUTONOMOUS_GROWTH_PLANNER.md"), "utf8");
  assert.ok(docs.includes("Never automate execution") || docs.includes("never auto"));
  assert.ok(docs.includes("Future autonomous execution"));
});

test("plan generation produces required weekly plan fields", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const plan = buildWeeklyGrowthPlan({
    briefing,
    goals: sampleGoals,
    now,
  });

  assert.equal(typeof plan.primaryObjective.key, "string");
  assert.equal(typeof plan.primaryObjective.label, "string");
  assert.ok(plan.whyNow.length > 0);
  assert.ok(plan.expectedImpact.length > 0);
  assert.ok(plan.estimatedEffort.length > 0);
  assert.ok(plan.supportingActions.length >= 2);
  assert.ok(plan.successMetric.label.length > 0);
  assert.ok(plan.whatIllWatch.length >= 1);
  assert.equal(plan.status, WeeklyPlanStatuses.PROPOSED);
  assert.equal(plan.outcome, null);
  assert.ok(plan.weekKey.startsWith("2026-W"));
});

test("always generates exactly one primary objective", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  briefing.topRecommendationDetail = {
    recommendationId: "rec-1",
    title: "Ask for reviews this week",
    whyNow: "Recent happy customers are ready to share feedback.",
    expectedBenefit: "Stronger local trust.",
    confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
    actionType: RecommendedActionTypes.REQUEST_REVIEWS,
  };

  const plan = buildWeeklyGrowthPlan({ briefing, goals: sampleGoals, now });
  assert.equal(plan.primaryObjective.key, PrimaryObjectiveKeys.IMPROVE_REVIEW_VELOCITY);

  const resolved = resolvePrimaryObjective({
    briefing,
    goals: sampleGoals,
  });
  assert.equal(resolved.key, plan.primaryObjective.key);
});

test("empty states still produce a calm single-objective plan", () => {
  const briefing = buildWeeklyBriefing({
    ...baseInput,
    gbpConnected: false,
    openRecommendations: 0,
    pendingApprovals: 0,
    weeklyWins: emptyWins,
    topPriorityTitle: null,
    competitorWatchMessage: null,
    seasonalHint: null,
  });

  const plan = buildWeeklyGrowthPlan({
    briefing,
    goals: [],
    customerVoice: null,
    externalIntelligence: null,
    businessDiscovery: null,
    now,
  });

  assert.ok(plan.primaryObjective.label.length > 0);
  assert.equal(Object.values(PrimaryObjectiveKeys).includes(plan.primaryObjective.key), true);
  assert.ok(plan.supportingActions.every((a) => a.certainty === PlanTrustCertaintyLevels.RECOMMENDED));
  assert.ok(!/\d+%/.test(plan.expectedImpact));
  assert.ok(!/\$\d+/.test(plan.successMetric.detail));
});

test("evidence synthesis cites multiple Business Brain sources with trust labels", () => {
  const voiceEvidence = normalizeVoiceBatch({
    providerId: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
    sourceLabel: "Google Business Reviews",
    now,
    evidence: [
      {
        externalId: "1",
        occurredAt: "2026-07-01T00:00:00.000Z",
        rating: 5,
        text: "Fast service and friendly staff — highly recommend.",
      },
      {
        externalId: "2",
        occurredAt: "2026-07-10T00:00:00.000Z",
        rating: 5,
        text: "Quick turnaround on our request. Professional expertise.",
      },
      {
        externalId: "3",
        occurredAt: "2026-07-20T00:00:00.000Z",
        rating: 5,
        text: "Same-day response from the team. Great communication.",
      },
    ],
  });
  const customerVoice = composeCustomerVoiceIntelligence({
    businessProfileId: "biz-1",
    evidence: voiceEvidence,
    now,
  });

  const eiSignals = normalizeProviderBatch({
    providerId: ExternalIntelligenceProviderIds.HOLIDAY_CALENDAR,
    sourceLabel: "Holiday Calendar",
    now,
    signals: [
      {
        externalId: "h1",
        category: ExternalIntelligenceCategories.HOLIDAY_CALENDAR,
        title: "Labor Day",
        summary: "Labor Day weekend often creates service and promotion opportunities.",
        occurredAt: "2026-07-15T00:00:00.000Z",
        signalStrength: 0.9,
      },
    ],
  });
  const externalIntelligence = composeExternalIntelligence({
    businessProfileId: "biz-1",
    signals: eiSignals,
    now,
  });

  const briefing = buildWeeklyBriefing(baseInput);
  briefing.topRecommendationDetail = {
    recommendationId: "rec-2",
    title: "Publish a Google Business update",
    whyNow: "Local visibility is the clearest lever this week.",
    expectedBenefit: "More people finding you nearby.",
    confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
    actionType: RecommendedActionTypes.PUBLISH_GBP_POST,
  };

  const evidence = synthesizePlanEvidence({
    briefing,
    goals: sampleGoals,
    customerVoice,
    externalIntelligence,
  });

  const sources = new Set(evidence.map((e) => e.source));
  assert.ok(sources.has("goals"));
  assert.ok(sources.has("weekly_briefing") || sources.has("customer_voice"));
  assert.ok(evidence.some((e) => e.certainty === PlanTrustCertaintyLevels.OBSERVED));
  assert.ok(evidence.some((e) => e.certainty === PlanTrustCertaintyLevels.RECOMMENDED));

  const plan = buildWeeklyGrowthPlan({
    briefing,
    goals: sampleGoals,
    customerVoice,
    externalIntelligence,
    now,
  });
  assert.ok(plan.explainability.whyNow.length > 0);
  assert.ok(plan.explainability.supportingEvidence.length >= 1);
  assert.ok(plan.explainability.relatedGoals.includes("Generate more leads"));
  assert.ok(plan.explainability.businessImpact.length > 0);
});

test("plan history persists, compares weeks, and survives goal marker merges", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const planA = buildWeeklyGrowthPlan({
    briefing,
    goals: sampleGoals,
    now: new Date("2026-07-22T12:00:00.000Z"),
  });
  const planB = buildWeeklyGrowthPlan({
    briefing: {
      ...briefing,
      topRecommendationDetail: {
        recommendationId: "rec-3",
        title: "Request reviews",
        whyNow: "Reviews matter this week.",
        expectedBenefit: "More trust.",
        confidenceLabel: ConfidenceLabels.WORTH_CONSIDERING,
        actionType: RecommendedActionTypes.REQUEST_REVIEWS,
      },
    },
    goals: sampleGoals,
    now: new Date("2026-07-29T12:00:00.000Z"),
  });

  let history = upsertWeeklyPlanHistory([], planA);
  history = upsertWeeklyPlanHistory(history, planB);
  assert.equal(history.length, 2);

  const comparison = compareWeeklyPlans(planToHistoryEntry(planB), planToHistoryEntry(planA));
  assert.equal(comparison.objectiveChanged, planA.primaryObjective.key !== planB.primaryObjective.key);
  assert.ok(comparison.summary.length > 0);

  const encoded = applyWeeklyGrowthPlansToMarketingGoals(["More phone calls"], history);
  assert.ok(encoded.some((item) => item.startsWith(WEEKLY_GROWTH_PLANS_MARKER_PREFIX)));
  const decoded = decodeWeeklyGrowthPlansFromMarketingGoals(encoded);
  assert.equal(decoded.length, 2);

  const withGoals = applyBusinessGoalsToMarketingGoals(encoded, sampleGoals);
  assert.ok(withGoals.some((item) => item.startsWith(WEEKLY_GROWTH_PLANS_MARKER_PREFIX)));
  assert.ok(withGoals.some((item) => item.startsWith("__business_goals_v1__:")));

  const stripped = stripMagicGoalMarkers(withGoals);
  assert.ok(!stripped.some((item) => item.startsWith(WEEKLY_GROWTH_PLANS_MARKER_PREFIX)));
});

test("supporting actions stay recommendations and never imply execution", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const plan = buildWeeklyGrowthPlan({ briefing, goals: sampleGoals, now });
  assert.ok(plan.supportingActions.length <= 4);
  for (const action of plan.supportingActions) {
    assert.equal(action.certainty, PlanTrustCertaintyLevels.RECOMMENDED);
    assert.ok(action.title.length > 0);
    assert.ok(action.detail.length > 0);
  }

  const ui = readFileSync(
    join(root, "components/dashboard/growth-advisor/weekly-growth-plan-section.tsx"),
    "utf8",
  );
  assert.ok(ui.includes("nothing runs automatically") || ui.includes("Nothing runs automatically"));
  assert.ok(ui.includes("Recommended only") || ui.includes("approve"));
});
