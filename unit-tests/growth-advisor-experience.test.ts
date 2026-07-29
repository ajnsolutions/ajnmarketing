import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildWeeklyBriefing, type WeeklyBriefingInput } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { buildGrowthAdvisorBriefing } from "../lib/growth-advisor/buildGrowthAdvisorBriefing.ts";
import { resolveExpectedBusinessOutcomes } from "../lib/growth-advisor/expectedImpact.ts";
import { TrustCertaintyLevels } from "../lib/growth-advisor/trust.ts";
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

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("briefing generation produces conversational experience fields", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);

  assert.ok(advisor.whatChanged.items.length >= 1);
  assert.ok(advisor.nextWeek.length >= 1);
  assert.ok(advisor.learning);
  assert.equal(typeof advisor.learning.isLearning, "boolean");
});

test("What I Noticed combines Business Brain sources without fabricating", () => {
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
  const advisor = buildGrowthAdvisorBriefing(briefing, null, {
    customerVoice,
    externalIntelligence,
    goals: [],
  });

  assert.ok(advisor.whatINoticed.length >= 2);
  assert.ok(advisor.whatINoticed.length <= 5);
  assert.ok(advisor.whatINoticed.some((o) => /Customers consistently praise/i.test(o.headline)));
  assert.ok(advisor.whatINoticed.every((o) => o.whyItMatters.length > 0));
  assert.ok(
    advisor.nextWeek.some((item) => /Seasonal demand|Holiday|Review trends|What I'm preparing/i.test(item.label)),
  );
});

test("expected impact uses business language without fake numbers", () => {
  const result = resolveExpectedBusinessOutcomes({
    actionType: RecommendedActionTypes.REQUEST_REVIEWS,
    expectedBenefit: "Support ongoing review growth.",
    supportsGoal: "Generate more leads",
  });
  assert.ok(result.outcomes.includes("Higher review velocity"));
  assert.ok(!/\d/.test(result.summary));
});

test("trust language separates Observed Likely Predicted Suggested", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);
  assert.ok(advisor.recommendation);
  assert.equal(advisor.recommendation!.certainty, TrustCertaintyLevels.SUGGESTED);
  for (const obs of advisor.whatINoticed) {
    assert.ok(Object.values(TrustCertaintyLevels).includes(obs.certainty));
  }
});

test("empty / thin evidence explains learning without fabricating insights", () => {
  const briefing = buildWeeklyBriefing({
    ...baseInput,
    gbpConnected: false,
    weeklyWins: emptyWins,
    pendingApprovals: 0,
    openRecommendations: 0,
    publishingReadyOrScheduled: 0,
    unansweredReviews: 0,
    seasonalHint: null,
    competitorWatchMessage: null,
    topPriorityTitle: null,
  });
  const advisor = buildGrowthAdvisorBriefing(briefing, null, {
    customerVoice: null,
    externalIntelligence: null,
    goals: [],
  });

  assert.equal(advisor.learning.isLearning, true);
  assert.match(advisor.learning.message ?? "", /still learning/i);
  assert.ok(advisor.learning.improvementSuggestions.length > 0);
  assert.ok(
    advisor.learning.improvementSuggestions.some((s) => /Google Business Profile/i.test(s)),
  );
});

test("exactly one recommendation is preserved", () => {
  const briefing = buildWeeklyBriefing(baseInput);
  const advisor = buildGrowthAdvisorBriefing(briefing);
  assert.ok(advisor.recommendation);
  assert.equal(Object.keys(advisor).includes("recommendations"), false);
});

test("experience docs and modules exist", () => {
  assert.ok(existsSync(join(root, "docs/project-magic/GROWTH_ADVISOR_EXPERIENCE.md")));
  const docs = readFileSync(join(root, "docs/project-magic/GROWTH_ADVISOR_EXPERIENCE.md"), "utf8");
  assert.match(docs, /Conversation flow/);
  assert.match(docs, /Evidence hierarchy/);
  assert.match(docs, /Trust model/);
  assert.match(docs, /Briefing generation/);
  assert.match(docs, /Recommendation philosophy/);
  assert.ok(existsSync(join(root, "lib/growth-advisor/observations.ts")));
  assert.ok(existsSync(join(root, "lib/growth-advisor/expectedImpact.ts")));
  assert.ok(existsSync(join(root, "lib/growth-advisor/nextWeek.ts")));
  assert.ok(existsSync(join(root, "lib/growth-advisor/trust.ts")));
});
