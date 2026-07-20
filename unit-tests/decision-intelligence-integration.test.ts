import assert from "node:assert/strict";
import test from "node:test";
import { classifyInteractiveHomQuestion } from "../lib/interactive-hom/classifyQuestion.ts";
import { answerInteractiveHomQuestion } from "../lib/interactive-hom/answerEngine.ts";
import { InteractiveHomQuestionCategories } from "../lib/interactive-hom/types.ts";
import { normalizeDecisionIntelligenceEvents } from "../lib/strategic-marketing-calendar/calendar-normalizers.ts";
import { StrategicCalendarCategories, StrategicCalendarSourceTypes } from "../lib/strategic-marketing-calendar/calendar-types.ts";
import type { InteractiveHomGroundedContext } from "../lib/interactive-hom/types.ts";

function baseContext(overrides: Partial<InteractiveHomGroundedContext> = {}): InteractiveHomGroundedContext {
  return {
    businessName: "Test Biz",
    health: { state: "healthy", label: "Healthy", detail: "" } as never,
    primaryAction: { kind: "review_week", label: "Review", href: "/dashboard" },
    recommendation: null,
    thisWeek: [],
    noticed: [],
    nextWeek: [],
    monthlyFocus: {} as never,
    executiveBrief: { watchItems: [] } as never,
    campaigns: [],
    preferences: [],
    learnings: [],
    marketContextSignals: [],
    memoryColdStart: true,
    pendingApprovals: 0,
    openRecommendations: 0,
    unansweredReviews: 0,
    publishFailures: 0,
    decisionIntelligence: null,
    ...overrides,
  };
}

// --- Classification ----------------------------------------------------------------------

test("classifyInteractiveHomQuestion: recognizes each new Decision Intelligence question category", () => {
  assert.equal(classifyInteractiveHomQuestion("Why did the plan change?"), InteractiveHomQuestionCategories.WHY_PLAN_CHANGED);
  assert.equal(classifyInteractiveHomQuestion("Did this experiment change anything?"), InteractiveHomQuestionCategories.EXPERIMENT_IMPACT);
  assert.equal(classifyInteractiveHomQuestion("Which customer preferences affected the plan?"), InteractiveHomQuestionCategories.PREFERENCE_IMPACT);
  assert.equal(classifyInteractiveHomQuestion("What evidence was ignored?"), InteractiveHomQuestionCategories.IGNORED_EVIDENCE);
  assert.equal(classifyInteractiveHomQuestion("Did this campaign affect future decisions?"), InteractiveHomQuestionCategories.CAMPAIGN_IMPACT);
  assert.equal(classifyInteractiveHomQuestion("Why was this recommendation deprioritized?"), InteractiveHomQuestionCategories.WHY_DEPRIORITIZED);
});

// --- Answers: insufficient-data honesty without decision intelligence --------------------

test("answerInteractiveHomQuestion: without decision intelligence, every new category discloses insufficient data rather than guessing", () => {
  const ctx = baseContext();
  const categories = [
    InteractiveHomQuestionCategories.WHY_PLAN_CHANGED,
    InteractiveHomQuestionCategories.EXPERIMENT_IMPACT,
    InteractiveHomQuestionCategories.PREFERENCE_IMPACT,
    InteractiveHomQuestionCategories.IGNORED_EVIDENCE,
    InteractiveHomQuestionCategories.CAMPAIGN_IMPACT,
    InteractiveHomQuestionCategories.WHY_DEPRIORITIZED,
  ];
  for (const category of categories) {
    const answer = answerInteractiveHomQuestion(category, ctx);
    assert.equal(answer.insufficientData, true, category);
    assert.equal(answer.grounded, false, category);
  }
});

test("answerInteractiveHomQuestion: WHY_PLAN_CHANGED is grounded once a comparison exists", () => {
  const ctx = baseContext({
    decisionIntelligence: {
      currentDecision: null,
      currentPriorities: [],
      comparison: {
        previousDecisionId: "p1",
        currentDecisionId: "c1",
        changeType: "unchanged",
        rankChanged: false,
        previousRank: 1,
        currentRank: 1,
        statusChanged: false,
        actionChanged: false,
        evidenceAdded: [],
        evidenceRemoved: [],
        evidenceSuperseded: [],
        preferenceImpact: false,
        overrideImpact: false,
        experimentImpact: false,
        campaignImpact: false,
        analyticsImpact: false,
        explanation: "Nothing changed since the previous decision.",
        certainty: "explicit_trace",
        limitations: [],
      },
      learningImpact: [],
      timeline: [],
      limitations: [],
      warnings: [],
      generatedAt: "2026-07-19T00:00:00.000Z",
    },
  });
  const answer = answerInteractiveHomQuestion(InteractiveHomQuestionCategories.WHY_PLAN_CHANGED, ctx);
  assert.equal(answer.grounded, true);
  assert.equal(answer.answer, "Nothing changed since the previous decision.");
});

test("answerInteractiveHomQuestion answers are deterministic for identical context", () => {
  const ctx = baseContext();
  const first = answerInteractiveHomQuestion(InteractiveHomQuestionCategories.IGNORED_EVIDENCE, ctx);
  const second = answerInteractiveHomQuestion(InteractiveHomQuestionCategories.IGNORED_EVIDENCE, ctx);
  assert.deepEqual(first, second);
});

// --- Calendar normalizer -------------------------------------------------------------------

test("normalizeDecisionIntelligenceEvents: uses the dedicated category, never a scheduled-work category", () => {
  const range = {
    businessProfileId: "biz-1",
    rangeStart: "2026-07-19",
    rangeEnd: "2026-07-25",
    timezone: "UTC",
    todayKey: "2026-07-19",
  };
  const events = normalizeDecisionIntelligenceEvents(
    [{ id: "e1", type: "decision_generated", occurredAt: "2026-07-20T12:00:00.000Z", title: "Decision", description: "x", sourceTarget: null }],
    range,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.category, StrategicCalendarCategories.DECISION_INTELLIGENCE);
  assert.equal(events[0]!.sourceType, StrategicCalendarSourceTypes.DECISION_INTELLIGENCE);
  assert.equal(events[0]!.actionRequired, false);
  assert.notEqual(events[0]!.category, StrategicCalendarCategories.PUBLISHING);
});

test("normalizeDecisionIntelligenceEvents: undefined/missing input never throws (defensive against missing source)", () => {
  const range = {
    businessProfileId: "biz-1",
    rangeStart: "2026-07-19",
    rangeEnd: "2026-07-25",
    timezone: "UTC",
    todayKey: "2026-07-19",
  };
  assert.doesNotThrow(() => normalizeDecisionIntelligenceEvents(undefined, range));
  assert.doesNotThrow(() => normalizeDecisionIntelligenceEvents(null, range));
});

test("normalizeDecisionIntelligenceEvents: events outside the range are excluded", () => {
  const range = {
    businessProfileId: "biz-1",
    rangeStart: "2026-07-19",
    rangeEnd: "2026-07-25",
    timezone: "UTC",
    todayKey: "2026-07-19",
  };
  const events = normalizeDecisionIntelligenceEvents(
    [{ id: "e1", type: "decision_generated", occurredAt: "2026-01-01T00:00:00.000Z", title: "Old", description: "x", sourceTarget: null }],
    range,
  );
  assert.equal(events.length, 0);
});
