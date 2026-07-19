import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceCampaignForUser,
  completeCampaignStepForUser,
  getCampaignDashboardForBusiness,
  initiateCampaignForBusiness,
} from "../lib/campaign-intelligence/campaign-service.ts";
import { CampaignStatuses, CampaignTypes } from "../lib/campaign-intelligence/campaign-types.ts";
import { MarketingMemoryObservationTypes } from "../lib/marketing-memory/types.ts";
import { createFakeSupabaseClient } from "./support/fake-supabase-client.ts";

const USER = "user-1";
const BIZ = "biz-1";

function campaignRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "camp-1",
    user_id: USER,
    business_profile_id: BIZ,
    campaign_type: CampaignTypes.COMMUNITY_EVENT,
    objective: "Promote the fair",
    status: CampaignStatuses.DRAFT,
    start_date: "2026-08-10",
    target_end_date: "2026-08-12",
    current_step_index: 0,
    timeline: [
      {
        key: "com_timely",
        label: "Create timely local-event content",
        actionType: "create_timely_content",
        status: "scheduled",
        dayOffset: 0,
        scheduledFor: "2026-08-10",
        completedAt: null,
      },
      {
        key: "com_gbp",
        label: "Announce the event on Google",
        actionType: "publish_gbp_post",
        status: "pending",
        dayOffset: 1,
        scheduledFor: "2026-08-11",
        completedAt: null,
      },
      {
        key: "com_info",
        label: "Confirm business info is accurate for visitors",
        actionType: "update_business_info",
        status: "pending",
        dayOffset: 2,
        scheduledFor: "2026-08-12",
        completedAt: null,
      },
    ],
    metrics: {
      completionRate: 0,
      stepsCompleted: 0,
      stepsSkipped: 0,
      stepsTotal: 3,
      engagement: 0,
      publishingConsistency: 0,
      reviewActivity: 0,
      recommendationAcceptance: 0,
      campaignDurationDays: 2,
      campaignCompletionTimeDays: null,
    },
    created_from_recommendation_id: null,
    marketing_director_decision_key: "md|key",
    template_id: "tmpl_community_event_v1",
    schema_version: 1,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

test("initiateCampaignForBusiness: Marketing Director required", async () => {
  const created = campaignRow();
  const { client } = createFakeSupabaseClient({
    marketing_campaigns: (op) => {
      if (op === "single") return { data: created, error: null };
      return { data: null, error: null };
    },
  });

  const refused = await initiateCampaignForBusiness(
    USER,
    BIZ,
    {
      campaignType: CampaignTypes.COMMUNITY_EVENT,
      marketingDirectorDecisionKey: "x",
      initiatedBy: "campaign_engine",
    } as never,
    { supabaseClient: client },
  );
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.status, 403);

  const ok = await initiateCampaignForBusiness(
    USER,
    BIZ,
    {
      campaignType: CampaignTypes.COMMUNITY_EVENT,
      marketingDirectorDecisionKey: "md|key",
      startDate: "2026-08-10",
      initiatedBy: "marketing_director",
    },
    { supabaseClient: client },
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.campaign.campaign_type, CampaignTypes.COMMUNITY_EVENT);
    assert.equal(ok.campaign.marketing_director_decision_key, "md|key");
  }
});

test("dashboard cards load from active campaigns in one batched query path", async () => {
  const active = campaignRow({ status: CampaignStatuses.IN_PROGRESS });
  const { client } = createFakeSupabaseClient({
    marketing_campaigns: { data: [active], error: null },
  });

  const cards = await getCampaignDashboardForBusiness(USER, BIZ, { supabaseClient: client });
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.title, "Community Event");
  assert.ok(cards[0]!.nextMilestone);
  assert.equal(typeof cards[0]!.completionPercent, "number");
  assert.ok(cards[0]!.timeline.length >= 2);
});

test("campaign without Marketing Memory: completion still succeeds when observation recorder is a no-op", async () => {
  let observationCalls = 0;
  const inProgress = campaignRow({
    status: CampaignStatuses.IN_PROGRESS,
    timeline: [
      {
        key: "only",
        label: "Publish a Google post",
        actionType: "publish_gbp_post",
        status: "scheduled",
        dayOffset: 0,
        scheduledFor: "2026-08-10",
        completedAt: null,
      },
    ],
  });
  const completed = {
    ...inProgress,
    status: CampaignStatuses.COMPLETED,
    timeline: [
      {
        ...(inProgress.timeline as Array<Record<string, unknown>>)[0],
        status: "completed",
        completedAt: "2026-08-10T15:00:00.000Z",
      },
    ],
    metrics: {
      ...(inProgress.metrics as Record<string, unknown>),
      stepsCompleted: 1,
      completionRate: 1,
    },
  };

  const { client } = createFakeSupabaseClient({
    marketing_campaigns: (op) => {
      if (op === "maybeSingle") return { data: inProgress, error: null };
      if (op === "single") return { data: completed, error: null };
      return { data: inProgress, error: null };
    },
  });

  const result = await completeCampaignStepForUser(USER, "camp-1", "only", {
    supabaseClient: client,
    recordCompletionObservation: async () => {
      observationCalls += 1;
      return { recorded: false, duplicate: false, observationId: null };
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.campaign.status, CampaignStatuses.COMPLETED);
  }
  assert.equal(observationCalls, 1);
});

test("campaign with Marketing Memory: completion records campaign_completed observation", async () => {
  const observationTypes: string[] = [];
  const base = campaignRow();
  const almostDone = {
    ...base,
    status: CampaignStatuses.IN_PROGRESS,
    timeline: (base.timeline as Array<Record<string, unknown>>).map((step, index) =>
      index < 2
        ? {
            ...step,
            status: "completed",
            completedAt: "2026-08-10T12:00:00.000Z",
          }
        : step,
    ),
  };
  const completed = {
    ...almostDone,
    status: CampaignStatuses.COMPLETED,
    timeline: (almostDone.timeline as Array<Record<string, unknown>>).map((step) => ({
      ...step,
      status: "completed",
      completedAt: step.completedAt ?? "2026-08-12T12:00:00.000Z",
    })),
  };

  const { client } = createFakeSupabaseClient({
    marketing_campaigns: (op) => {
      if (op === "maybeSingle") return { data: almostDone, error: null };
      if (op === "single") return { data: completed, error: null };
      return { data: almostDone, error: null };
    },
  });

  const result = await completeCampaignStepForUser(USER, "camp-1", "com_info", {
    supabaseClient: client,
    recordCompletionObservation: async (_supabase, campaign) => {
      observationTypes.push(MarketingMemoryObservationTypes.CAMPAIGN_COMPLETED);
      assert.equal(campaign.id, "camp-1");
      return { recorded: true, duplicate: false, observationId: "obs-camp-1" };
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.campaign.status, CampaignStatuses.COMPLETED);
  assert.deepEqual(observationTypes, [MarketingMemoryObservationTypes.CAMPAIGN_COMPLETED]);
});

test("advanceCampaignForUser progresses lifecycle without creating recommendations", async () => {
  const draft = campaignRow({ status: CampaignStatuses.DRAFT });
  const planned = { ...draft, status: CampaignStatuses.PLANNED };
  const { client } = createFakeSupabaseClient({
    marketing_campaigns: (op) => {
      if (op === "maybeSingle") return { data: draft, error: null };
      if (op === "single") return { data: planned, error: null };
      return { data: draft, error: null };
    },
  });

  const result = await advanceCampaignForUser(USER, "camp-1", { supabaseClient: client });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.campaign.status, CampaignStatuses.PLANNED);
});
