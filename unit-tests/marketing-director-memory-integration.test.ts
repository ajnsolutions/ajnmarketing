import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  effectiveSeasonalHint,
  orderCandidatesWithMemory,
} from "../lib/marketing-director/memoryComposition.ts";
import { resolveMarketingDirectorDecision } from "../lib/marketing-director/resolveDecision.ts";
import {
  DeferralReasons,
  MarketingDirectorDecisionTypes,
  toMarketingDirectorClientView,
  type MarketingDirectorCandidate,
  type MarketingDirectorInput,
} from "../lib/marketing-director/types.ts";
import type { MarketingMemoryEvidencePackage } from "../lib/marketing-memory/evidenceTypes.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };
const NOW = new Date("2026-07-18T15:00:00.000Z");

function candidate(overrides: Partial<MarketingDirectorCandidate>): MarketingDirectorCandidate {
  return {
    id: "rec-1",
    actionTypeLabel: "Request more reviews",
    actionType: "request_reviews",
    status: "open",
    urgency: "medium",
    ...overrides,
  };
}

function evidence(
  overrides: Partial<MarketingMemoryEvidencePackage> = {}
): MarketingMemoryEvidencePackage {
  return {
    businessProfileId: "biz-1",
    preferences: [],
    learnings: [],
    ignoredLearnings: [],
    ignoredPreferences: [],
    disabledContextTypes: [],
    marketContextSignals: [],
    activeGoals: [],
    isColdStart: false,
    evaluatedAt: NOW.toISOString(),
    ...overrides,
  };
}

const baseInput: MarketingDirectorInput = {
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
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for memory integration", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("regression: recommendation unchanged when no Marketing Memory exists", () => {
  const candidates = [
    candidate({ id: "rec-a", actionType: "request_reviews" }),
    candidate({ id: "rec-b", actionType: "upload_photos", actionTypeLabel: "Upload photos" }),
  ];
  const without = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 2,
      candidateRecommendations: candidates,
      memoryEvidence: null,
    },
    NOW
  );
  const cold = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 2,
      candidateRecommendations: candidates,
      memoryEvidence: evidence({ isColdStart: true }),
    },
    NOW
  );

  assert.equal(without.sourceRecommendationId, "rec-a");
  assert.equal(cold.sourceRecommendationId, "rec-a");
  assert.equal(without.decisionType, cold.decisionType);
  assert.equal(without.summary, cold.summary);
  assert.equal(without.primaryAction.kind, cold.primaryAction.kind);
});

test("deterministic: identical input with memory => identical output", () => {
  const input: MarketingDirectorInput = {
    ...baseInput,
    openRecommendations: 2,
    candidateRecommendations: [
      candidate({ id: "rec-a", actionType: "request_reviews" }),
      candidate({ id: "rec-b", actionType: "upload_photos", actionTypeLabel: "Upload photos" }),
    ],
    memoryEvidence: evidence({
      learnings: [
        {
          id: "learn-1",
          learningFamily: "recommendation_action_outcome",
          subjectKey: "upload_photos",
          timeDimension: null,
          direction: "positive",
          confidenceLevel: "strong_pattern",
          status: "active",
          summary: "Upload-photo recommendations have historically been approved more often.",
        },
      ],
    }),
  };
  assert.deepEqual(
    resolveMarketingDirectorDecision(input, NOW),
    resolveMarketingDirectorDecision(input, NOW)
  );
});

test("preference beats learning when choosing among existing recommendations", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 2,
      candidateRecommendations: [
        candidate({ id: "rec-learning", actionType: "upload_photos", actionTypeLabel: "Upload photos" }),
        candidate({ id: "rec-pref", actionType: "request_reviews" }),
      ],
      memoryEvidence: evidence({
        preferences: [
          {
            id: "pref-1",
            preferenceType: "custom",
            factorType: "recommended_action_type",
            factorValue: "request_reviews",
            instructionText: "Prefer review requests when both are open.",
            source: "explicit_statement",
            activeUntil: null,
          },
        ],
        learnings: [
          {
            id: "learn-1",
            learningFamily: "recommendation_action_outcome",
            subjectKey: "upload_photos",
            timeDimension: null,
            direction: "positive",
            confidenceLevel: "strong_pattern",
            status: "active",
            summary: "Upload photos has a strong historical pattern.",
          },
        ],
      }),
    },
    NOW
  );

  assert.equal(decision.sourceRecommendationId, "rec-pref");
  assert.match(decision.rationale, /You've told us/i);
  assert.doesNotMatch(decision.summary, /Weight |confidence coefficient/i);
});

test("prohibition beats everything except compliance (GBP gap still wins)", () => {
  const prohibited = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 2,
      candidateRecommendations: [
        candidate({ id: "rec-bad", actionType: "request_reviews" }),
        candidate({ id: "rec-ok", actionType: "upload_photos", actionTypeLabel: "Upload photos" }),
      ],
      memoryEvidence: evidence({
        preferences: [
          {
            id: "pref-ban",
            preferenceType: "custom",
            factorType: "prohibit_action",
            factorValue: "request_reviews",
            instructionText: "Don't ask for reviews this month.",
            source: "explicit_statement",
            activeUntil: null,
          },
        ],
      }),
    },
    NOW
  );
  assert.equal(prohibited.sourceRecommendationId, "rec-ok");
  assert.equal(
    prohibited.deferred.find((item) => item.sourceId === "rec-bad")?.reason,
    DeferralReasons.CUSTOMER_PROHIBITION
  );

  const compliance = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      gbpConnected: false,
      openRecommendations: 2,
      candidateRecommendations: [
        candidate({ id: "rec-ok", actionType: "upload_photos", actionTypeLabel: "Upload photos" }),
      ],
      memoryEvidence: evidence({
        preferences: [
          {
            id: "pref-ban",
            preferenceType: "custom",
            factorType: "prohibit_action",
            factorValue: "upload_photos",
            instructionText: "Don't upload photos.",
            source: "explicit_statement",
            activeUntil: null,
          },
        ],
      }),
    },
    NOW
  );
  assert.equal(compliance.decisionType, MarketingDirectorDecisionTypes.MEANINGFUL_DECISION);
  assert.equal(compliance.primaryAction.kind, "connect_google");
});

test("revoked preference ignored; temporary preference expiry handled in package shape", () => {
  const revokedPackage = evidence({
    preferences: [],
    ignoredPreferences: [{ id: "pref-old", reason: "revoked_or_inactive" }],
    isColdStart: true,
  });
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 1,
      candidateRecommendations: [candidate({ id: "rec-1" })],
      memoryEvidence: revokedPackage,
    },
    NOW
  );
  assert.equal(decision.sourceRecommendationId, "rec-1");
  assert.ok(
    decision.memoryContext?.ignoredPreferences.some((item) => item.reason === "revoked_or_inactive")
  );

  const expiredPackage = evidence({
    preferences: [],
    ignoredPreferences: [{ id: "pref-temp", reason: "temporary_preference_expired" }],
    isColdStart: true,
  });
  assert.equal(expiredPackage.preferences.length, 0);
  assert.equal(expiredPackage.ignoredPreferences[0]?.reason, "temporary_preference_expired");
});

test("strong learning influences prioritization; weak learning influences less", () => {
  const candidates = [
    candidate({ id: "rec-a", actionType: "request_reviews" }),
    candidate({ id: "rec-b", actionType: "upload_photos", actionTypeLabel: "Upload photos" }),
  ];

  const strong = orderCandidatesWithMemory(
    candidates,
    evidence({
      learnings: [
        {
          id: "l-strong",
          learningFamily: "recommendation_action_outcome",
          subjectKey: "upload_photos",
          timeDimension: null,
          direction: "positive",
          confidenceLevel: "strong_pattern",
          status: "active",
          summary: "Strong pattern for upload photos.",
        },
        {
          id: "l-early",
          learningFamily: "recommendation_action_outcome",
          subjectKey: "request_reviews",
          timeDimension: null,
          direction: "positive",
          confidenceLevel: "early_signal",
          status: "active",
          summary: "Early signal for review requests.",
        },
      ],
    })
  );
  assert.equal(strong.ordered[0]?.id, "rec-b");

  const weakOnly = orderCandidatesWithMemory(
    candidates,
    evidence({
      learnings: [
        {
          id: "l-early",
          learningFamily: "recommendation_action_outcome",
          subjectKey: "upload_photos",
          timeDimension: null,
          direction: "positive",
          confidenceLevel: "early_signal",
          status: "active",
          summary: "Early signal for upload photos.",
        },
      ],
    })
  );
  assert.equal(weakOnly.ordered[0]?.id, "rec-b");

  // Strong negative on the head of the list should demote it behind a neutral peer.
  const strongNeg = orderCandidatesWithMemory(
    candidates,
    evidence({
      learnings: [
        {
          id: "l-neg",
          learningFamily: "recommendation_action_outcome",
          subjectKey: "request_reviews",
          timeDimension: null,
          direction: "negative",
          confidenceLevel: "strong_pattern",
          status: "active",
          summary: "Request reviews has underperformed historically.",
        },
      ],
    })
  );
  assert.equal(strongNeg.ordered[0]?.id, "rec-b");
});

test("superseded learning ignored (present only in ignoredLearnings)", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 2,
      candidateRecommendations: [
        candidate({ id: "rec-a", actionType: "request_reviews" }),
        candidate({ id: "rec-b", actionType: "upload_photos", actionTypeLabel: "Upload photos" }),
      ],
      memoryEvidence: evidence({
        learnings: [],
        ignoredLearnings: [{ id: "old", reason: "superseded" }],
        isColdStart: true,
      }),
    },
    NOW
  );
  assert.equal(decision.sourceRecommendationId, "rec-a");
  assert.ok(decision.memoryContext?.ignoredLearnings.some((item) => item.reason === "superseded"));
});

test("disabled political factor suppresses matching seasonal opportunity", () => {
  assert.equal(
    effectiveSeasonalHint(
      "Local election day civic outreach (November)",
      evidence({ disabledContextTypes: ["political_civic"] })
    ),
    null
  );
  assert.equal(
    effectiveSeasonalHint("Back-to-school (August)", evidence({ disabledContextTypes: ["political_civic"] })),
    "Back-to-school (August)"
  );

  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      seasonalHint: "Local election day civic outreach",
      memoryEvidence: evidence({ disabledContextTypes: ["political_civic"] }),
    },
    NOW
  );
  assert.notEqual(decision.decisionType, MarketingDirectorDecisionTypes.OPPORTUNITY);
  assert.equal(decision.decisionType, MarketingDirectorDecisionTypes.REASSURANCE);
});

test("disabled factor ignored in market context list stays out of considered context", () => {
  const pkg = evidence({
    disabledContextTypes: ["weather"],
    marketContextSignals: [{ id: "ctx-1", category: "holiday", title: "Memorial Day approaching" }],
  });
  const decision = resolveMarketingDirectorDecision(
    { ...baseInput, memoryEvidence: pkg },
    NOW
  );
  assert.deepEqual(decision.memoryContext?.contextConsidered, ["Memorial Day approaching"]);
  assert.ok(!decision.memoryContext?.contextConsidered.some((title) => /weather/i.test(title)));
});

test("client view never exposes memoryContext or internal scoring language", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 1,
      candidateRecommendations: [candidate({ id: "rec-1" })],
      memoryEvidence: evidence({
        preferences: [
          {
            id: "p1",
            preferenceType: "custom",
            factorType: "recommended_action_type",
            factorValue: "request_reviews",
            instructionText: "Prefer review requests.",
            source: "explicit_statement",
            activeUntil: null,
          },
        ],
      }),
    },
    NOW
  );
  const view = toMarketingDirectorClientView(decision);
  assert.equal((view as Record<string, unknown>).memoryContext, undefined);
  assert.equal((view as Record<string, unknown>).rationale, undefined);
  assert.ok(decision.memoryContext);
  assert.match(decision.memoryContext!.precedenceExplanation, /explicit_preferences/);
});

test("no LLM / ML / new providers / cron activation introduced by memory integration modules", () => {
  const files = [
    "lib/marketing-director/resolveDecision.ts",
    "lib/marketing-director/memoryComposition.ts",
    "lib/marketing-memory/evidencePackage.ts",
  ];
  for (const relative of files) {
    const source = readFileSync(join(root, relative), "utf8");
    assert.doesNotMatch(source, /from ["']openai["']|@anthropic|chatgpt/i);
    assert.doesNotMatch(source, /\btrainModel\b|\bneuralNetwork\b|\bgradientDescent\b/i);
    assert.doesNotMatch(source, /schedules\.task|ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*true/);
  }
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});
