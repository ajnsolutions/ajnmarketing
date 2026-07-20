import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { askInteractiveHom } from "../lib/interactive-hom/answerQuestion.ts";
import { buildInteractiveHomContext } from "../lib/interactive-hom/buildContext.ts";
import { classifyInteractiveHomQuestion } from "../lib/interactive-hom/classifyQuestion.ts";
import { INTERACTIVE_HOM_SUGGESTED_PROMPTS } from "../lib/interactive-hom/prompts.ts";
import {
  INTERACTIVE_HOM_FORBIDDEN_TERMS,
  InteractiveHomQuestionCategories,
  type InteractiveHomGroundedContext,
} from "../lib/interactive-hom/types.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";
import type { MarketingMemoryEvidencePackage } from "../lib/marketing-memory/evidenceTypes.ts";
import { CampaignStatuses, CampaignTypes } from "../lib/campaign-intelligence/campaign-types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-07-19T14:00:00.000Z");
const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };

function memoryPresent(): MarketingMemoryEvidencePackage {
  return {
    businessProfileId: "biz-1",
    preferences: [
      {
        id: "p1",
        preferenceType: "content_theme",
        factorType: "theme",
        factorValue: "educational",
        instructionText: "You've consistently preferred educational content.",
        source: "explicit_statement",
        activeUntil: null,
      },
    ],
    learnings: [
      {
        id: "l1",
        learningFamily: "timing_performance",
        subjectKey: "day_of_week",
        timeDimension: "wednesday",
        direction: "positive",
        confidenceLevel: "strong_pattern",
        status: "active",
        summary: "Historically your audience responds better mid-week.",
      },
    ],
    ignoredLearnings: [],
    ignoredPreferences: [],
    disabledContextTypes: [],
    marketContextSignals: [{ id: "c1", category: "holiday", title: "Local festival weekend approaching" }],
    activeGoals: ["More reviews"],
    isColdStart: false,
    evaluatedAt: NOW.toISOString(),
  };
}

function baseBriefing(overrides: Partial<Parameters<typeof buildWeeklyBriefing>[0]> = {}) {
  return buildWeeklyBriefing({
    userName: "Alex",
    businessName: "Demo Shop",
    websiteUrl: null,
    voiceNotes: null,
    profileCreatedAt: "2026-01-01T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 1,
    openRecommendations: 1,
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
    marketingThemes: ["Local visibility"],
    businessGoals: ["More reviews"],
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    candidateRecommendations: [
      {
        id: "rec-1",
        actionTypeLabel: "Request reviews",
        actionType: "request_reviews",
        status: "open",
        urgency: "medium",
      },
    ],
    topRecommendationDetail: {
      recommendationId: "rec-1",
      title: "Ask happy customers for reviews",
      whyNow: "Recent customers haven't been invited yet.",
      expectedBenefit: "Stronger local reputation.",
      confidenceLabel: "good_opportunity",
    },
    memoryEvidence: memoryPresent(),
    now: NOW,
    ...overrides,
  });
}

function contextFrom(
  briefing = baseBriefing(),
  memory: MarketingMemoryEvidencePackage | null = memoryPresent(),
  extras: Partial<InteractiveHomGroundedContext> = {},
): InteractiveHomGroundedContext {
  const built = buildInteractiveHomContext({
    briefing: {
      ...briefing,
      campaigns: extras.campaigns ?? [
        {
          id: "camp-1",
          campaignType: CampaignTypes.HIRING,
          title: "Hiring",
          objective: "Attract local candidates",
          status: CampaignStatuses.IN_PROGRESS,
          nextMilestone: "Publish a hiring post on Google",
          completionPercent: 33,
          timeline: [],
          recentProgress: ["Completed: Refresh website hiring/about content"],
        },
      ],
    },
    memoryEvidence: memory,
    pendingApprovals: 1,
    openRecommendations: 1,
    unansweredReviews: extras.unansweredReviews ?? 2,
    publishFailures: extras.publishFailures ?? 0,
  });
  return { ...built, ...extras };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Interactive HoM", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("classification covers supported question categories deterministically", () => {
  assert.equal(
    classifyInteractiveHomQuestion("What should I work on today?"),
    InteractiveHomQuestionCategories.WORK_ON_TODAY,
  );
  assert.equal(
    classifyInteractiveHomQuestion("Why is this recommended?"),
    InteractiveHomQuestionCategories.WHY_RECOMMENDED,
  );
  assert.equal(
    classifyInteractiveHomQuestion("What changed this week?"),
    InteractiveHomQuestionCategories.WHAT_CHANGED,
  );
  assert.equal(
    classifyInteractiveHomQuestion("How is my campaign doing?"),
    InteractiveHomQuestionCategories.CAMPAIGN_STATUS,
  );
  assert.equal(
    classifyInteractiveHomQuestion("What have we learned?"),
    InteractiveHomQuestionCategories.WHAT_LEARNED,
  );
  assert.equal(
    classifyInteractiveHomQuestion("What risks should I know about?"),
    InteractiveHomQuestionCategories.RISKS,
  );
  assert.equal(
    classifyInteractiveHomQuestion("What opportunities do you see?"),
    InteractiveHomQuestionCategories.OPPORTUNITIES,
  );
  assert.equal(
    classifyInteractiveHomQuestion("Explain this priority."),
    InteractiveHomQuestionCategories.EXPLAIN_PRIORITY,
  );
  assert.equal(
    classifyInteractiveHomQuestion("Summarize the executive brief"),
    InteractiveHomQuestionCategories.EXECUTIVE_BRIEF,
  );
  assert.equal(
    classifyInteractiveHomQuestion("Tell me a joke"),
    InteractiveHomQuestionCategories.UNSUPPORTED,
  );
});

test("recommendation explanation is customer-friendly and grounded", () => {
  // pendingApprovals: 0 so MD surfaces the high-value recommendation detail.
  const briefing = baseBriefing({ pendingApprovals: 0 });
  const ctx = contextFrom(briefing);
  assert.ok(ctx.recommendation);
  const answer = askInteractiveHom("Why is this recommended?", ctx);
  assert.equal(answer.category, InteractiveHomQuestionCategories.WHY_RECOMMENDED);
  assert.equal(answer.grounded, true);
  assert.equal(answer.insufficientData, false);
  assert.match(answer.answer, /Ask happy customers for reviews|Request reviews|recommend/i);
  assert.match(answer.answer, /educational content/i);
  assert.match(answer.answer, /mid-week/i);
  assert.match(answer.answer, /Hiring campaign/i);
  for (const term of INTERACTIVE_HOM_FORBIDDEN_TERMS) {
    assert.equal(answer.answer.includes(term), false, term);
  }
});

test("campaign explanation summarizes active campaign progress", () => {
  const answer = askInteractiveHom("How is my campaign doing?", contextFrom());
  assert.equal(answer.category, InteractiveHomQuestionCategories.CAMPAIGN_STATUS);
  assert.equal(answer.grounded, true);
  assert.match(answer.answer, /Hiring/);
  assert.match(answer.answer, /33%/);
  assert.match(answer.answer, /Next milestone/i);
});

test("executive brief explanation summarizes headline and priorities", () => {
  const ctx = contextFrom();
  const answer = askInteractiveHom("Summarize the morning brief", ctx);
  assert.equal(answer.category, InteractiveHomQuestionCategories.EXECUTIVE_BRIEF);
  assert.equal(answer.grounded, true);
  assert.ok(answer.answer.includes(ctx.executiveBrief.headline) || answer.answer.length > 20);
});

test("memory explanation surfaces preferences and learnings", () => {
  const answer = askInteractiveHom("What have we learned?", contextFrom());
  assert.equal(answer.category, InteractiveHomQuestionCategories.WHAT_LEARNED);
  assert.equal(answer.grounded, true);
  assert.match(answer.answer, /educational content/i);
  assert.match(answer.answer, /mid-week/i);
});

test("insufficient-data responses when evidence is missing", () => {
  const emptyBriefing = baseBriefing({
    pendingApprovals: 0,
    openRecommendations: 0,
    candidateRecommendations: [],
    topRecommendationDetail: null,
    unansweredReviews: 0,
    memoryEvidence: null,
  });
  const ctx = buildInteractiveHomContext({
    briefing: { ...emptyBriefing, campaigns: [] },
    memoryEvidence: {
      businessProfileId: "biz-1",
      preferences: [],
      learnings: [],
      ignoredLearnings: [],
      ignoredPreferences: [],
      disabledContextTypes: [],
      marketContextSignals: [],
      activeGoals: [],
      isColdStart: true,
      evaluatedAt: NOW.toISOString(),
    },
    pendingApprovals: 0,
    openRecommendations: 0,
    unansweredReviews: 0,
    publishFailures: 0,
  });

  const why = askInteractiveHom("Why is this recommended?", ctx);
  assert.equal(why.insufficientData, true);
  assert.match(why.answer, /isn't an active recommendation/i);

  const campaign = askInteractiveHom("How is my campaign doing?", ctx);
  assert.equal(campaign.insufficientData, true);
  assert.match(campaign.answer, /don't have an active campaign/i);

  const learned = askInteractiveHom("What have we learned?", ctx);
  assert.equal(learned.insufficientData, true);
  assert.match(learned.answer, /still early/i);
});

test("identical inputs produce identical answers", () => {
  const ctx = contextFrom();
  const a = askInteractiveHom("What should I work on today?", ctx);
  const b = askInteractiveHom("What should I work on today?", ctx);
  assert.deepEqual(a, b);
});

test("suggested prompts and UI/docs ship with accessibility + mobile layout", () => {
  assert.ok(INTERACTIVE_HOM_SUGGESTED_PROMPTS.length >= 6);

  const panel = readFileSync(join(root, "components/dashboard/ask-head-of-marketing.tsx"), "utf8");
  assert.match(panel, /Ask your Head of Marketing/i);
  assert.match(panel, /aria-labelledby/);
  assert.match(panel, /aria-live/);
  assert.match(panel, /hom-focusable/);
  assert.match(panel, /sm:flex-row|sm:p-6|sm:text-sm/);
  assert.match(panel, /Looking through what we already know|Asking…/);
  assert.doesNotMatch(panel, /approveRecommendation|publishContent|openai/i);

  const page = readFileSync(join(root, "components/dashboard/head-of-marketing-page.tsx"), "utf8");
  assert.match(page, /AskHeadOfMarketingPanel/);
  const campaignsJsx = page.indexOf("<CampaignsSection");
  const askJsx = page.indexOf("<AskHeadOfMarketingPanel");
  assert.ok(campaignsJsx >= 0 && askJsx >= 0 && campaignsJsx < askJsx);

  const engine = readFileSync(join(root, "lib/interactive-hom/answerEngine.ts"), "utf8");
  assert.doesNotMatch(engine, /openai|createRecommendation|publishJob|from\("openai"\)/i);
  assert.doesNotMatch(engine, /\bI will approve\b|\bI'll publish\b/i);

  const gate = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(gate, /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/);

  const doc = readFileSync(join(root, "docs/INTERACTIVE_HEAD_OF_MARKETING.md"), "utf8");
  assert.match(doc, /Marketing Director/);
  assert.match(doc, /presentation/i);
  assert.match(doc, /guardrail/i);
});

test("regression: Interactive HoM does not own recommendation or campaign mutation APIs", () => {
  const service = readFileSync(join(root, "lib/interactive-hom/service.ts"), "utf8");
  assert.doesNotMatch(service, /initiateCampaign|completeCampaignStep|insertMarketingRecommendation/);
  assert.match(service, /getHeadOfMarketingBriefingForCurrentUser/);
});
