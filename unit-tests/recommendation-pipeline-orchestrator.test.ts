import test from "node:test";
import assert from "node:assert/strict";
import {
  runRecommendationPipelineForUser,
  runRecommendationPipelineForCurrentUser,
  type RecommendationPipelineDeps,
} from "../lib/recommendation-pipeline/orchestrator.ts";
import { PIPELINE_STAGE_ORDER } from "../lib/recommendation-pipeline/types.ts";
import { createFakeSupabaseClient, userIdsQueried } from "./support/fake-supabase-client.ts";
import type { WebsiteAnalysis } from "../lib/website-analysis/types.ts";
import type { AiMarketingProfile } from "../lib/ai-marketing-profile/types.ts";
import type { MarketContextBriefWithItems } from "../lib/market-context/types.ts";
import type { OpportunityDetectionResult } from "../lib/marketing-opportunities/detectionEngine.ts";
import type { MarketingDecisionResult } from "../lib/marketing-decisions/service.ts";

const USER = "user-1";
const BIZ = "biz-1";

function businessProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: BIZ,
    user_id: USER,
    business_name: "Test Business",
    website: "https://example.com",
    onboarding_completed: true,
    ...overrides,
  };
}

function websiteAnalysis(overrides: Partial<WebsiteAnalysis> = {}): WebsiteAnalysis {
  return {
    id: "wa-1",
    user_id: USER,
    business_profile_id: BIZ,
    website: "https://example.com",
    analysis_status: "completed",
    analysis_score: 80,
    seo_score: 70,
    ...overrides,
  } as WebsiteAnalysis;
}

function aiProfile(overrides: Partial<AiMarketingProfile> = {}): AiMarketingProfile {
  return {
    id: "amp-1",
    user_id: USER,
    business_profile_id: BIZ,
    profile_status: "active",
    ...overrides,
  } as AiMarketingProfile;
}

function marketContextBrief(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcb-1",
    user_id: USER,
    business_profile_id: BIZ,
    status: "active",
    created_at: new Date().toISOString(),
    selected_context_item_ids: [],
    ...overrides,
  };
}

function opportunityResult(overrides: Partial<OpportunityDetectionResult> = {}): OpportunityDetectionResult {
  return { businessProfileId: BIZ, opportunities: [], expiredCount: 0, ...overrides };
}

function decisionResult(overrides: Partial<MarketingDecisionResult> = {}): MarketingDecisionResult {
  return { recommendations: [], supersededCount: 0, evaluatedOpportunityCount: 0, ...overrides };
}

/** A deps set where every stage succeeds, recording how many times each was called. */
function successfulDeps() {
  const calls = { websiteAnalysis: 0, aiProfile: 0, marketContext: 0, opportunities: 0, decisionEngine: 0 };
  const deps: RecommendationPipelineDeps = {
    runWebsiteAnalysis: async () => {
      calls.websiteAnalysis++;
      return websiteAnalysis();
    },
    generateAiMarketingProfile: async () => {
      calls.aiProfile++;
      return { profile: aiProfile() };
    },
    refreshMarketContext: async () => {
      calls.marketContext++;
      return { briefWithItems: { brief: marketContextBrief(), items: [] } as MarketContextBriefWithItems };
    },
    evaluateOpportunities: async () => {
      calls.opportunities++;
      return opportunityResult();
    },
    runDecisionEngine: async () => {
      calls.decisionEngine++;
      return decisionResult();
    },
  };
  return { deps, calls };
}

function fakeClient(overrides: Record<string, unknown> = {}) {
  return createFakeSupabaseClient({
    business_profiles: { data: businessProfile(), error: null },
    website_analysis: { data: null, error: null },
    ai_marketing_profiles: { data: null, error: null },
    market_context_briefs: { data: null, error: null },
    market_context_items: { data: [], error: null },
    audit_logs: { data: null, error: null },
    ...overrides,
  });
}

test("successful pipeline: all five stages run and complete in order when nothing exists yet", async () => {
  const { client } = fakeClient();
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.businessProfileId, BIZ);
  assert.deepEqual(
    result.stages.map((s) => s.stage),
    PIPELINE_STAGE_ORDER
  );
  assert.ok(result.stages.every((s) => s.status === "completed"), JSON.stringify(result.stages));
  assert.deepEqual(calls, {
    websiteAnalysis: 1,
    aiProfile: 1,
    marketContext: 1,
    opportunities: 1,
    decisionEngine: 1,
  });
});

test("stage ordering is always fixed regardless of outcome", async () => {
  const { client } = fakeClient();
  const { deps } = successfulDeps();
  const result = await runRecommendationPipelineForUser(USER, client, deps);
  assert.deepEqual(
    result.stages.map((s) => s.stage),
    ["website_analysis", "ai_marketing_profile", "market_context", "opportunity_detection", "decision_engine"]
  );
});

test("no business profile: every stage is skipped with a clear reason, no stage function is called", async () => {
  const { client } = fakeClient({ business_profiles: { data: null, error: null } });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.businessProfileId, null);
  assert.equal(result.stages.length, 5);
  assert.ok(result.stages.every((s) => s.status === "skipped"));
  assert.ok(result.stages.every((s) => s.reason.includes("No business profile")));
  assert.deepEqual(calls, { websiteAnalysis: 0, aiProfile: 0, marketContext: 0, opportunities: 0, decisionEngine: 0 });
});

test("website_analysis is skipped when no website is configured", async () => {
  const { client } = fakeClient({ business_profiles: { data: businessProfile({ website: null }), error: null } });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  const stage = result.stages.find((s) => s.stage === "website_analysis")!;
  assert.equal(stage.status, "skipped");
  assert.match(stage.reason, /no website configured/i);
  assert.equal(calls.websiteAnalysis, 0);
  // Downstream, independent stages still ran.
  assert.equal(calls.aiProfile, 1);
  assert.equal(calls.marketContext, 1);
});

test("website_analysis is skipped when already completed (never duplicates a finished analysis)", async () => {
  const { client } = fakeClient({
    website_analysis: { data: websiteAnalysis({ analysis_status: "completed" }), error: null },
  });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  const stage = result.stages.find((s) => s.stage === "website_analysis")!;
  assert.equal(stage.status, "skipped");
  assert.match(stage.reason, /already completed/i);
  assert.equal(calls.websiteAnalysis, 0);
});

test("website_analysis is skipped while already running (avoids a concurrent duplicate run)", async () => {
  const { client } = fakeClient({
    website_analysis: { data: websiteAnalysis({ analysis_status: "running" }), error: null },
  });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.stages.find((s) => s.stage === "website_analysis")!.status, "skipped");
  assert.equal(calls.websiteAnalysis, 0);
});

test("website_analysis reruns a previously failed attempt", async () => {
  const { client } = fakeClient({
    website_analysis: { data: websiteAnalysis({ analysis_status: "failed" }), error: null },
  });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.stages.find((s) => s.stage === "website_analysis")!.status, "completed");
  assert.equal(calls.websiteAnalysis, 1);
});

test("ai_marketing_profile is skipped when already active", async () => {
  const { client } = fakeClient({
    ai_marketing_profiles: { data: aiProfile({ profile_status: "active" }), error: null },
  });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  const stage = result.stages.find((s) => s.stage === "ai_marketing_profile")!;
  assert.equal(stage.status, "skipped");
  assert.match(stage.reason, /already active/i);
  assert.equal(calls.aiProfile, 0);
});

test("ai_marketing_profile is skipped while already generating", async () => {
  const { client } = fakeClient({
    ai_marketing_profiles: { data: aiProfile({ profile_status: "generating" }), error: null },
  });
  const { deps, calls } = successfulDeps();

  await runRecommendationPipelineForUser(USER, client, deps);
  assert.equal(calls.aiProfile, 0);
});

test("market_context is skipped when the active brief is recent (within 7 days)", async () => {
  const { client } = fakeClient({
    market_context_briefs: {
      data: marketContextBrief({ status: "active", created_at: new Date().toISOString() }),
      error: null,
    },
  });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  const stage = result.stages.find((s) => s.stage === "market_context")!;
  assert.equal(stage.status, "skipped");
  assert.match(stage.reason, /recent/i);
  assert.equal(calls.marketContext, 0);
});

test("market_context reruns when the active brief is stale (older than 7 days)", async () => {
  const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { client } = fakeClient({
    market_context_briefs: { data: marketContextBrief({ status: "active", created_at: staleDate }), error: null },
  });
  const { deps, calls } = successfulDeps();

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.stages.find((s) => s.stage === "market_context")!.status, "completed");
  assert.equal(calls.marketContext, 1);
});

test("failure containment: a failing stage does not corrupt or block independent downstream stages", async () => {
  const { client } = fakeClient();
  const { deps, calls } = successfulDeps();
  deps.runWebsiteAnalysis = async () => {
    throw new Error("raw pg error: relation does not exist");
  };

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  const waStage = result.stages.find((s) => s.stage === "website_analysis")!;
  assert.equal(waStage.status, "failed");
  // Raw error message is never surfaced verbatim.
  assert.equal(waStage.reason.includes("relation does not exist"), false);

  // Every other, independent stage still ran normally.
  assert.equal(result.stages.find((s) => s.stage === "ai_marketing_profile")!.status, "completed");
  assert.equal(result.stages.find((s) => s.stage === "market_context")!.status, "completed");
  assert.equal(result.stages.find((s) => s.stage === "opportunity_detection")!.status, "completed");
  assert.equal(result.stages.find((s) => s.stage === "decision_engine")!.status, "completed");
  assert.equal(calls.aiProfile, 1);
  assert.equal(calls.opportunities, 1);
  assert.equal(calls.decisionEngine, 1);
});

test("decision_engine is skipped when opportunity_detection fails (its one real dependency)", async () => {
  const { client } = fakeClient();
  const { deps, calls } = successfulDeps();
  deps.evaluateOpportunities = async () => {
    throw new Error("db unreachable");
  };

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.stages.find((s) => s.stage === "opportunity_detection")!.status, "failed");
  const decisionStage = result.stages.find((s) => s.stage === "decision_engine")!;
  assert.equal(decisionStage.status, "skipped");
  assert.match(decisionStage.reason, /opportunity_detection failed/i);
  assert.equal(calls.decisionEngine, 0);
});

test("decision_engine still runs when opportunity_detection completes with zero opportunities", async () => {
  const { client } = fakeClient();
  const { deps, calls } = successfulDeps();
  deps.evaluateOpportunities = async () => opportunityResult({ opportunities: [] });

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.stages.find((s) => s.stage === "opportunity_detection")!.status, "completed");
  assert.equal(result.stages.find((s) => s.stage === "decision_engine")!.status, "completed");
  assert.equal(calls.decisionEngine, 1);
});

test("opportunity_detection stage fails cleanly when no business profile is found mid-run", async () => {
  const { client } = fakeClient();
  const { deps } = successfulDeps();
  deps.evaluateOpportunities = async () => null;

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  assert.equal(result.stages.find((s) => s.stage === "opportunity_detection")!.status, "failed");
  assert.equal(result.stages.find((s) => s.stage === "decision_engine")!.status, "skipped");
});

test("idempotent rerun: calling twice in a row skips already-fresh stages the second time", async () => {
  const { client } = fakeClient();
  const { deps, calls } = successfulDeps();

  const first = await runRecommendationPipelineForUser(USER, client, deps);
  assert.ok(first.stages.every((s) => s.status === "completed"));
  assert.deepEqual(calls, { websiteAnalysis: 1, aiProfile: 1, marketContext: 1, opportunities: 1, decisionEngine: 1 });

  // Simulate the persisted state a second run would actually see: analysis completed,
  // profile active, brief active-and-fresh (the fake client only returns the state I
  // configure up front, so this models "the first run's writes are now visible").
  const { client: client2 } = fakeClient({
    website_analysis: { data: websiteAnalysis({ analysis_status: "completed" }), error: null },
    ai_marketing_profiles: { data: aiProfile({ profile_status: "active" }), error: null },
    market_context_briefs: { data: marketContextBrief({ status: "active" }), error: null },
  });

  const second = await runRecommendationPipelineForUser(USER, client2, deps);

  assert.equal(second.stages.find((s) => s.stage === "website_analysis")!.status, "skipped");
  assert.equal(second.stages.find((s) => s.stage === "ai_marketing_profile")!.status, "skipped");
  assert.equal(second.stages.find((s) => s.stage === "market_context")!.status, "skipped");
  // Opportunity detection and the decision engine are cheap/idempotent by design and
  // always attempt again -- their own persistence layer (proven in
  // marketing-opportunities-persistence.test.ts / marketing-decisions-persistence.test.ts)
  // guarantees no duplicate rows, only status-preserving upserts.
  assert.equal(second.stages.find((s) => s.stage === "opportunity_detection")!.status, "completed");
  assert.equal(second.stages.find((s) => s.stage === "decision_engine")!.status, "completed");

  // Website analysis / AI profile / market context were NOT invoked a second time.
  assert.equal(calls.websiteAnalysis, 1);
  assert.equal(calls.aiProfile, 1);
  assert.equal(calls.marketContext, 1);
  // Opportunity detection and decision engine ran again (2nd time total).
  assert.equal(calls.opportunities, 2);
  assert.equal(calls.decisionEngine, 2);
});

test("tenant isolation: every query in a run is scoped to the userId passed in, never any other", async () => {
  const { client, calls } = fakeClient();
  const { deps } = successfulDeps();

  await runRecommendationPipelineForUser(USER, client, deps);

  const queriedUserIds = userIdsQueried(calls);
  assert.ok(queriedUserIds.length > 0, "expected at least one user_id-scoped query");
  assert.ok(
    queriedUserIds.every((id) => id === USER),
    `expected every query scoped to ${USER}, got: ${JSON.stringify(queriedUserIds)}`
  );
});

test("runRecommendationPipelineForCurrentUser requires cookies exactly like every other *ForCurrentUser wrapper", async () => {
  await assert.rejects(
    () => runRecommendationPipelineForCurrentUser(),
    /next\/headers\.cookies\(\) called outside a Next\.js request context/
  );
});

test("failure reasons never leak raw error text for any stage", async () => {
  const { client } = fakeClient();
  const { deps } = successfulDeps();
  deps.runWebsiteAnalysis = async () => {
    throw new Error("ECONNREFUSED 127.0.0.1:5432");
  };
  deps.generateAiMarketingProfile = async () => {
    throw new Error("OPENAI_API_KEY is not set");
  };
  deps.refreshMarketContext = async () => {
    throw new Error("stack trace leaked here");
  };
  deps.evaluateOpportunities = async () => {
    throw new Error("permission denied for table marketing_opportunities");
  };

  const result = await runRecommendationPipelineForUser(USER, client, deps);

  const rawFragments = ["ECONNREFUSED", "OPENAI_API_KEY", "stack trace", "permission denied", "5432"];
  for (const stage of result.stages) {
    for (const fragment of rawFragments) {
      assert.equal(
        stage.reason.includes(fragment),
        false,
        `stage ${stage.stage} reason leaked raw text: ${stage.reason}`
      );
    }
  }
});
