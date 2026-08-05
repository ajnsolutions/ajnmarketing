import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketRadarHighlights,
  buildMonthlyExecutiveReport,
  buildMorningBrief,
  buildWeeklyStrategyBrief,
  type BuildExecutiveBriefInput,
} from "../lib/executive-briefing/buildBrief.ts";
import { ExecutiveBriefTypes } from "../lib/executive-briefing/types.ts";
import { resolveMarketingDirectorDecision } from "../lib/marketing-director/resolveDecision.ts";
import type { MarketingDirectorInput } from "../lib/marketing-director/types.ts";
import type { CompetitorObservation } from "../lib/competitor-observations/types.ts";

const NOW = new Date("2026-08-05T14:00:00.000Z");
const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };

function mdInput(overrides: Partial<MarketingDirectorInput> = {}): MarketingDirectorInput {
  return {
    gbpConnected: true,
    pendingApprovals: 0,
    unansweredReviews: 0,
    openRecommendations: 0,
    publishingReadyOrScheduled: 0,
    healthState: "healthy",
    weeklyWins: emptyWins,
    seasonalHint: null,
    focusTheme: "improving local visibility",
    isEarlyCustomer: false,
    candidateRecommendations: [],
    topRecommendationDetail: null,
    memoryEvidence: null,
    ...overrides,
  };
}

function observation(overrides: Partial<CompetitorObservation> = {}): CompetitorObservation {
  return {
    id: "obs-1",
    userId: "user-1",
    businessProfileId: "biz-1",
    marketRadarEntryId: "entry-1",
    summary: "A competitor updated their public pricing page.",
    confidence: "medium",
    sourceLabel: "AJN Market Context (competitor)",
    occurredAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function briefInput(overrides: Partial<BuildExecutiveBriefInput> = {}): BuildExecutiveBriefInput {
  const decision = resolveMarketingDirectorDecision(mdInput(), NOW);
  return {
    briefType: ExecutiveBriefTypes.WEEKLY_STRATEGY,
    decision,
    healthState: "healthy",
    weeklyWins: emptyWins,
    pendingApprovals: 0,
    unansweredReviews: 0,
    openRecommendations: 0,
    publishingReadyOrScheduled: 0,
    seasonalHint: null,
    gbpConnected: true,
    focusTheme: "improving local visibility",
    businessName: "Acme Plumbing",
    candidateRecommendations: [],
    memoryEvidence: null,
    thisWeekHandled: [],
    noticed: [],
    now: NOW,
    ...overrides,
  };
}

test("buildMarketRadarHighlights returns [] for morning brief and monthly report even when observations are provided", () => {
  const observations = [observation()];
  assert.deepEqual(
    buildMarketRadarHighlights(
      briefInput({ briefType: ExecutiveBriefTypes.MORNING, marketRadarObservations: observations }),
    ),
    [],
  );
  assert.deepEqual(
    buildMarketRadarHighlights(
      briefInput({
        briefType: ExecutiveBriefTypes.MONTHLY_EXECUTIVE,
        marketRadarObservations: observations,
      }),
    ),
    [],
  );
});

test("buildMarketRadarHighlights returns [] for weekly brief when observations are absent or empty", () => {
  assert.deepEqual(buildMarketRadarHighlights(briefInput()), []);
  assert.deepEqual(
    buildMarketRadarHighlights(briefInput({ marketRadarObservations: [] })),
    [],
  );
});

test("buildMarketRadarHighlights maps a populated list, preserving confidence", () => {
  const observations = [
    observation({ id: "obs-high", summary: "Competitor launched a new location.", confidence: "high" }),
    observation({ id: "obs-medium", summary: "Competitor changed their hours.", confidence: "medium" }),
    observation({ id: "obs-low", summary: "Competitor mentioned a promotion.", confidence: "low" }),
  ];

  const highlights = buildMarketRadarHighlights(
    briefInput({ marketRadarObservations: observations }),
  );

  assert.equal(highlights.length, 3);
  assert.deepEqual(
    highlights.map((h) => h.observation),
    observations.map((o) => o.summary),
  );
  assert.deepEqual(
    highlights.map((h) => h.confidence),
    ["high", "medium", "low"],
  );
  for (const highlight of highlights) {
    assert.ok(highlight.whyItMatters.length > 0);
    assert.ok(highlight.suggestedAction.length > 0);
  }
});

test("buildMarketRadarHighlights never fabricates a suggested action unrelated to the observation", () => {
  const observations = [
    observation({ summary: "Competitor added a new service line.", confidence: "medium" }),
  ];
  const [highlight] = buildMarketRadarHighlights(
    briefInput({ marketRadarObservations: observations }),
  );

  // Medium/low confidence gets the calm, generic-but-honest fallback rather than
  // an invented specific — never text that pretends to know something about the
  // observation's content that scoring.ts's summary field didn't actually say.
  assert.equal(highlight!.suggestedAction, "Review this observation before your next planning session.");
  assert.doesNotMatch(highlight!.suggestedAction, /service line/i);
});

test("buildMarketRadarHighlights is deterministic for identical input", () => {
  const observations = [observation()];
  const input = briefInput({ marketRadarObservations: observations });
  assert.deepEqual(buildMarketRadarHighlights(input), buildMarketRadarHighlights(input));
});

test("buildWeeklyStrategyBrief wires marketRadarHighlights into the full brief; other brief types stay empty", () => {
  const observations = [observation({ confidence: "high" })];
  const input = briefInput({ marketRadarObservations: observations });

  const weekly = buildWeeklyStrategyBrief(input);
  assert.equal(weekly.marketRadarHighlights.length, 1);
  assert.equal(weekly.marketRadarHighlights[0]?.confidence, "high");

  const morning = buildMorningBrief(input);
  assert.deepEqual(morning.marketRadarHighlights, []);

  const monthly = buildMonthlyExecutiveReport(input);
  assert.deepEqual(monthly.marketRadarHighlights, []);
});

test("marketRadarHighlights is always present (never omitted), even with no observations", () => {
  const weekly = buildWeeklyStrategyBrief(briefInput());
  assert.ok(Array.isArray(weekly.marketRadarHighlights));
  assert.deepEqual(weekly.marketRadarHighlights, []);
});
