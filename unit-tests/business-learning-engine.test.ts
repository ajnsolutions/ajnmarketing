import test from "node:test";
import assert from "node:assert/strict";

import { computeDecayState, applyDecay, blendConfidence } from "../lib/business-learning-engine/confidence.ts";
import {
  planReinforcement,
  buildNewPattern,
  reinforceExistingPattern,
} from "../lib/business-learning-engine/reinforce.ts";
import { deriveRecommendationLifecycleState, RecommendationLifecycleStates } from "../lib/business-learning-engine/lifecycle.ts";
import { marketingMemoryLearningsToLearningSignals } from "../lib/business-learning-engine/adapters/marketingMemory.ts";
import {
  actionTypeBreakdownToLearningSignals,
  type ActionTypeOutcomeBreakdown,
} from "../lib/business-learning-engine/adapters/recommendationOutcomes.ts";
import {
  feedbackBreakdownToLearningSignals,
  groupFeedbackEventsByActionType,
} from "../lib/business-learning-engine/adapters/feedback.ts";
import { businessReasoningToLearningSignals } from "../lib/business-learning-engine/adapters/businessKnowledgeGraph.ts";
import {
  computeLearningMaturity,
  summarizeOutcomeBreakdown,
} from "../lib/business-learning-engine/learningMaturity.ts";
import { historicalContextFromPattern } from "../lib/growth-advisor/buildGrowthAdvisorBriefing.ts";
import { buildHistoricalContext } from "../lib/growth-planner/evidence.ts";
import { buildBusinessTimeline } from "../lib/business-timeline/build.ts";
import type { BusinessPattern, LearningSignalInput, RecommendationFeedbackEvent } from "../lib/business-learning-engine/types.ts";
import type { MarketingMemoryLearning } from "../lib/marketing-memory/learningTypes.ts";
import type { BusinessReasoningResult } from "../lib/business-knowledge-graph/reasoning.ts";
import type { RecommendationOutcomeSummary } from "../lib/recommendation-outcomes/types.ts";

const NOW = new Date("2026-07-30T00:00:00.000Z");

function makePattern(overrides: Partial<BusinessPattern> = {}): BusinessPattern {
  return {
    id: "pattern-1",
    patternKey: "recommendation_action_outcome:publish_gbp_post",
    statement: "Publish Gbp Post recommendations consistently perform well for your business.",
    direction: "positive",
    confidenceLevel: "high",
    contributingProviders: ["recommendation_outcomes", "recommendation_feedback"],
    evidence: [
      {
        id: "evidence_0",
        sourceProviderId: "recommendation_outcomes",
        sourceLabel: "Recommendation Outcomes",
        summary: "8 Publish Gbp Post recommendations: 7 approved, 0 rejected.",
        occurredAt: NOW.toISOString(),
      },
    ],
    firstObserved: "2026-06-01T00:00:00.000Z",
    lastReinforced: NOW.toISOString(),
    reinforcementCount: 3,
    decayState: "fresh",
    effectiveConfidence: "high",
    ...overrides,
  };
}

function signal(overrides: Partial<LearningSignalInput> & Pick<LearningSignalInput, "sourceProviderId" | "sourceLabel" | "patternKey" | "direction">): LearningSignalInput {
  return {
    statement: "Signal statement.",
    confidence: "medium",
    evidenceSummary: "Signal evidence.",
    occurredAt: NOW.toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// confidence.ts — decay handling + adaptive confidence
// ---------------------------------------------------------------------------

test("computeDecayState: fresh within 30 days, decaying within 90, stale beyond", () => {
  assert.equal(computeDecayState(new Date(NOW.getTime() - 10 * 86400000).toISOString(), NOW), "fresh");
  assert.equal(computeDecayState(new Date(NOW.getTime() - 60 * 86400000).toISOString(), NOW), "decaying");
  assert.equal(computeDecayState(new Date(NOW.getTime() - 120 * 86400000).toISOString(), NOW), "stale");
});

test("applyDecay: stale always drops to low; decaying only demotes high; fresh is unaffected", () => {
  assert.equal(applyDecay("high", "stale"), "low");
  assert.equal(applyDecay("medium", "stale"), "low");
  assert.equal(applyDecay("high", "decaying"), "medium");
  assert.equal(applyDecay("medium", "decaying"), "medium");
  assert.equal(applyDecay("high", "fresh"), "high");
});

test("blendConfidence: never dominates — only nudges up by exactly one tier, only for a real positive pattern", () => {
  const strongPositive = makePattern({ direction: "positive", reinforcementCount: 3, effectiveConfidence: "high" });
  const result = blendConfidence("low", strongPositive);
  assert.equal(result.blended, "medium");
  assert.equal(result.historicalInfluenceApplied, true);

  // Already at the top tier — nothing to nudge into.
  const atCeiling = blendConfidence("high", strongPositive);
  assert.equal(atCeiling.blended, "high");
  assert.equal(atCeiling.historicalInfluenceApplied, false);

  // Thin reinforcement (only 1) never influences, even if positive.
  const thin = makePattern({ direction: "positive", reinforcementCount: 1, effectiveConfidence: "high" });
  const thinResult = blendConfidence("low", thin);
  assert.equal(thinResult.blended, "low");
  assert.equal(thinResult.historicalInfluenceApplied, false);

  // A negative pattern never downgrades current confidence.
  const negative = makePattern({ direction: "negative", reinforcementCount: 5, effectiveConfidence: "high" });
  const negativeResult = blendConfidence("high", negative);
  assert.equal(negativeResult.blended, "high");
  assert.equal(negativeResult.historicalInfluenceApplied, false);

  // No pattern at all — current confidence is untouched.
  const noPattern = blendConfidence("medium", null);
  assert.equal(noPattern.blended, "medium");
  assert.equal(noPattern.historicalInfluenceApplied, false);
});

// ---------------------------------------------------------------------------
// reinforce.ts — pattern reconciliation (Part 2 learning model)
// ---------------------------------------------------------------------------

test("planReinforcement: a brand-new pattern key is queued for creation, not reinforcement", () => {
  const plan = planReinforcement([], [
    signal({ sourceProviderId: "marketing_memory", sourceLabel: "Marketing Memory", patternKey: "marketing_memory:x", direction: "positive" }),
  ]);
  assert.equal(plan.toCreate.length, 1);
  assert.equal(plan.toReinforce.length, 0);
  assert.equal(plan.unchanged.length, 0);
});

test("planReinforcement: two signals for the same brand-new key create once, reinforce is queued for the rest", () => {
  const plan = planReinforcement([], [
    signal({ sourceProviderId: "recommendation_outcomes", sourceLabel: "Recommendation Outcomes", patternKey: "recommendation_action_outcome:x", direction: "positive", evidenceSummary: "first" }),
    signal({ sourceProviderId: "recommendation_feedback", sourceLabel: "Customer Feedback", patternKey: "recommendation_action_outcome:x", direction: "positive", evidenceSummary: "second" }),
  ]);
  assert.equal(plan.toCreate.length, 1);
});

test("planReinforcement: an existing pattern is reinforced when new evidence targets its key", () => {
  const existing = makePattern({ patternKey: "recommendation_action_outcome:x", evidence: [] });
  const plan = planReinforcement([existing], [
    signal({ sourceProviderId: "recommendation_feedback", sourceLabel: "Customer Feedback", patternKey: "recommendation_action_outcome:x", direction: "positive", evidenceSummary: "new evidence" }),
  ]);
  assert.equal(plan.toReinforce.length, 1);
  assert.equal(plan.toCreate.length, 0);
  assert.equal(plan.unchanged.length, 0);
});

test("planReinforcement is idempotent — replaying the exact same signal never double-reinforces", () => {
  const existing = makePattern({
    patternKey: "recommendation_action_outcome:x",
    evidence: [
      { id: "e0", sourceProviderId: "recommendation_outcomes", sourceLabel: "Recommendation Outcomes", summary: "same evidence", occurredAt: NOW.toISOString() },
    ],
  });
  const plan = planReinforcement([existing], [
    signal({ sourceProviderId: "recommendation_outcomes", sourceLabel: "Recommendation Outcomes", patternKey: "recommendation_action_outcome:x", direction: "positive", evidenceSummary: "same evidence" }),
  ]);
  assert.equal(plan.toReinforce.length, 0);
  assert.equal(plan.unchanged.length, 1);
});

test("buildNewPattern: first observation starts with reinforcementCount 1 and decay-adjusted confidence", () => {
  const created = buildNewPattern(
    signal({ sourceProviderId: "marketing_memory", sourceLabel: "Marketing Memory", patternKey: "marketing_memory:x", direction: "positive", confidence: "high", statement: "X performs well." }),
    NOW,
  );
  assert.equal(created.reinforcementCount, 1);
  assert.equal(created.firstObserved, NOW.toISOString());
  assert.equal(created.lastReinforced, NOW.toISOString());
  assert.equal(created.contributingProviders.length, 1);
  assert.equal(created.decayState, "fresh");
  assert.equal(created.effectiveConfidence, "high");
});

test("reinforceExistingPattern: reinforcement count increases, evidence accumulates, confidence never drops from a weaker signal", () => {
  const existing = makePattern({ confidenceLevel: "high", reinforcementCount: 2, evidence: [] });
  const reinforced = reinforceExistingPattern(
    existing,
    signal({ sourceProviderId: "recommendation_feedback", sourceLabel: "Customer Feedback", patternKey: existing.patternKey, direction: "positive", confidence: "low" }),
    NOW,
  );
  assert.equal(reinforced.reinforcementCount, 3);
  assert.equal(reinforced.evidence.length, 1);
  assert.equal(reinforced.confidenceLevel, "high");
  assert.equal(reinforced.contributingProviders.includes("recommendation_feedback"), true);
});

// ---------------------------------------------------------------------------
// lifecycle.ts — recommendation lifecycle states (Part 3)
// ---------------------------------------------------------------------------

function outcome(overrides: Partial<RecommendationOutcomeSummary> = {}): RecommendationOutcomeSummary {
  return {
    recommendationId: "rec-1",
    contentApprovalId: null,
    lifecycleStatus: "awaiting_review",
    draftCreatedAt: NOW.toISOString(),
    wasEdited: false,
    editCount: 0,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    rejectionReasonCode: null,
    publishingJobId: null,
    publishingStatus: null,
    publishedAt: null,
    publishingFailureCategory: null,
    performanceStatus: "not_applicable",
    measuredAt: null,
    performanceMetrics: null,
    usefulnessSignal: "unknown",
    lastEventAt: NOW.toISOString(),
    ...overrides,
  };
}

test("deriveRecommendationLifecycleState: explicit feedback is the most authoritative signal", () => {
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus: "measured" }), isDeferred: false, feedback: "helped" }),
    RecommendationLifecycleStates.SUCCESSFUL,
  );
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus: "measured" }), isDeferred: false, feedback: "not_useful" }),
    RecommendationLifecycleStates.UNSUCCESSFUL,
  );
});

test("deriveRecommendationLifecycleState: no outcome yet at all is suggested", () => {
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: null, isDeferred: false, feedback: null }),
    RecommendationLifecycleStates.SUGGESTED,
  );
});

test("deriveRecommendationLifecycleState: a superseded/dismissed recommendation is retired regardless of stale outcome data", () => {
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "superseded", outcome: outcome({ lifecycleStatus: "awaiting_review" }), isDeferred: false, feedback: null }),
    RecommendationLifecycleStates.RETIRED,
  );
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "dismissed", outcome: null, isDeferred: false, feedback: null }),
    RecommendationLifecycleStates.RETIRED,
  );
});

test("deriveRecommendationLifecycleState: measured outcome without feedback is observed, not a verdict", () => {
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus: "measured" }), isDeferred: false, feedback: null }),
    RecommendationLifecycleStates.OBSERVED,
  );
});

test("deriveRecommendationLifecycleState: published/publishing/queued/failed all present as published", () => {
  for (const lifecycleStatus of ["published", "publishing", "publishing_queued", "publish_failed"] as const) {
    assert.equal(
      deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus }), isDeferred: false, feedback: null }),
      RecommendationLifecycleStates.PUBLISHED,
    );
  }
});

test("deriveRecommendationLifecycleState: rejected, deferred, approved, generated in priority order", () => {
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus: "rejected" as never, rejectedAt: NOW.toISOString() }), isDeferred: true, feedback: null }),
    RecommendationLifecycleStates.REJECTED,
  );
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus: "approved" as never }), isDeferred: true, feedback: null }),
    RecommendationLifecycleStates.DEFERRED,
  );
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus: "approved" as never, approvedAt: NOW.toISOString() }), isDeferred: false, feedback: null }),
    RecommendationLifecycleStates.APPROVED,
  );
  assert.equal(
    deriveRecommendationLifecycleState({ recommendationStatus: "open", outcome: outcome({ lifecycleStatus: "awaiting_review" }), isDeferred: false, feedback: null }),
    RecommendationLifecycleStates.GENERATED,
  );
});

// ---------------------------------------------------------------------------
// adapters — provider-agnostic contract (Part 1/Part 10)
// ---------------------------------------------------------------------------

test("marketingMemoryLearningsToLearningSignals: excludes superseded/archived rows, includes inconclusive honestly", () => {
  const base: MarketingMemoryLearning = {
    id: "l1",
    user_id: "u1",
    business_profile_id: "b1",
    learning_family: "recommendation_action_outcome",
    time_dimension: null,
    subject_key: "publish_gbp_post",
    metric_key: "approval_rate",
    direction: "positive",
    status: "active",
    confidence_level: "strong_pattern",
    confidence_components: {} as never,
    sample_size: 5,
    supporting_count: 4,
    contradicting_count: 1,
    neutral_count: 0,
    excluded_count: 0,
    effect_size: 0.5,
    comparison_baseline: "overall",
    baseline_value: 0.5,
    cohort_value: 0.8,
    first_observed_at: NOW.toISOString(),
    last_observed_at: NOW.toISOString(),
    evaluation_window_days: 30,
    recurrence_pattern: "none",
    seasonal_recurrence_count: 0,
    confounder_codes: [],
    summary: "Publish Gbp Post recommendations perform above baseline.",
    internal_rationale: "internal only",
    learning_key: "b1:recommendation_action_outcome:none:publish_gbp_post:approval_rate",
    superseded_by_learning_id: null,
    schema_version: 1,
    evaluated_at: NOW.toISOString(),
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  };

  const signals = marketingMemoryLearningsToLearningSignals([
    base,
    { ...base, id: "l2", status: "superseded", learning_key: "superseded-key" },
    { ...base, id: "l3", status: "archived", learning_key: "archived-key" },
    { ...base, id: "l4", status: "inconclusive", direction: "inconclusive", learning_key: "inconclusive-key" },
  ]);

  assert.equal(signals.length, 2);
  assert.equal(signals[0]!.confidence, "high");
  assert.equal(signals[0]!.patternKey, `marketing_memory:${base.learning_key}`);
  assert.equal(signals.some((s) => s.direction === "inconclusive"), true);
});

test("actionTypeBreakdownToLearningSignals: never claims a trend below the minimum sample size", () => {
  const thin: ActionTypeOutcomeBreakdown = {
    actionType: "publish_gbp_post",
    sampleSize: 2,
    approvedCount: 2,
    rejectedCount: 0,
    publishedCount: 2,
    dominantRejectionReason: null,
    lastActivityAt: NOW.toISOString(),
  };
  assert.equal(actionTypeBreakdownToLearningSignals([thin]).length, 0);
});

test("actionTypeBreakdownToLearningSignals: high rejection rate produces a negative, evidenced signal", () => {
  const breakdown: ActionTypeOutcomeBreakdown = {
    actionType: "publish_gbp_post",
    sampleSize: 5,
    approvedCount: 1,
    rejectedCount: 4,
    publishedCount: 1,
    dominantRejectionReason: "too_promotional",
    lastActivityAt: NOW.toISOString(),
  };
  const [signalOut] = actionTypeBreakdownToLearningSignals([breakdown]);
  assert.equal(signalOut!.direction, "negative");
  assert.match(signalOut!.statement, /too promotional/);
});

test("actionTypeBreakdownToLearningSignals: high approval + published produces a positive signal", () => {
  const breakdown: ActionTypeOutcomeBreakdown = {
    actionType: "publish_gbp_post",
    sampleSize: 8,
    approvedCount: 7,
    rejectedCount: 1,
    publishedCount: 6,
    dominantRejectionReason: null,
    lastActivityAt: NOW.toISOString(),
  };
  const [signalOut] = actionTypeBreakdownToLearningSignals([breakdown]);
  assert.equal(signalOut!.direction, "positive");
  assert.equal(signalOut!.confidence, "high");
});

test("groupFeedbackEventsByActionType + feedbackBreakdownToLearningSignals: aggregates real feedback into one direction", () => {
  const events: RecommendationFeedbackEvent[] = [
    { id: "f1", recommendationId: "r1", feedback: "helped", comment: null, createdAt: NOW.toISOString() },
    { id: "f2", recommendationId: "r2", feedback: "helped", comment: null, createdAt: NOW.toISOString() },
    { id: "f3", recommendationId: "r3", feedback: "not_useful", comment: null, createdAt: NOW.toISOString() },
  ];
  const grouped = groupFeedbackEventsByActionType(events.map((event) => ({ event, actionType: "publish_gbp_post" })));
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]!.helpedCount, 2);
  assert.equal(grouped[0]!.notUsefulCount, 1);

  const signals = feedbackBreakdownToLearningSignals(grouped);
  assert.equal(signals[0]!.direction, "positive");
  assert.equal(signals[0]!.patternKey, "recommendation_action_outcome:publish_gbp_post");
});

test("businessReasoningToLearningSignals: conclusions become positive signals, conflicts become inconclusive (never negative)", () => {
  const reasoning: BusinessReasoningResult = {
    generatedAt: NOW.toISOString(),
    conclusions: [
      {
        id: "c1",
        entityId: "entity_1",
        statement: '"commercial roofing" is a high-confidence growth opportunity.',
        reasoning: "because...",
        confidence: "high",
        evidence: [],
        contributingProviderCount: 4,
        lastUpdated: NOW.toISOString(),
      },
    ],
    opportunitySignals: [],
    conflicts: [
      {
        id: "conflict_1",
        summary: "We found conflicting signals...",
        recommendation: "Confirm whether...",
        evidenceForA: [],
        evidenceForB: [],
        entityLabelA: "A",
        entityLabelB: "B",
      },
    ],
  };

  const signals = businessReasoningToLearningSignals(reasoning);
  assert.equal(signals.length, 2);
  assert.equal(signals[0]!.direction, "positive");
  assert.equal(signals[1]!.direction, "inconclusive");
  assert.ok(!signals.some((s) => s.direction === "negative"));
});

test("a future provider (no adapter written for it) fuses through the same LearningSignalInput contract with zero engine changes", () => {
  const plan = planReinforcement([], [
    signal({ sourceProviderId: "gbp_insights", sourceLabel: "GBP Insights", patternKey: "recommendation_action_outcome:publish_gbp_post", direction: "positive", statement: "Profile views are up." }),
    signal({ sourceProviderId: "recommendation_outcomes", sourceLabel: "Recommendation Outcomes", patternKey: "recommendation_action_outcome:publish_gbp_post", direction: "positive", statement: "Approved often." }),
  ]);
  assert.equal(plan.toCreate.length, 1);
  const created = buildNewPattern(plan.toCreate[0]!, NOW);
  const reinforced = reinforceExistingPattern({ ...created, id: "p1" }, signal({ sourceProviderId: "recommendation_outcomes", sourceLabel: "Recommendation Outcomes", patternKey: "recommendation_action_outcome:publish_gbp_post", direction: "positive", statement: "Approved often." }), NOW);
  assert.equal(reinforced.contributingProviders.length, 2);
});

// ---------------------------------------------------------------------------
// Growth Advisor + Weekly Growth Plan integration (Part 5/Part 6)
// ---------------------------------------------------------------------------

test("historicalContextFromPattern: cites the pattern and explains why, only once genuinely reinforced", () => {
  assert.equal(historicalContextFromPattern(null), null);
  assert.equal(historicalContextFromPattern(makePattern({ reinforcementCount: 1 })), null);
  assert.equal(historicalContextFromPattern(makePattern({ direction: "inconclusive" })), null);

  const context = historicalContextFromPattern(makePattern({ reinforcementCount: 3, contributingProviders: ["a", "b"] }));
  assert.match(context!, /consistently perform well/);
  assert.match(context!, /3 times/);
  assert.match(context!, /2 sources/);
});

test("buildHistoricalContext: shown separately from current evidence, never fabricated from a thin pattern", () => {
  assert.deepEqual(buildHistoricalContext(null), []);
  assert.deepEqual(buildHistoricalContext(makePattern({ reinforcementCount: 1 })), []);

  const [item] = buildHistoricalContext(makePattern());
  assert.equal(item!.source, "business_learning_engine");
  assert.equal(item!.statement, makePattern().statement);
});

// ---------------------------------------------------------------------------
// Learning Maturity (Part 7)
// ---------------------------------------------------------------------------

test("computeLearningMaturity scores higher with more patterns, outcome coverage, and feedback", () => {
  const rich = computeLearningMaturity({
    patterns: [makePattern(), makePattern({ id: "p2", patternKey: "marketing_memory:x" })],
    totalWithOutcome: 8,
    totalRecommendations: 10,
    feedbackCount: 4,
    publishedOrMeasuredCount: 5,
    now: NOW,
  });
  const thin = computeLearningMaturity({
    patterns: [],
    totalWithOutcome: 0,
    totalRecommendations: 10,
    feedbackCount: 0,
    publishedOrMeasuredCount: 0,
    now: NOW,
  });

  assert.ok(rich.overallScore > thin.overallScore);
  assert.equal(thin.dimensions.learningDepth.score, 0);
  assert.equal(thin.dimensions.recommendationFeedbackRate.score, 0);
  for (const dimension of Object.values(rich.dimensions)) {
    assert.ok(dimension.improvementTip.length > 0);
  }
});

test("summarizeOutcomeBreakdown: real totals derived from the breakdown, never a second fetch", () => {
  const breakdowns: ActionTypeOutcomeBreakdown[] = [
    { actionType: "a", sampleSize: 5, approvedCount: 4, rejectedCount: 1, publishedCount: 3, dominantRejectionReason: null, lastActivityAt: null },
    { actionType: "b", sampleSize: 3, approvedCount: 2, rejectedCount: 1, publishedCount: 1, dominantRejectionReason: null, lastActivityAt: null },
  ];
  const summary = summarizeOutcomeBreakdown(breakdowns);
  assert.equal(summary.totalWithOutcome, 8);
  assert.equal(summary.publishedOrMeasuredCount, 4);
});

// ---------------------------------------------------------------------------
// Business Timeline (Part 8)
// ---------------------------------------------------------------------------

test("buildBusinessTimeline: sorts chronologically, caps entries, and never fabricates a learning claim", () => {
  const entries = buildBusinessTimeline({
    recommendationOutcomeEvents: [
      {
        event: {
          id: "e1",
          user_id: "u1",
          business_profile_id: "b1",
          recommendation_id: "r1",
          content_approval_id: null,
          publishing_job_id: null,
          event_type: "publishing_succeeded",
          event_version: 1,
          source: "test",
          idempotency_key: "k1",
          metadata: {},
          created_at: "2026-07-01T00:00:00.000Z",
        },
        actionType: "publish_gbp_post",
      },
    ],
    campaigns: [],
    smartUploadDocuments: [
      {
        id: "doc-1",
        user_id: "u1",
        business_profile_id: "b1",
        file_name: "brochure.pdf",
        file_type: "pdf",
        storage_path: "path",
        file_size_bytes: 100,
        status: "extracted",
        extraction_error: null,
        fact_count: 3,
        uploaded_at: "2026-07-02T00:00:00.000Z",
        processed_at: "2026-07-02T01:00:00.000Z",
        created_at: "2026-07-02T00:00:00.000Z",
        updated_at: "2026-07-02T01:00:00.000Z",
      } as never,
    ],
    externalIntelligence: null,
    customerVoice: null,
    learningPatterns: [makePattern({ firstObserved: "2026-07-15T00:00:00.000Z" })],
  });

  assert.equal(entries.length, 3);
  // Newest first.
  assert.equal(entries[0]!.type, "learning_milestone");
  assert.equal(entries[0]!.whatDidAILearn, makePattern().statement);
  assert.ok(entries.every((e) => typeof e.whatChanged === "string" && e.whatChanged.length > 0));
});
