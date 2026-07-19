import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  buildMonthlyExecutiveReport,
  buildMorningBrief,
  buildWeeklyStrategyBrief,
} from "../lib/executive-briefing/buildBrief.ts";
import { buildExecutiveHeadline } from "../lib/executive-briefing/headlines.ts";
import {
  ExecutiveBriefTypes,
  EXECUTIVE_BRIEF_FUTURE_DELIVERY_HOOKS,
} from "../lib/executive-briefing/types.ts";
import { resolveMarketingDirectorDecision } from "../lib/marketing-director/resolveDecision.ts";
import type { MarketingDirectorDecision, MarketingDirectorInput } from "../lib/marketing-director/types.ts";
import type { MarketingMemoryEvidencePackage } from "../lib/marketing-memory/evidenceTypes.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-07-18T14:00:00.000Z");
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

function decision(overrides: Partial<MarketingDirectorInput> = {}): MarketingDirectorDecision {
  return resolveMarketingDirectorDecision(mdInput(overrides), NOW);
}

function memoryPresent(): MarketingMemoryEvidencePackage {
  return {
    businessProfileId: "biz-1",
    preferences: [
      {
        id: "p1",
        preferenceType: "publishing_day_restriction",
        factorType: "day_of_week",
        factorValue: "sunday",
        instructionText: "Avoid publishing on Sundays.",
        source: "explicit_statement",
        activeUntil: null,
      },
    ],
    learnings: [
      {
        id: "l1",
        learningFamily: "recommendation_action_outcome",
        subjectKey: "request_reviews",
        timeDimension: null,
        direction: "positive",
        confidenceLevel: "strong_pattern",
        status: "active",
        summary: "Review requests have historically been approved more often.",
      },
    ],
    ignoredLearnings: [],
    ignoredPreferences: [],
    disabledContextTypes: [],
    marketContextSignals: [{ id: "c1", category: "holiday", title: "Labor Day approaching" }],
    activeGoals: ["More reviews"],
    isColdStart: false,
    evaluatedAt: NOW.toISOString(),
  };
}

function briefBase(overrides: Record<string, unknown> = {}) {
  const d = decision(
    (overrides.decisionInput as Partial<MarketingDirectorInput> | undefined) ?? {},
  );
  return {
    decision: d,
    healthState: "healthy" as const,
    weeklyWins: emptyWins,
    pendingApprovals: 0,
    unansweredReviews: 0,
    openRecommendations: 0,
    publishingReadyOrScheduled: 0,
    seasonalHint: null as string | null,
    gbpConnected: true,
    focusTheme: "improving local visibility",
    businessName: "Acme Plumbing",
    candidateRecommendations: [] as [],
    memoryEvidence: null as MarketingMemoryEvidencePackage | null,
    thisWeekHandled: [] as string[],
    noticed: [] as string[],
    now: NOW,
    ...overrides,
    decision: (overrides.decision as MarketingDirectorDecision | undefined) ?? d,
  };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Executive Briefing Engine", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("empty / quiet business: calm morning brief", () => {
  const brief = buildMorningBrief(briefBase());
  assert.equal(brief.briefType, ExecutiveBriefTypes.MORNING);
  assert.match(brief.headline, /on track|nothing urgent/i);
  assert.ok(brief.summary.length > 20);
  assert.ok(brief.topPriorities.length >= 1);
  assert.ok(brief.wins.length >= 1);
  assert.ok(brief.watchItems.length >= 1);
  assert.doesNotMatch(brief.summary, /Weight |confidence coefficient/i);
});

test("pending approvals and review activity shape headline and watch items", () => {
  const approvals = buildMorningBrief(
    briefBase({
      decision: decision({ pendingApprovals: 3 }),
      pendingApprovals: 3,
    }),
  );
  assert.match(approvals.headline, /opinion/i);
  assert.ok(approvals.watchItems.some((item) => /approval/i.test(item.text)));

  const reviews = buildMorningBrief(
    briefBase({
      decision: decision({ unansweredReviews: 2 }),
      unansweredReviews: 2,
    }),
  );
  assert.match(reviews.headline, /Reviews need attention/i);
});

test("many recommendations vs none", () => {
  const many = buildMorningBrief(
    briefBase({
      decision: decision({
        openRecommendations: 4,
        candidateRecommendations: [
          {
            id: "r1",
            actionTypeLabel: "Request reviews",
            actionType: "request_reviews",
            status: "open",
            urgency: "high",
          },
          {
            id: "r2",
            actionTypeLabel: "Upload photos",
            actionType: "upload_photos",
            status: "open",
            urgency: "medium",
          },
        ],
      }),
      openRecommendations: 4,
      candidateRecommendations: [
        {
          id: "r1",
          actionTypeLabel: "Request reviews",
          actionType: "request_reviews",
          status: "open",
          urgency: "high",
        },
      ],
    }),
  );
  assert.ok(many.today.some((item) => /recommendation/i.test(item.text)));
  assert.ok(
    many.supportingEvidence.some((item) => item.kind === "pending_recommendation"),
  );

  const none = buildMorningBrief(briefBase({ openRecommendations: 0 }));
  assert.ok(!none.supportingEvidence.some((item) => item.kind === "pending_recommendation"));
});

test("market context present and absent", () => {
  const withCtx = buildMorningBrief(
    briefBase({
      memoryEvidence: memoryPresent(),
      seasonalHint: "Labor Day (September)",
      decision: decision({ seasonalHint: "Labor Day (September)" }),
    }),
  );
  assert.ok(withCtx.supportingEvidence.some((item) => item.kind === "market_context"));
  assert.ok(withCtx.recentChanges.some((item) => /Market context/i.test(item.text)));

  const without = buildMorningBrief(briefBase({ memoryEvidence: null }));
  assert.ok(!without.supportingEvidence.some((item) => item.kind === "market_context"));
});

test("memory present includes preferences and learnings; absent stays cold", () => {
  const withMemory = buildMorningBrief(briefBase({ memoryEvidence: memoryPresent() }));
  assert.ok(withMemory.supportingEvidence.some((item) => item.kind === "active_preference"));
  assert.ok(withMemory.supportingEvidence.some((item) => item.kind === "historical_learning"));
  assert.match(withMemory.summary, /preferences|learned/i);

  const without = buildMorningBrief(briefBase({ memoryEvidence: null }));
  assert.ok(!without.supportingEvidence.some((item) => item.kind === "active_preference"));
});

test("deterministic: identical inputs produce identical briefs", () => {
  const input = briefBase({
    weeklyWins: { ...emptyWins, reviews: 2, views: 55 },
    publishingReadyOrScheduled: 2,
    thisWeekHandled: ["Prepared content for the week ahead."],
  });
  assert.deepEqual(buildMorningBrief(input), buildMorningBrief(input));
  assert.deepEqual(buildWeeklyStrategyBrief(input), buildWeeklyStrategyBrief(input));
  assert.deepEqual(buildMonthlyExecutiveReport(input), buildMonthlyExecutiveReport(input));
});

test("all three brief types are supported with distinct briefType", () => {
  const input = briefBase();
  assert.equal(buildMorningBrief(input).briefType, ExecutiveBriefTypes.MORNING);
  assert.equal(
    buildWeeklyStrategyBrief(input).briefType,
    ExecutiveBriefTypes.WEEKLY_STRATEGY,
  );
  assert.equal(
    buildMonthlyExecutiveReport(input).briefType,
    ExecutiveBriefTypes.MONTHLY_EXECUTIVE,
  );
  assert.match(buildWeeklyStrategyBrief(input).summary, /weekly/i);
  assert.match(buildMonthlyExecutiveReport(input).summary, /monthly/i);
});

test("headline rules stay deterministic and MD-aligned", () => {
  assert.match(
    buildExecutiveHeadline({
      decision: decision({ gbpConnected: false }),
      healthState: "healthy",
      weeklyWins: emptyWins,
      pendingApprovals: 0,
      unansweredReviews: 0,
      openRecommendations: 0,
      seasonalHint: null,
      gbpConnected: false,
    }),
    /Google connection/i,
  );
  assert.match(
    buildExecutiveHeadline({
      decision: decision({ unansweredReviews: 1 }),
      healthState: "healthy",
      weeklyWins: emptyWins,
      pendingApprovals: 0,
      unansweredReviews: 1,
      openRecommendations: 0,
      seasonalHint: null,
      gbpConnected: true,
    }),
    /Reviews need attention/i,
  );
});

test("Weekly Briefing attaches morning brief and all three variants from one MD decision", () => {
  const briefing = buildWeeklyBriefing({
    userName: "Sean",
    businessName: "Acme",
    websiteUrl: null,
    voiceNotes: null,
    profileCreatedAt: "2026-01-01T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 1,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 0,
    businessHealth: {
      overall: 70,
      seo: 70,
      google: 70,
      reviews: 70,
      content: 70,
      consistency: 70,
    },
    weeklyWins: emptyWins,
    planSummary: null,
    marketingThemes: [],
    businessGoals: [],
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    now: NOW,
  });

  assert.equal(briefing.executiveBrief.briefType, ExecutiveBriefTypes.MORNING);
  assert.equal(briefing.executiveBriefs.morning.headline, briefing.executiveBrief.headline);
  assert.equal(
    briefing.executiveBriefs.weeklyStrategy.briefType,
    ExecutiveBriefTypes.WEEKLY_STRATEGY,
  );
  assert.equal(
    briefing.executiveBriefs.monthlyExecutive.briefType,
    ExecutiveBriefTypes.MONTHLY_EXECUTIVE,
  );
  // Priorities explain MD — same CTA label
  assert.equal(
    briefing.executiveBrief.topPriorities[0]?.text,
    briefing.primaryAction.label,
  );
});

test("no LLM/ML/providers/cron; future delivery hooks reserved", () => {
  for (const relative of [
    "lib/executive-briefing/buildBrief.ts",
    "lib/executive-briefing/headlines.ts",
    "lib/executive-briefing/service.ts",
  ]) {
    const source = readFileSync(join(root, relative), "utf8");
    assert.doesNotMatch(source, /from ["']openai["']|@anthropic/i);
    assert.doesNotMatch(source, /schedules\.task|ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*true/);
  }
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
  assert.ok(EXECUTIVE_BRIEF_FUTURE_DELIVERY_HOOKS.some((hook) => hook.channel === "email"));
  assert.ok(
    EXECUTIVE_BRIEF_FUTURE_DELIVERY_HOOKS.filter((hook) => hook.channel !== "in_app").every(
      (hook) => hook.implemented === false,
    ),
  );
});

test("dashboard card uses details disclosure and refresh control", () => {
  const source = readFileSync(
    join(root, "components/dashboard/executive-brief-section.tsx"),
    "utf8",
  );
  assert.match(source, /<details/);
  assert.match(source, /Show brief details/);
  assert.match(source, /Refresh/);
  assert.match(source, /aria-labelledby/);
  assert.match(source, /hom-focusable/);

  const page = readFileSync(
    join(root, "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  assert.match(page, /ExecutiveBriefSection/);
});
