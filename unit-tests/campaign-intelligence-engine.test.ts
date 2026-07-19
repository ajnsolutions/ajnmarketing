import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  applyStepCompletion,
  progressCampaignLifecycle,
  shouldRecordCampaignCompletionObservation,
  snapshotCampaign,
} from "../lib/campaign-intelligence/campaign-engine.ts";
import { computeCampaignMetrics, emptyCampaignMetrics } from "../lib/campaign-intelligence/campaign-metrics.ts";
import { planCampaignFromDirector } from "../lib/campaign-intelligence/campaign-planner.ts";
import { parseInitiateCampaignRequestBody } from "../lib/campaign-intelligence/campaign-request.ts";
import {
  advanceCampaignStatus,
  canTransitionCampaignStatus,
} from "../lib/campaign-intelligence/campaign-state.ts";
import {
  getCampaignTemplate,
  listCampaignTemplates,
} from "../lib/campaign-intelligence/campaign-templates.ts";
import {
  buildTimelineFromTemplate,
  completeTimelineStep,
  nextMilestone,
  orderTimeline,
  partitionTimeline,
  timelineCompletionPercent,
} from "../lib/campaign-intelligence/campaign-timeline.ts";
import {
  CampaignStatuses,
  CampaignTypes,
  type MarketingCampaign,
} from "../lib/campaign-intelligence/campaign-types.ts";
import { buildCampaignInitiationFromDirectorDecision } from "../lib/marketing-director/campaignInitiation.ts";
import { resolveMarketingDirectorDecision } from "../lib/marketing-director/resolveDecision.ts";
import type { MarketingDirectorInput } from "../lib/marketing-director/types.ts";
import { RecommendedActionTypes } from "../lib/marketing-decisions/types.ts";

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

function sampleCampaign(overrides: Partial<MarketingCampaign> = {}): MarketingCampaign {
  const draft = planCampaignFromDirector({
    campaignType: CampaignTypes.BACK_TO_SCHOOL,
    marketingDirectorDecisionKey: "md|test",
    startDate: "2026-08-01",
    initiatedBy: "marketing_director",
  });
  return {
    id: "camp-1",
    user_id: "user-1",
    business_profile_id: "biz-1",
    ...draft,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Campaign Intelligence", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("template loading: all six declarative campaign types are present", () => {
  const templates = listCampaignTemplates();
  assert.equal(templates.length, 6);
  for (const type of Object.values(CampaignTypes)) {
    const template = getCampaignTemplate(type);
    assert.ok(template, type);
    assert.ok(template!.steps.length >= 2, type);
    for (const step of template!.steps) {
      assert.ok(Object.values(RecommendedActionTypes).includes(step.actionType), step.actionType);
    }
  }
});

test("campaign creation: Marketing Director gate required", () => {
  assert.throws(
    () =>
      planCampaignFromDirector({
        campaignType: CampaignTypes.HIRING,
        marketingDirectorDecisionKey: "x",
        initiatedBy: "campaign_engine",
      } as Parameters<typeof planCampaignFromDirector>[0]),
    /Marketing Director/,
  );

  const parsed = parseInitiateCampaignRequestBody({
    campaignType: CampaignTypes.HIRING,
    marketingDirectorDecisionKey: "key",
    initiatedBy: "someone_else",
  });
  assert.equal(parsed.ok, false);
});

test("campaign creation: identical input => identical campaign plan", () => {
  const input = {
    campaignType: CampaignTypes.HOLIDAY_PROMOTION,
    objective: "Drive holiday visits",
    marketingDirectorDecisionKey: "decision|abc",
    startDate: "2026-12-01",
    initiatedBy: "marketing_director" as const,
  };
  assert.deepEqual(planCampaignFromDirector(input), planCampaignFromDirector(input));
});

test("Marketing Director initiated campaigns: handoff helper builds valid initiation", () => {
  const decision = resolveMarketingDirectorDecision(mdInput(), NOW);
  const initiation = buildCampaignInitiationFromDirectorDecision(decision, {
    campaignType: CampaignTypes.CUSTOMER_APPRECIATION,
    objective: "Thank regulars",
    startDate: "2026-09-01",
  });
  assert.equal(initiation.initiatedBy, "marketing_director");
  assert.ok(initiation.marketingDirectorDecisionKey.includes(decision.decisionType));
  const plan = planCampaignFromDirector(initiation);
  assert.equal(plan.campaign_type, CampaignTypes.CUSTOMER_APPRECIATION);
  assert.equal(plan.status, CampaignStatuses.DRAFT);
  assert.ok(plan.marketing_director_decision_key);
});

test("timeline ordering is deterministic by dayOffset then key", () => {
  const template = getCampaignTemplate(CampaignTypes.SEASONAL_PROMOTION)!;
  const timeline = buildTimelineFromTemplate(template, "2026-10-01");
  const ordered = orderTimeline(timeline);
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(
      ordered[i - 1]!.dayOffset < ordered[i]!.dayOffset ||
        (ordered[i - 1]!.dayOffset === ordered[i]!.dayOffset &&
          ordered[i - 1]!.key <= ordered[i]!.key),
    );
  }
  assert.equal(ordered[0]!.status, "scheduled");
  assert.equal(nextMilestone(ordered), ordered[0]!.label);
});

test("step completion advances schedule and metrics", () => {
  const campaign = sampleCampaign({ status: CampaignStatuses.SCHEDULED });
  const firstKey = campaign.timeline[0]!.key;
  const after = applyStepCompletion(campaign, firstKey, "2026-08-01T15:00:00.000Z");
  assert.equal(after.timeline.find((s) => s.key === firstKey)?.status, "completed");
  assert.equal(after.status, CampaignStatuses.IN_PROGRESS);
  assert.ok(after.metrics.stepsCompleted >= 1);
  assert.equal(after.metrics.stepsTotal, campaign.timeline.length);

  const partitions = partitionTimeline(after.timeline);
  assert.ok(partitions.completed.length >= 1);
});

test("campaign progression follows deterministic lifecycle", () => {
  assert.equal(canTransitionCampaignStatus("draft", "planned"), true);
  assert.equal(canTransitionCampaignStatus("draft", "completed"), false);
  assert.equal(advanceCampaignStatus("draft"), "planned");
  assert.equal(advanceCampaignStatus("measured"), "archived");
  assert.equal(advanceCampaignStatus("archived"), "archived");

  let campaign = sampleCampaign({ status: CampaignStatuses.DRAFT });
  for (const expected of [
    CampaignStatuses.PLANNED,
    CampaignStatuses.APPROVED,
    CampaignStatuses.SCHEDULED,
    CampaignStatuses.IN_PROGRESS,
    CampaignStatuses.COMPLETED,
  ] as const) {
    const next = progressCampaignLifecycle(campaign);
    assert.equal(next.status, expected);
    campaign = { ...campaign, ...next };
  }

  assert.equal(
    shouldRecordCampaignCompletionObservation(CampaignStatuses.IN_PROGRESS, CampaignStatuses.COMPLETED),
    true,
  );
  assert.equal(
    shouldRecordCampaignCompletionObservation(CampaignStatuses.COMPLETED, CampaignStatuses.MEASURED),
    false,
  );
});

test("completion metrics are deterministic counts — no AI scoring", () => {
  const timeline = completeTimelineStep(
    buildTimelineFromTemplate(getCampaignTemplate(CampaignTypes.HIRING)!, "2026-07-01"),
    "hire_gbp",
    "2026-07-01T12:00:00.000Z",
  );
  const metrics = computeCampaignMetrics({
    timeline,
    startDate: "2026-07-01",
    targetEndDate: "2026-07-10",
    completedAtDate: "2026-07-08",
  });
  assert.equal(metrics.stepsCompleted, 1);
  assert.equal(metrics.stepsSkipped, 0);
  assert.equal(metrics.stepsTotal, 3);
  assert.equal(metrics.completionRate, Math.round((1 / 3) * 1000) / 1000);
  assert.equal(metrics.campaignDurationDays, 9);
  assert.equal(metrics.campaignCompletionTimeDays, 7);
  assert.deepEqual(emptyCampaignMetrics().engagement, 0);
  assert.equal(timelineCompletionPercent(timeline) > 0, true);
});

test("snapshot exposes UI timeline partitions", () => {
  const campaign = sampleCampaign({ status: CampaignStatuses.IN_PROGRESS });
  const snap = snapshotCampaign(campaign);
  assert.ok(snap.nextMilestone);
  assert.equal(typeof snap.completionPercent, "number");
  assert.ok(Array.isArray(snap.partitions.pending) || Array.isArray(snap.partitions.scheduled));
});

test("Campaign Engine creates no recommendations and adds no LLM/ML/providers", () => {
  const engine = readFileSync(join(root, "lib/campaign-intelligence/campaign-engine.ts"), "utf8");
  const planner = readFileSync(join(root, "lib/campaign-intelligence/campaign-planner.ts"), "utf8");
  const service = readFileSync(join(root, "lib/campaign-intelligence/campaign-service.ts"), "utf8");
  const blob = `${engine}\n${planner}\n${service}`;
  assert.doesNotMatch(blob, /openai|OpenAI|anthropic|generateRecommendation|createRecommendation/i);
  assert.doesNotMatch(blob, /schedules\.task|ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*true/);
  assert.match(planner, /never invents recommendations|Never invents recommendations/i);
});

test("regression: recommendation decision engine file still owns recommendation generation", () => {
  const decisionEngine = readFileSync(
    join(root, "lib/marketing-decisions/decisionEngine.ts"),
    "utf8",
  );
  assert.match(decisionEngine, /recommendedActionType|RecommendedAction/);
  const gate = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(gate, /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/);
});
