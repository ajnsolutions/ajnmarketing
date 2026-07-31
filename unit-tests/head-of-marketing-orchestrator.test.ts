import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExecutiveReview,
  presentExecutiveReview,
  EXECUTIVE_REVIEW_TRUST_LINKS,
} from "../lib/head-of-marketing-orchestrator/build.ts";
import { buildAdminExecutiveOverview } from "../lib/head-of-marketing-orchestrator/adminOverview.ts";
import { ExecutiveReviewCadences } from "../lib/head-of-marketing-orchestrator/types.ts";
import { TenantHealthStates, type TenantHealthSnapshot } from "../lib/ops-dashboard/tenantHealth.ts";

import type { WeeklyGrowthPlan } from "../lib/growth-planner/types.ts";
import type { ExecutiveBrief } from "../lib/executive-briefing/types.ts";
import type { DetectedOpportunity } from "../lib/opportunity-engine/types.ts";

const NOW = new Date("2026-07-31T00:00:00.000Z");

function plan(overrides: Partial<WeeklyGrowthPlan> = {}): WeeklyGrowthPlan {
  return {
    id: "plan1",
    weekKey: "2026-W31",
    generatedAt: NOW.toISOString(),
    status: "proposed",
    outcome: null,
    primaryObjective: { key: "grow_local_awareness", label: "Grow local awareness" },
    whyNow: "Search interest in commercial roofing is rising.",
    expectedImpact: "More qualified leads discovering your services.",
    estimatedEffort: "About 30 minutes this week.",
    supportingActions: [
      {
        id: "action1",
        kind: "google_business_post",
        title: "Google Business Post",
        detail: "Post about your services.",
        certainty: "recommended",
      },
    ],
    successMetric: { key: "phone_calls", label: "Phone calls", detail: "Track calls from your GBP listing." },
    whatIllWatch: [{ id: "watch1", label: "Search trend", detail: "Whether search interest keeps rising." }],
    evidence: [
      {
        id: "ev1",
        certainty: "observed",
        statement: "Search demand for commercial roofing is up.",
        source: "external_intelligence",
      },
      {
        id: "ev2",
        certainty: "observed",
        statement: "You told us this is a goal.",
        source: "goals",
      },
    ],
    historicalContext: [
      {
        id: "hist1",
        certainty: "likely",
        statement: "Similar posts drove bookings before.",
        source: "business_learning_engine",
      },
    ],
    explainability: {
      whyNow: "Search interest in commercial roofing is rising.",
      supportingEvidence: ["Search demand up"],
      confidenceLabel: "high",
      confidenceLabelText: "High confidence",
      businessImpact: "Medium",
      relatedGoals: ["expand_new_market"],
    },
    ...overrides,
  } as unknown as WeeklyGrowthPlan;
}

function brief(overrides: Partial<ExecutiveBrief> = {}): ExecutiveBrief {
  return {
    briefType: "morning_brief",
    headline: "Good morning",
    summary: "Here's what matters today.",
    topPriorities: [{ text: "Post to Google" }],
    wins: [{ text: "3 new reviews" }],
    watchItems: [{ text: "1 pending approval" }],
    today: [{ text: "Approve draft" }],
    recentChanges: [{ text: "Published a new post" }],
    supportingEvidence: [],
    generatedAt: NOW.toISOString(),
    ...overrides,
  } as unknown as ExecutiveBrief;
}

function opportunity(overrides: Partial<DetectedOpportunity> = {}): DetectedOpportunity {
  return {
    id: "opp1",
    type: "seasonal",
    topic: "roofing",
    statement: "Fall roof inspections are trending up.",
    whyNow: "Search demand rose sharply this month.",
    expectedOutcome: "More booked inspections.",
    evidence: [],
    contributingProviders: ["search_console"],
    confidence: "high",
    score: { total: 80, evidenceStrength: 80, businessImpact: 65, urgency: 100, confidence: 100, historicalSuccess: 50 },
    status: "active",
    relatedActionType: null,
    firstDetectedAt: NOW.toISOString(),
    lastSeenAt: NOW.toISOString(),
    retiredAt: null,
    retiredReason: null,
    ...overrides,
  } as unknown as DetectedOpportunity;
}

// ---------------------------------------------------------------------------
// build.ts — buildExecutiveReview (Parts 1, 2, 4, 5, 6, 9)
// ---------------------------------------------------------------------------

test("buildExecutiveReview's primary priority reuses the Weekly Growth Plan's own fields verbatim", () => {
  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief(),
  });

  assert.equal(review.primaryPriority.title, "Grow local awareness");
  assert.equal(review.primaryPriority.whyNow, "Search interest in commercial roofing is rising.");
  assert.equal(review.primaryPriority.expectedImpact, "More qualified leads discovering your services.");
  assert.equal(review.primaryPriority.estimatedEffort, "About 30 minutes this week.");
  assert.equal(review.primaryPriority.confidenceLabel, "High confidence");
  assert.equal(review.primaryPriority.evidence.length, 2);
});

test("buildExecutiveReview explains why the primary opportunity won over the runner-up, without leaking raw scores", () => {
  const top = opportunity({ id: "top", score: { total: 90, evidenceStrength: 90, businessImpact: 80, urgency: 100, confidence: 100, historicalSuccess: 60 } });
  const runnerUp = opportunity({ id: "runner-up", statement: "Reviews are slipping.", score: { total: 70, evidenceStrength: 60, businessImpact: 50, urgency: 65, confidence: 65, historicalSuccess: 50 } });

  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief(),
    topOpportunity: top,
    activeOpportunities: [top, runnerUp],
  });

  assert.match(review.primaryPriority.wonBecause, /chosen over 1 other active opportunity/);
  assert.match(review.primaryPriority.wonBecause, /stronger evidence/);
  assert.doesNotMatch(review.primaryPriority.wonBecause, /\d{2,}/);
});

test("buildExecutiveReview is honest when there's no opportunity to compare against", () => {
  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief(),
    topOpportunity: null,
    activeOpportunities: [],
  });

  assert.match(review.primaryPriority.wonBecause, /stated goals and current plan/);
  assert.match(review.primaryPriority.riskOfWaiting, /steady, ongoing priority/);
});

test("buildExecutiveReview frames risk of waiting more urgently for a high-urgency opportunity", () => {
  const urgent = opportunity({ score: { total: 90, evidenceStrength: 80, businessImpact: 80, urgency: 100, confidence: 100, historicalSuccess: 50 } });
  const calm = opportunity({ score: { total: 60, evidenceStrength: 50, businessImpact: 50, urgency: 35, confidence: 65, historicalSuccess: 50 } });

  const urgentReview = buildExecutiveReview({ businessName: "x", plan: plan(), executiveBrief: brief(), topOpportunity: urgent, activeOpportunities: [urgent] });
  const calmReview = buildExecutiveReview({ businessName: "x", plan: plan(), executiveBrief: brief(), topOpportunity: calm, activeOpportunities: [calm] });

  assert.match(urgentReview.primaryPriority.riskOfWaiting, /Waiting risks losing the current window/);
  assert.match(calmReview.primaryPriority.riskOfWaiting, /no immediate deadline/);
});

test("buildExecutiveReview's secondary priorities exclude the primary, require real evidence, and cap at 3 (Part 3)", () => {
  const top = opportunity({ id: "top", score: { total: 90, evidenceStrength: 90, businessImpact: 80, urgency: 100, confidence: 100, historicalSuccess: 60 } });
  const strong1 = opportunity({ id: "strong1", statement: "Reviews are slipping.", score: { total: 55, evidenceStrength: 50, businessImpact: 50, urgency: 65, confidence: 65, historicalSuccess: 50 } });
  const strong2 = opportunity({ id: "strong2", statement: "Website traffic is trending up.", score: { total: 50, evidenceStrength: 45, businessImpact: 45, urgency: 35, confidence: 65, historicalSuccess: 50 } });
  const strong3 = opportunity({ id: "strong3", statement: "Local event coming up.", score: { total: 45, evidenceStrength: 40, businessImpact: 40, urgency: 35, confidence: 65, historicalSuccess: 50 } });
  const weak = opportunity({ id: "weak", statement: "Barely any evidence yet.", score: { total: 20, evidenceStrength: 10, businessImpact: 35, urgency: 35, confidence: 35, historicalSuccess: 50 } });

  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief(),
    topOpportunity: top,
    activeOpportunities: [top, strong1, strong2, strong3, weak],
  });

  assert.equal(review.secondaryPriorities.length, 3);
  assert.ok(review.secondaryPriorities.every((s) => s.id !== "top"));
  assert.ok(review.secondaryPriorities.every((s) => s.id !== "weak"));
});

test("buildExecutiveReview's executive summary reuses the Executive Brief's own wins/recentChanges/watchItems verbatim (Part 4)", () => {
  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief({
      wins: [{ text: "5 new reviews" }],
      recentChanges: [{ text: "Published a seasonal post" }],
      watchItems: [{ text: "2 approvals pending" }],
    }),
  });

  assert.deepEqual(review.executiveSummary.whatImproved, ["5 new reviews"]);
  assert.deepEqual(review.executiveSummary.whatChanged, ["Published a seasonal post"]);
  assert.deepEqual(review.executiveSummary.whatNeedsAttention, ["2 approvals pending"]);
});

test("buildExecutiveReview's 'what can wait' names hidden lower-priority opportunities honestly, never fabricating urgency", () => {
  const top = opportunity({ id: "top", score: { total: 90, evidenceStrength: 90, businessImpact: 80, urgency: 100, confidence: 100, historicalSuccess: 60 } });
  const strong1 = opportunity({ id: "s1", score: { total: 55, evidenceStrength: 50, businessImpact: 50, urgency: 65, confidence: 65, historicalSuccess: 50 } });
  const strong2 = opportunity({ id: "s2", score: { total: 50, evidenceStrength: 45, businessImpact: 45, urgency: 35, confidence: 65, historicalSuccess: 50 } });
  const strong3 = opportunity({ id: "s3", score: { total: 45, evidenceStrength: 40, businessImpact: 40, urgency: 35, confidence: 65, historicalSuccess: 50 } });
  const strong4 = opportunity({ id: "s4", score: { total: 44, evidenceStrength: 40, businessImpact: 40, urgency: 35, confidence: 65, historicalSuccess: 50 } });

  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief(),
    topOpportunity: top,
    activeOpportunities: [top, strong1, strong2, strong3, strong4],
  });

  assert.equal(review.executiveSummary.whatCanWait.length, 1);
  assert.match(review.executiveSummary.whatCanWait[0]!, /1 other opportunity/);
});

test("buildExecutiveReview's decision explanation reuses plan.evidence/historicalContext/confidence verbatim, and never exposes raw provider ids (Part 5)", () => {
  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief(),
  });

  assert.deepEqual(review.decisionExplanation.evidenceUsed, plan().evidence);
  assert.deepEqual(review.decisionExplanation.learningApplied, plan().historicalContext);
  assert.equal(review.decisionExplanation.confidence, "High confidence");
  assert.ok(review.decisionExplanation.signalsConsidered.includes("Search Console & External Intelligence"));
  assert.ok(review.decisionExplanation.signalsConsidered.includes("Your stated goals"));
  assert.ok(!review.decisionExplanation.signalsConsidered.some((s) => s === "external_intelligence"));
});

test("buildExecutiveReview's action plan reuses the Weekly Growth Plan's own supporting actions and success metric (Part 6)", () => {
  const review = buildExecutiveReview({
    businessName: "Acme Roofing",
    plan: plan(),
    executiveBrief: brief(),
  });

  assert.equal(review.actionPlan.steps.length, 1);
  assert.equal(review.actionPlan.steps[0]!.title, "Google Business Post");
  assert.equal(review.actionPlan.steps[0]!.href, "/dashboard/google-business-profile");
  assert.match(review.actionPlan.successMetric, /Phone calls/);
  assert.equal(review.actionPlan.whatIllWatch.length, 1);
});

test("buildExecutiveReview always links back to real evidence surfaces (Part 9)", () => {
  const review = buildExecutiveReview({ businessName: "Acme Roofing", plan: plan(), executiveBrief: brief() });
  assert.deepEqual(review.trustLinks, EXECUTIVE_REVIEW_TRUST_LINKS);
  assert.equal(review.trustLinks.length, 5);
  assert.ok(review.trustLinks.every((link) => link.href.startsWith("/dashboard/business-brain")));
});

// ---------------------------------------------------------------------------
// presentExecutiveReview — Today / This Week / This Month (Part 7)
// ---------------------------------------------------------------------------

test("presentExecutiveReview swaps only the headline/summary per cadence — everything else stays identical", () => {
  const review = buildExecutiveReview({ businessName: "Acme Roofing", plan: plan(), executiveBrief: brief() });
  const briefsByCadence = {
    morning: brief({ headline: "Good morning", summary: "Morning summary." }),
    weeklyStrategy: brief({ headline: "This week's strategy", summary: "Weekly summary." }),
    monthlyExecutive: brief({ headline: "This month's report", summary: "Monthly summary." }),
  };

  const today = presentExecutiveReview(review, ExecutiveReviewCadences.TODAY, briefsByCadence);
  const week = presentExecutiveReview(review, ExecutiveReviewCadences.THIS_WEEK, briefsByCadence);
  const month = presentExecutiveReview(review, ExecutiveReviewCadences.THIS_MONTH, briefsByCadence);

  assert.equal(today.headline, "Good morning");
  assert.equal(week.headline, "This week's strategy");
  assert.equal(month.headline, "This month's report");

  for (const presented of [today, week, month]) {
    assert.deepEqual(presented.primaryPriority, review.primaryPriority);
    assert.deepEqual(presented.secondaryPriorities, review.secondaryPriorities);
    assert.deepEqual(presented.executiveSummary, review.executiveSummary);
    assert.deepEqual(presented.decisionExplanation, review.decisionExplanation);
    assert.deepEqual(presented.actionPlan, review.actionPlan);
    assert.deepEqual(presented.trustLinks, review.trustLinks);
  }
});

// ---------------------------------------------------------------------------
// adminOverview.ts — Admin Executive Overview (Part 8)
// ---------------------------------------------------------------------------

function tenant(overrides: Partial<TenantHealthSnapshot> = {}): TenantHealthSnapshot {
  return {
    businessProfileId: "biz1",
    userId: "user1",
    businessName: "Acme Roofing",
    onboardingCompleted: true,
    createdAt: NOW.toISOString(),
    overallState: TenantHealthStates.HEALTHY,
    dimensions: [],
    ...overrides,
  } as unknown as TenantHealthSnapshot;
}

test("buildAdminExecutiveOverview buckets businesses needing attention vs doing well from the already-computed tenant health state", () => {
  const overview = buildAdminExecutiveOverview({
    tenants: [
      tenant({ businessProfileId: "healthy", overallState: TenantHealthStates.HEALTHY }),
      tenant({ businessProfileId: "warning", overallState: TenantHealthStates.WARNING, dimensions: [{ key: "approvals", label: "Approvals", state: TenantHealthStates.WARNING, detail: "2 overdue." }] }),
      tenant({ businessProfileId: "blocked", overallState: TenantHealthStates.BLOCKED, dimensions: [{ key: "publishing", label: "Publishing", state: TenantHealthStates.BLOCKED, detail: "3 failed." }] }),
    ] as unknown as TenantHealthSnapshot[],
    opportunitiesByBusinessProfileId: new Map(),
  });

  assert.equal(overview.businessesDoingWell.length, 1);
  assert.equal(overview.businessesDoingWell[0]!.businessProfileId, "healthy");
  assert.equal(overview.businessesNeedingAttention.length, 2);
  assert.ok(overview.businessesNeedingAttention.some((b) => b.businessProfileId === "warning"));
  assert.ok(overview.businessesNeedingAttention.some((b) => b.businessProfileId === "blocked"));
});

test("buildAdminExecutiveOverview flags a confidence gap for zero opportunities or all-low-confidence opportunities, without recomputing Business Knowledge Health", () => {
  const noEvidence = tenant({ businessProfileId: "no-evidence" });
  const allLow = tenant({ businessProfileId: "all-low" });
  const confident = tenant({ businessProfileId: "confident" });

  const overview = buildAdminExecutiveOverview({
    tenants: [noEvidence, allLow, confident],
    opportunitiesByBusinessProfileId: new Map([
      ["no-evidence", []],
      ["all-low", [opportunity({ id: "o1", confidence: "low" })]],
      ["confident", [opportunity({ id: "o2", confidence: "high" })]],
    ]),
  });

  const gapIds = overview.confidenceGaps.map((g) => g.businessProfileId);
  assert.ok(gapIds.includes("no-evidence"));
  assert.ok(gapIds.includes("all-low"));
  assert.ok(!gapIds.includes("confident"));
});

test("buildAdminExecutiveOverview flags an opportunity as stalled once it's been active 14+ days, sorted longest-stalled first", () => {
  const fresh = opportunity({ id: "fresh", firstDetectedAt: NOW.toISOString() });
  const stalled = opportunity({
    id: "stalled",
    firstDetectedAt: new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const veryStalled = opportunity({
    id: "very-stalled",
    firstDetectedAt: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const overview = buildAdminExecutiveOverview({
    tenants: [tenant()],
    opportunitiesByBusinessProfileId: new Map([["biz1", [fresh, stalled, veryStalled]]]),
    now: NOW,
  });

  assert.equal(overview.stalledOpportunities.length, 2);
  assert.equal(overview.stalledOpportunities[0]!.opportunityId, "very-stalled");
  assert.equal(overview.stalledOpportunities[1]!.opportunityId, "stalled");
});
