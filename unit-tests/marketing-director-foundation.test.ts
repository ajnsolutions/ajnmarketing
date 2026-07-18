import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { resolveMarketingDirectorDecision } from "../lib/marketing-director/resolveDecision.ts";
import {
  DeferralReasons,
  MARKETING_DIRECTOR_FORBIDDEN_TERMS,
  MarketingDirectorDecisionTypes,
  toMarketingDirectorClientView,
  type MarketingDirectorCandidate,
  type MarketingDirectorInput,
} from "../lib/marketing-director/types.ts";
import { ConfidenceLabels } from "../lib/recommendation-presentation/types.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };

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
};

const NOW = new Date("2026-07-16T09:00:00");

function candidate(overrides: Partial<MarketingDirectorCandidate>): MarketingDirectorCandidate {
  return {
    id: "rec-1",
    actionTypeLabel: "Publish a Google Business Profile post",
    status: "open",
    urgency: "medium",
    ...overrides,
  };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Marketing Director foundation", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

// --- Precedence -------------------------------------------------------------------

test("foundational connection gap outranks everything else", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      gbpConnected: false,
      pendingApprovals: 5,
      openRecommendations: 3,
      unansweredReviews: 2,
    },
    NOW,
  );

  assert.equal(decision.decisionType, MarketingDirectorDecisionTypes.MEANINGFUL_DECISION);
  assert.equal(decision.primaryAction.kind, "connect_google");
  assert.equal(decision.requiresCustomerAction, true);
});

test("pending approvals outrank open recommendations and unanswered reviews", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      pendingApprovals: 2,
      openRecommendations: 3,
      unansweredReviews: 1,
      candidateRecommendations: [candidate({ id: "rec-1" }), candidate({ id: "rec-2" })],
    },
    NOW,
  );

  assert.equal(decision.decisionType, MarketingDirectorDecisionTypes.APPROVAL_NEEDED);
  assert.equal(decision.primaryAction.kind, "approve_weekly_package");
  assert.equal(decision.requiresCustomerAction, true);
  // Every open recommendation waits behind the approval this cycle -- none of them
  // silently disappear, they're recorded as deferred with a reason.
  assert.equal(decision.deferred.length, 2);
});

test("high-value recommendation selection: an open recommendation alone becomes the primary decision", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 1,
      candidateRecommendations: [candidate({ id: "rec-top" })],
      topRecommendationDetail: {
        recommendationId: "rec-top",
        title: "Publish a Google Business Profile post",
        whyNow: "Your last GBP post was over two weeks ago, and posting keeps you visible in local search.",
        expectedBenefit: "Steadier local search visibility.",
        confidenceLabel: ConfidenceLabels.GOOD_OPPORTUNITY,
      },
    },
    NOW,
  );

  assert.equal(decision.decisionType, MarketingDirectorDecisionTypes.HIGH_VALUE_RECOMMENDATION);
  assert.equal(decision.primaryAction.kind, "review_recommendation");
  assert.equal(decision.requiresCustomerAction, true);
  assert.equal(decision.sourceRecommendationId, "rec-top");
  // Reuses the existing recommendation-presentation explainability verbatim -- never
  // re-derives its own "why now" text when the real one is available.
  assert.equal(decision.summary, "Your last GBP post was over two weeks ago, and posting keeps you visible in local search.");
  assert.equal(decision.confidenceLabel, ConfidenceLabels.GOOD_OPPORTUNITY);
});

test("unanswered reviews become the primary decision only once approvals and recommendations are clear", () => {
  const decision = resolveMarketingDirectorDecision(
    { ...baseInput, unansweredReviews: 1 },
    NOW,
  );

  assert.equal(decision.decisionType, MarketingDirectorDecisionTypes.APPROVAL_NEEDED);
  assert.equal(decision.primaryAction.kind, "review_week");
  assert.equal(decision.requiresCustomerAction, true);
});

test("reassurance when no customer action is needed", () => {
  const decision = resolveMarketingDirectorDecision({ ...baseInput, healthState: "healthy" }, NOW);

  assert.equal(decision.decisionType, MarketingDirectorDecisionTypes.REASSURANCE);
  assert.equal(decision.requiresCustomerAction, false);
  assert.equal(decision.primaryAction.kind, "none");
  assert.match(decision.summary, /on track|attention today/i);
});

test("Monthly Focus alignment: focusTheme flows into reassurance and at-risk copy", () => {
  const publishing = resolveMarketingDirectorDecision(
    { ...baseInput, publishingReadyOrScheduled: 2, focusTheme: "building more positive reviews" },
    NOW,
  );
  assert.match(publishing.summary, /building more positive reviews/);

  const atRisk = resolveMarketingDirectorDecision(
    { ...baseInput, healthState: "at_risk", focusTheme: "staying ahead of competitors" },
    NOW,
  );
  assert.match(atRisk.summary, /staying ahead of competitors/);
});

// --- Deferral -----------------------------------------------------------------------

test("deferred alternatives carry a concise, non-fabricated reason each", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      pendingApprovals: 1,
      candidateRecommendations: [
        candidate({ id: "in-progress-one", status: "in_progress" }),
        candidate({ id: "low-urgency-one", urgency: "low" }),
        candidate({ id: "normal-one", urgency: "high" }),
      ],
    },
    NOW,
  );

  const byId = new Map(decision.deferred.map((d) => [d.sourceId, d]));
  assert.equal(byId.get("in-progress-one")?.reason, DeferralReasons.ALREADY_HANDLED);
  assert.equal(byId.get("low-urgency-one")?.reason, DeferralReasons.NOT_TIME_SENSITIVE);
  assert.equal(byId.get("normal-one")?.reason, DeferralReasons.LOWER_PRIORITY);
});

test("high-value recommendation excludes the selected candidate from its own deferred list", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 2,
      candidateRecommendations: [candidate({ id: "top" }), candidate({ id: "second" })],
    },
    NOW,
  );

  assert.equal(decision.sourceRecommendationId, "top");
  assert.equal(decision.deferred.length, 1);
  assert.equal(decision.deferred[0]!.sourceId, "second");
});

// --- Determinism ----------------------------------------------------------------

test("deterministic: identical input always produces a deep-equal decision", () => {
  const input: MarketingDirectorInput = {
    ...baseInput,
    pendingApprovals: 1,
    candidateRecommendations: [candidate({ id: "a" }), candidate({ id: "b", urgency: "low" })],
  };

  const first = resolveMarketingDirectorDecision(input, NOW);
  const second = resolveMarketingDirectorDecision(input, NOW);
  assert.deepEqual(first, second);
});

test("deterministic tie-breaking: candidate order from the caller is trusted, never re-sorted", () => {
  const ordered = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 2,
      candidateRecommendations: [candidate({ id: "first-in-list" }), candidate({ id: "second-in-list" })],
    },
    NOW,
  );
  // marketing-decisions/persistence.ts's getActiveMarketingRecommendationsForUser already
  // orders by priority_score desc, created_at desc -- this module trusts that ordering
  // rather than re-deriving its own, so index 0 always wins.
  assert.equal(ordered.sourceRecommendationId, "first-in-list");
});

// --- Honesty / no fabrication -----------------------------------------------------

test("no fabricated customer action: high-value recommendation without explainability stays honest and generic", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      openRecommendations: 1,
      candidateRecommendations: [candidate({ id: "rec-1" })],
      topRecommendationDetail: null,
    },
    NOW,
  );

  assert.equal(decision.decisionType, MarketingDirectorDecisionTypes.HIGH_VALUE_RECOMMENDATION);
  assert.doesNotMatch(decision.summary, /\d/); // never invents a specific number/fact
  assert.match(decision.summary, /worth a closer look/i);
});

test("no prohibited urgency or implementation-jargon language in any decision branch", () => {
  const scenarios: MarketingDirectorInput[] = [
    { ...baseInput, gbpConnected: false },
    { ...baseInput, pendingApprovals: 2 },
    {
      ...baseInput,
      openRecommendations: 1,
      candidateRecommendations: [candidate({ id: "x" })],
      topRecommendationDetail: {
        recommendationId: "x",
        title: "Publish a post",
        whyNow: "Steady posting keeps your profile active in local search.",
        expectedBenefit: "More visibility.",
        confidenceLabel: ConfidenceLabels.STRONG_RECOMMENDATION,
      },
    },
    { ...baseInput, unansweredReviews: 1 },
    { ...baseInput, seasonalHint: "Back-to-school (August)" },
    { ...baseInput, healthState: "excellent" },
    { ...baseInput, weeklyWins: { ...emptyWins, reviews: 3 } },
    { ...baseInput, weeklyWins: { ...emptyWins, views: 80 } },
    { ...baseInput, publishingReadyOrScheduled: 3 },
    { ...baseInput, isEarlyCustomer: true },
    { ...baseInput, healthState: "needs_attention" },
    { ...baseInput, healthState: "at_risk" },
  ];

  for (const scenario of scenarios) {
    const decision = resolveMarketingDirectorDecision(scenario, NOW);
    const blob = `${decision.title}\n${decision.summary}`;
    for (const term of MARKETING_DIRECTOR_FORBIDDEN_TERMS) {
      assert.equal(
        blob.toUpperCase().includes(term.toUpperCase()),
        false,
        `forbidden term "${term}" leaked into customer-facing copy: ${blob}`,
      );
    }
  }
});

// --- Robustness ---------------------------------------------------------------------

test("empty and partial input handling: zeroed signals never throw and resolve to a calm decision", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      gbpConnected: true,
      pendingApprovals: 0,
      unansweredReviews: 0,
      openRecommendations: 0,
      publishingReadyOrScheduled: 0,
      healthState: "healthy",
      weeklyWins: emptyWins,
      seasonalHint: null,
      focusTheme: "your marketing",
      isEarlyCustomer: false,
      candidateRecommendations: [],
      topRecommendationDetail: null,
    },
    NOW,
  );

  assert.equal(decision.requiresCustomerAction, false);
  assert.ok(decision.summary.length > 0);
});

test("empty and partial input handling: openRecommendations count without a loaded candidate list degrades gracefully", () => {
  // A defensive edge case service.ts should never produce (it always loads candidates
  // together with the count), but the resolver must not crash or fabricate if it does.
  const decision = resolveMarketingDirectorDecision(
    { ...baseInput, openRecommendations: 3, candidateRecommendations: [] },
    NOW,
  );

  assert.notEqual(decision.decisionType, MarketingDirectorDecisionTypes.HIGH_VALUE_RECOMMENDATION);
  assert.equal(decision.requiresCustomerAction, false);
});

// --- Client-safe presentation mapping -------------------------------------------

test("client-safe presentation mapping omits internal-only fields", () => {
  const decision = resolveMarketingDirectorDecision(
    {
      ...baseInput,
      pendingApprovals: 1,
      candidateRecommendations: [candidate({ id: "a" })],
    },
    NOW,
  );
  const clientView = toMarketingDirectorClientView(decision);

  assert.deepEqual(Object.keys(clientView).sort(), [
    "confidenceLabel",
    "decisionType",
    "primaryAction",
    "requiresCustomerAction",
    "summary",
    "title",
  ]);
  assert.equal((clientView as Record<string, unknown>).rationale, undefined);
  assert.equal((clientView as Record<string, unknown>).deferred, undefined);
  assert.equal((clientView as Record<string, unknown>).supportingSignals, undefined);
  assert.equal((clientView as Record<string, unknown>).presentationPriority, undefined);
  assert.equal((clientView as Record<string, unknown>).sourceRecommendationId, undefined);
});

// --- Regression: one shared decision drives both presentation consumers -------------

test("regression: buildPrimaryAction and the proactive primary moment can never disagree, across many signal combinations", () => {
  const scenarios: Array<Partial<Parameters<typeof buildWeeklyBriefing>[0]>> = [
    {},
    { gbpConnected: false },
    { pendingApprovals: 3 },
    { openRecommendations: 2, candidateRecommendations: [candidate({ id: "r1" }), candidate({ id: "r2" })] },
    { unansweredReviews: 2 },
    { seasonalHint: "Holiday rush (December)" },
    { businessHealth: overallScore(90) },
    { weeklyWins: { ...emptyWins, reviews: 3 } },
    { weeklyWins: { ...emptyWins, views: 80 } },
    { publishingReadyOrScheduled: 4 },
    { voiceNotes: "facebookSkipped" },
    { businessHealth: overallScore(30) },
  ];

  for (const overrides of scenarios) {
    const briefing = buildWeeklyBriefing({
      userName: "Sean Carter",
      businessName: "Acme Plumbing",
      websiteUrl: "https://acme.example",
      voiceNotes: "",
      profileCreatedAt: "2026-01-15T00:00:00.000Z",
      gbpConnected: true,
      unansweredReviews: 0,
      pendingApprovals: 0,
      openRecommendations: 0,
      publishFailures: 0,
      publishingReadyOrScheduled: 0,
      businessHealth: overallScore(72),
      weeklyWins: emptyWins,
      planSummary: null,
      marketingThemes: [],
      businessGoals: [],
      seasonalHint: null,
      topPriorityTitle: null,
      upcomingCalendar: [],
      competitorWatchMessage: null,
      now: NOW,
      ...overrides,
    });

    const actionRequired = briefing.primaryAction.kind !== "none";
    const proactiveRequiresAction =
      briefing.proactive.primary.purpose === "decision" ||
      (briefing.proactive.primary.purpose === "opportunity" &&
        briefing.primaryAction.kind === "review_recommendation");

    // Never a CTA with a purely reassuring/celebratory headline, and never "nothing to
    // do" alongside a "needs your opinion" headline.
    if (actionRequired) {
      assert.notEqual(
        briefing.proactive.primary.purpose,
        "reassure",
        `CTA "${briefing.primaryAction.kind}" but proactive message reassures: ${briefing.proactive.primary.message}`,
      );
      assert.notEqual(
        briefing.proactive.primary.purpose,
        "celebrate",
        `CTA "${briefing.primaryAction.kind}" but proactive message celebrates: ${briefing.proactive.primary.message}`,
      );
    } else {
      assert.notEqual(
        briefing.proactive.primary.purpose,
        "decision",
        `No CTA but proactive message asks for a decision: ${briefing.proactive.primary.message}`,
      );
    }
    void proactiveRequiresAction;

    // lead is always exactly the proactive primary message -- no second, competing
    // greeting/message pair.
    assert.equal(briefing.lead, briefing.proactive.primary.message);
  }
});

function overallScore(overall: number) {
  return { overall, seo: 70, google: 80, reviews: 70, content: 70, consistency: 70 };
}

// --- Docs ----------------------------------------------------------------------

test("Marketing Director Foundation docs exist and describe the composition layer", () => {
  const doc = readFileSync(join(root, "docs/MARKETING_DIRECTOR_FOUNDATION.md"), "utf8");
  assert.match(doc, /Shared decision contract/i);
  assert.match(doc, /Precedence/i);
  assert.match(doc, /Server\/client boundaries/i);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const architectureDoc = readFileSync(join(root, "docs/MARKETING_DIRECTOR_ARCHITECTURE.md"), "utf8");
  assert.match(architectureDoc, /Implemented/i);
});

test("no new engine or LLM call introduced by the composition layer", () => {
  const resolverSrc = readFileSync(join(root, "lib/marketing-director/resolveDecision.ts"), "utf8");
  assert.equal(resolverSrc.includes("openai"), false);
  assert.equal(resolverSrc.toLowerCase().includes("chat.completions"), false);
  assert.equal(resolverSrc.includes("supabase"), false);
  assert.equal(resolverSrc.includes(".from("), false);
});
