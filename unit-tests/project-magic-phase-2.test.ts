import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMarketingHealthCoaching } from "../lib/growth-advisor/marketingHealthCoaching.ts";
import { buildContentGeneratorSuggestion } from "../lib/content-generator/suggestions.ts";
import type { HeadOfMarketingHealth, HeadOfMarketingPrimaryAction } from "../lib/head-of-marketing/types.ts";
import type { CustomerVoiceHealth } from "../lib/customer-voice/health.ts";
import type { BusinessKnowledgeHealth } from "../lib/business-knowledge-graph/knowledgeHealth.ts";
import type { LearningMaturity } from "../lib/business-learning-engine/learningMaturity.ts";
import type { CustomerVoiceIntelligence } from "../lib/customer-voice/types.ts";

// ---------------------------------------------------------------------------
// Part 4 — Marketing Health coaching
// ---------------------------------------------------------------------------

function health(state: HeadOfMarketingHealth["state"]): HeadOfMarketingHealth {
  return {
    state,
    label: state === "excellent" ? "Excellent" : "Needs Attention",
    message: state === "excellent" ? "Everything looks great." : "I noticed an opportunity.",
    reason:
      state === "excellent"
        ? "Reputation and visibility look strong."
        : "A pending item is waiting for your review.",
  };
}

function primaryAction(kind: HeadOfMarketingPrimaryAction["kind"]): HeadOfMarketingPrimaryAction {
  return {
    kind,
    label: kind === "none" ? "" : "Review this week's recommendation",
    href: kind === "none" ? "" : "/dashboard/approvals",
  };
}

test("buildMarketingHealthCoaching surfaces the real 'why' reason, not just the message", () => {
  const coaching = buildMarketingHealthCoaching({
    health: health("needs_attention"),
    primaryAction: primaryAction("review_recommendation"),
  });
  assert.equal(coaching.whatItMeans, "I noticed an opportunity.");
  assert.equal(coaching.whyItMatters, "A pending item is waiting for your review.");
});

test("buildMarketingHealthCoaching's next best action reuses the same primary action Growth Advisor already recommends", () => {
  const coaching = buildMarketingHealthCoaching({
    health: health("needs_attention"),
    primaryAction: primaryAction("review_recommendation"),
  });
  assert.deepEqual(coaching.nextBestAction, {
    label: "Review this week's recommendation",
    href: "/dashboard/approvals",
  });
});

test("buildMarketingHealthCoaching has no next best action when the primary action kind is 'none'", () => {
  const coaching = buildMarketingHealthCoaching({
    health: health("excellent"),
    primaryAction: primaryAction("none"),
  });
  assert.equal(coaching.nextBestAction, null);
});

test("buildMarketingHealthCoaching's expected improvement cites the real top missing-knowledge gap, never a fabricated number", () => {
  const knowledgeHealth: BusinessKnowledgeHealth = {
    generatedAt: new Date().toISOString(),
    overallScore: 40,
    dimensions: {} as BusinessKnowledgeHealth["dimensions"],
    missingKnowledge: [
      { label: "Website testimonials", detail: "We understand your business, but have no website testimonials yet." },
    ],
  };
  const coaching = buildMarketingHealthCoaching({
    health: health("needs_attention"),
    primaryAction: primaryAction("review_recommendation"),
    knowledgeHealth,
  });
  assert.match(coaching.expectedImprovement, /no website testimonials yet/);
  assert.doesNotMatch(coaching.expectedImprovement, /\d+%/);
});

test("buildMarketingHealthCoaching falls back to a learning maturity improvement tip when there is no knowledge gap", () => {
  const learningMaturity: LearningMaturity = {
    generatedAt: new Date().toISOString(),
    overallScore: 50,
    dimensions: {
      learningDepth: { score: 20, level: "limited", detail: "d", improvementTip: "Approve or reject recommendations to build learning depth." },
      outcomeCoverage: { score: 80, level: "strong", detail: "d", improvementTip: "tip" },
      recommendationFeedbackRate: { score: 80, level: "strong", detail: "d", improvementTip: "tip" },
      evidenceQuality: { score: 80, level: "strong", detail: "d", improvementTip: "tip" },
      confidenceStability: { score: 80, level: "strong", detail: "d", improvementTip: "tip" },
    },
  };
  const coaching = buildMarketingHealthCoaching({
    health: health("needs_attention"),
    primaryAction: primaryAction("review_recommendation"),
    learningMaturity,
  });
  assert.equal(coaching.expectedImprovement, "Approve or reject recommendations to build learning depth.");
});

test("buildMarketingHealthCoaching returns an honest reassurance when health is excellent and nothing needs improving", () => {
  const coaching = buildMarketingHealthCoaching({
    health: health("excellent"),
    primaryAction: primaryAction("none"),
  });
  assert.match(coaching.expectedImprovement, /keep the current weekly rhythm going/i);
});

test("buildMarketingHealthCoaching composes supporting scores from whichever signals are present, never inventing missing ones", () => {
  const customerVoiceHealth: CustomerVoiceHealth = {
    state: "healthy",
    label: "Healthy",
    message: "Customer feedback is well established.",
    reason: "Recurring themes look consistent.",
  };
  const coaching = buildMarketingHealthCoaching({
    health: health("excellent"),
    primaryAction: primaryAction("none"),
    customerVoiceHealth,
  });
  assert.equal(coaching.supportingScores.length, 1);
  assert.match(coaching.supportingScores[0]!.label, /Customer Voice/);

  const noSupporting = buildMarketingHealthCoaching({
    health: health("excellent"),
    primaryAction: primaryAction("none"),
  });
  assert.deepEqual(noSupporting.supportingScores, []);
});

// ---------------------------------------------------------------------------
// Part 7 — Content Generator pre-fill
// ---------------------------------------------------------------------------

function customerVoice(overrides: Partial<CustomerVoiceIntelligence>): CustomerVoiceIntelligence {
  return {
    businessProfileId: "biz-1",
    emptyState: null,
    evidenceCount: 10,
    contributingProviders: ["google_business_reviews"],
    score: { overall: 70, maturityLabel: "established" } as unknown as CustomerVoiceIntelligence["score"],
    strengths: [],
    concerns: [],
    frequentlyMentionedServices: [],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  } as CustomerVoiceIntelligence;
}

test("buildContentGeneratorSuggestion suggests building trust around a real, well-evidenced customer strength", () => {
  const suggestion = buildContentGeneratorSuggestion({
    customerVoice: customerVoice({
      strengths: [
        {
          key: "fast_response",
          label: "rapid response time",
          kind: "strength",
          sentiment: "positive",
          confidence: "high",
          businessImpact: "high",
          evidenceCount: 5,
          percentageOfReviews: 40,
          trendDirection: "stable",
          languageVariants: [],
          evidenceIds: [],
          lastUpdated: new Date().toISOString(),
        } as CustomerVoiceIntelligence["strengths"][number],
      ],
    }),
  });
  assert.ok(suggestion);
  assert.equal(suggestion!.goal, "Build trust");
  assert.equal(suggestion!.topic, "rapid response time");
  assert.match(suggestion!.why, /rapid response time/);
});

test("buildContentGeneratorSuggestion falls back to a frequently-mentioned service when there is no strong strength theme", () => {
  const suggestion = buildContentGeneratorSuggestion({
    customerVoice: customerVoice({
      strengths: [],
      frequentlyMentionedServices: [
        {
          key: "roofing",
          label: "commercial roofing",
          kind: "service",
          sentiment: "positive",
          confidence: "medium",
          businessImpact: "medium",
          evidenceCount: 3,
          percentageOfReviews: 25,
          trendDirection: "stable",
          languageVariants: [],
          evidenceIds: [],
          lastUpdated: new Date().toISOString(),
        } as CustomerVoiceIntelligence["frequentlyMentionedServices"][number],
      ],
    }),
  });
  assert.ok(suggestion);
  assert.equal(suggestion!.goal, "Promote a service");
  assert.equal(suggestion!.topic, "commercial roofing");
});

test("buildContentGeneratorSuggestion never invents a suggestion when there is no meaningful evidence yet", () => {
  assert.equal(buildContentGeneratorSuggestion({ customerVoice: null }), null);
  assert.equal(
    buildContentGeneratorSuggestion({
      customerVoice: customerVoice({
        strengths: [
          {
            key: "weak",
            label: "weak signal",
            kind: "strength",
            sentiment: "positive",
            confidence: "low",
            businessImpact: "low",
            evidenceCount: 1,
            percentageOfReviews: 5,
            trendDirection: "stable",
            languageVariants: [],
            evidenceIds: [],
            lastUpdated: new Date().toISOString(),
          } as CustomerVoiceIntelligence["strengths"][number],
        ],
      }),
    }),
    null,
  );
});
