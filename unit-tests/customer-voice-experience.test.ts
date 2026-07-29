import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { composeCustomerVoiceIntelligence } from "../lib/customer-voice/compose.ts";
import {
  buildMarketingCopySuggestions,
  formatCustomerVoiceForContentPrompt,
} from "../lib/customer-voice/copySuggestions.ts";
import {
  CustomerVoiceHealthStates,
  resolveCustomerVoiceHealth,
} from "../lib/customer-voice/health.ts";
import { normalizeProviderBatch } from "../lib/customer-voice/normalize.ts";
import {
  insightSentenceForTheme,
  possibleActionsForTheme,
} from "../lib/customer-voice/possibleActions.ts";
import {
  buildCustomerVoicePageModel,
  growthAdvisorCustomerVoiceLines,
} from "../lib/customer-voice/presentation.ts";
import { CustomerVoiceProviderIds, ThemeKinds } from "../lib/customer-voice/types.ts";
import { buildGrowthAdvisorBriefing } from "../lib/growth-advisor/buildGrowthAdvisorBriefing.ts";
import { buildWeeklyBriefing, type WeeklyBriefingInput } from "../lib/head-of-marketing/weeklyBriefing.ts";
import { buildContentGenerationPrompt } from "../lib/content-generator/prompt-builder.ts";
import type { ContentGenerationContext } from "../lib/content-generator/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { HOM_ADVANCED_NAV_HREFS } from "../lib/head-of-marketing/types.ts";

const root = process.cwd();
const now = new Date("2026-07-29T12:00:00.000Z");

function richIntelligence() {
  const batch = normalizeProviderBatch({
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
      {
        externalId: "4",
        occurredAt: "2026-07-22T00:00:00.000Z",
        rating: 5,
        text: "Fast and professional — they fixed our plumbing quickly.",
      },
      {
        externalId: "5",
        occurredAt: "2026-07-25T00:00:00.000Z",
        rating: 4,
        text: "Professional expertise throughout the plumbing visit.",
      },
    ],
    knownServices: ["plumbing"],
  });

  return composeCustomerVoiceIntelligence({
    businessProfileId: "biz-cv",
    evidence: batch,
    now,
  });
}

const baseBriefingInput: WeeklyBriefingInput = {
  userName: "Sean Carter",
  businessName: "Acme Plumbing",
  websiteUrl: "https://acme.example",
  voiceNotes: "",
  profileCreatedAt: "2026-01-15T00:00:00.000Z",
  gbpConnected: true,
  unansweredReviews: 0,
  pendingApprovals: 0,
  openRecommendations: 1,
  publishFailures: 0,
  publishingReadyOrScheduled: 1,
  businessHealth: { overall: 72, seo: 70, google: 80, reviews: 70, content: 70, consistency: 70 },
  weeklyWins: { reviews: 2, views: 40, calls: 0, clicks: 0, posts: 1, tasksCompleted: 0 },
  planSummary: "Build local trust.",
  marketingThemes: ["Local visibility"],
  businessGoals: ["More leads"],
  seasonalHint: null,
  topPriorityTitle: "Publish a Google Business update",
  upcomingCalendar: [],
  competitorWatchMessage: null,
  now: new Date("2026-07-16T09:00:00"),
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("Customer Voice page route and presentation modules exist", () => {
  assert.ok(existsSync(join(root, "app/dashboard/customer-voice/page.tsx")));
  assert.ok(existsSync(join(root, "components/dashboard/customer-voice-page.tsx")));
  assert.ok(existsSync(join(root, "lib/customer-voice/possibleActions.ts")));
  assert.ok(existsSync(join(root, "lib/customer-voice/copySuggestions.ts")));
  assert.ok(existsSync(join(root, "lib/customer-voice/health.ts")));
  assert.ok(existsSync(join(root, "lib/customer-voice/presentation.ts")));
  assert.ok((HOM_ADVANCED_NAV_HREFS as readonly string[]).includes("/dashboard/customer-voice"));
});

test("page model builds conversational sections with explainability and possible actions", () => {
  const intelligence = richIntelligence();
  const model = buildCustomerVoicePageModel({
    intelligence,
    businessName: "Acme Plumbing",
  });

  assert.equal(model.businessName, "Acme Plumbing");
  assert.ok(model.loves.length > 0);
  const first = model.loves[0]!;
  assert.match(first.insight, /Customers consistently praise/i);
  assert.ok(first.confidence);
  assert.ok(first.businessImpact);
  assert.ok(first.supportingReviewCount >= 1);
  assert.ok(first.trend);
  assert.match(first.whyBelievable, /supporting review/i);
  assert.ok(first.possibleActions.length >= 2);
  assert.ok(model.suggestedMarketingOpportunities.length > 0);
});

test("possible actions are suggestions only and never empty for strengths", () => {
  const intelligence = richIntelligence();
  const strength = intelligence.strengths[0];
  assert.ok(strength);
  const actions = possibleActionsForTheme(strength!);
  assert.ok(actions.some((a) => /homepage/i.test(a.label)));
  assert.ok(actions.some((a) => /Google Business/i.test(a.label)));
  assert.match(insightSentenceForTheme(strength!), /Customers consistently praise/);
});

test("marketing copy suggestions only use supported themes", () => {
  const suggestions = buildMarketingCopySuggestions(richIntelligence());
  assert.ok(suggestions.length >= 3);
  assert.ok(suggestions.every((s) => s.supportingThemeKeys.length > 0));
  assert.ok(suggestions.some((s) => s.surface === "website_headline"));
  assert.ok(suggestions.some((s) => s.surface === "email_subject"));
});

test("empty and low-review businesses stay honest", () => {
  const empty = composeCustomerVoiceIntelligence({
    businessProfileId: "biz-empty",
    evidence: [],
    now,
  });
  assert.equal(empty.emptyState, "no_evidence");
  assert.equal(buildMarketingCopySuggestions(empty).length, 0);
  assert.equal(formatCustomerVoiceForContentPrompt(empty), null);
  assert.equal(resolveCustomerVoiceHealth(empty).state, CustomerVoiceHealthStates.ESTABLISHING_BASELINE);

  const thinBatch = normalizeProviderBatch({
    providerId: CustomerVoiceProviderIds.GOOGLE_BUSINESS_REVIEWS,
    sourceLabel: "Google Business Reviews",
    now,
    evidence: [
      {
        externalId: "only-1",
        occurredAt: "2026-07-01T00:00:00.000Z",
        rating: 5,
        text: "Nice.",
      },
    ],
  });
  const thin = composeCustomerVoiceIntelligence({
    businessProfileId: "biz-thin",
    evidence: thinBatch,
    now,
  });
  const health = resolveCustomerVoiceHealth(thin);
  assert.ok(
    health.state === CustomerVoiceHealthStates.ESTABLISHING_BASELINE ||
      health.state === CustomerVoiceHealthStates.LIMITED_FEEDBACK,
  );
  const page = buildCustomerVoicePageModel({ intelligence: thin, businessName: "Thin Co" });
  assert.ok(page.emptyState === "insufficient_evidence" || page.loves.length === 0 || page.maturityCopy.length > 0);
});

test("Customer Voice Health never fabricates healthy when there is no evidence", () => {
  const health = resolveCustomerVoiceHealth(null);
  assert.equal(health.state, CustomerVoiceHealthStates.ESTABLISHING_BASELINE);
  assert.match(health.label, /Establishing Baseline/i);
});

test("Growth Advisor keeps exactly one recommendation and references Customer Voice naturally", () => {
  const briefing = buildWeeklyBriefing(baseBriefingInput);
  const intelligence = richIntelligence();
  const advisor = buildGrowthAdvisorBriefing(briefing, null, {
    goals: [],
    customerVoice: intelligence,
  });

  assert.ok(advisor.recommendation);
  assert.equal(advisor.recommendation !== null, true);
  // Still a single recommendation object — not a list.
  assert.equal(Object.keys(advisor).includes("recommendations"), false);
  assert.ok(advisor.recommendation!.customerVoiceContext);
  assert.match(advisor.recommendation!.customerVoiceContext!, /Customers consistently praise/i);
  assert.ok(advisor.supporting.customerVoiceHealth);
  assert.ok(
    advisor.whatINoticed.some((item) => /Customers consistently praise/i.test(item.headline)),
  );
});

test("Content Generator prompt incorporates Customer Voice without inventing praise", () => {
  const voiceBlock = formatCustomerVoiceForContentPrompt(richIntelligence());
  assert.ok(voiceBlock);
  assert.match(voiceBlock!, /CUSTOMER VOICE/);
  assert.match(voiceBlock!, /never invent/i);

  const context = {
    businessProfile: {
      id: "p1",
      user_id: "u1",
      business_name: "Acme Plumbing",
      industry: "Plumbing",
      primary_services: "Plumbing",
      emergency_services: null,
      seasonal_services: null,
      specialty_services: null,
      primary_service_area: "Austin",
      city: "Austin",
      state: "TX",
      nearby_cities: null,
      preferred_words: null,
      avoid_words: null,
      brand_voice_tone: "Friendly",
      voice_notes: null,
      marketing_goals: ["More leads"],
    },
    aiMarketingProfile: null,
    websiteAnalysis: null,
    marketContextSummary: null,
    analyticsFeedback: null,
    customerVoicePromptBlock: voiceBlock,
  } as unknown as ContentGenerationContext;

  const prompt = buildContentGenerationPrompt(context, {
    contentType: "Facebook Post",
    length: "Short",
    tone: "Friendly",
  });

  assert.match(prompt.system, /never keyword-stuff/i);
  assert.match(prompt.user, /CUSTOMER VOICE/);
  assert.match(prompt.user, /Recurring strengths/i);
});

test("docs cover experience surfaces", () => {
  const docs = readFileSync(join(root, "docs/project-magic/CUSTOMER_VOICE.md"), "utf8");
  assert.match(docs, /Customer-facing experience/);
  assert.match(docs, /Marketing Copy Suggestions/);
  assert.match(docs, /Possible Actions/);
  assert.match(docs, /Growth Advisor integration/);
  assert.match(docs, /Marketing Health integration/);
  assert.match(docs, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
});

test("growthAdvisorCustomerVoiceLines returns null context when empty", () => {
  const lines = growthAdvisorCustomerVoiceLines(
    composeCustomerVoiceIntelligence({ businessProfileId: "x", evidence: [], now }),
  );
  assert.equal(lines.recommendationContext, null);
  assert.equal(lines.health.state, CustomerVoiceHealthStates.ESTABLISHING_BASELINE);
});

test("ThemeKinds still used by possible actions map", () => {
  assert.equal(ThemeKinds.STRENGTH, "strength");
});
