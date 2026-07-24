import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  composeAttentionCenter,
  composeCustomerSuccessCards,
  filterCustomerSuccessCards,
  PILOT_FEEDBACK_TYPES,
} from "../lib/assisted-pilot/customerSuccessCompose.ts";
import { GUIDED_RECOVERY_ACTIONS, recoveryActionsForAttention } from "../lib/assisted-pilot/recoveryLinks.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { TenantHealthStates } from "../lib/ops-dashboard/tenantHealthClassify.ts";

const root = process.cwd();

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("guided recovery only points at existing product routes", () => {
  for (const action of GUIDED_RECOVERY_ACTIONS) {
    assert.match(action.href, /^\/dashboard(\/|$)/);
  }
  assert.ok(recoveryActionsForAttention("publishing").some((a) => a.id === "retry_publishing"));
});

test("customer success filters use existing health signals", () => {
  const cards = composeCustomerSuccessCards({
    pilot: null,
    tenants: {
      page: 1,
      pageSize: 20,
      totalCount: 1,
      tenants: [
        {
          businessProfileId: "biz-1",
          userId: "user-1",
          businessName: "Acme",
          onboardingCompleted: false,
          createdAt: new Date().toISOString(),
          overallState: TenantHealthStates.WARNING,
          dimensions: [
            {
              key: "google_business",
              label: "Google",
              state: TenantHealthStates.WARNING,
              detail: "Disconnected",
            },
            {
              key: "publishing",
              label: "Publishing",
              state: TenantHealthStates.HEALTHY,
              detail: "0 failed",
            },
            {
              key: "approvals",
              label: "Approvals",
              state: TenantHealthStates.HEALTHY,
              detail: "0 pending",
            },
            {
              key: "setup",
              label: "Setup",
              state: TenantHealthStates.WARNING,
              detail: "1/5 required",
            },
          ],
        },
      ],
    },
  });
  assert.equal(cards.length, 1);
  assert.ok(cards[0]?.attentionKinds.includes("onboarding"));
  assert.ok(cards[0]?.attentionKinds.includes("google_business"));
  assert.equal(filterCustomerSuccessCards(cards, "google_issue").length, 1);
});

test("attention center composes recovery without fabricating events", () => {
  const cards = composeCustomerSuccessCards({
    pilot: {
      generatedAt: new Date().toISOString(),
      scheduleGateOpen: false,
      pilots: [],
      openIssues: [],
      aggregateReadiness: {
        total: 0,
        dimensions: [],
        launchRecommendation: "Not Ready" as const,
      },
      launchRecommendation: "Not Ready" as const,
    },
    tenants: {
      page: 1,
      pageSize: 20,
      totalCount: 0,
      tenants: [],
    },
  });
  const attention = composeAttentionCenter({
    cards,
    openIssues: [
      {
        id: "issue-1",
        pilotBusinessId: null,
        severity: "high",
        category: "ux",
        workflowStage: null,
        description: "Confusing approvals wording",
        status: "open",
        owner: null,
        resolution: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    stuckJobCount: 2,
  });
  assert.ok(attention.some((item) => item.id === "stuck-jobs"));
  assert.ok(attention.some((item) => item.id.startsWith("issue-")));
});

test("pilot feedback types stay intentionally simple", () => {
  const ids = PILOT_FEEDBACK_TYPES.map((t) => t.id);
  assert.ok(ids.includes("bug"));
  assert.ok(ids.includes("confusing_workflow"));
  assert.ok(ids.includes("feature_request"));
});

test("Phase 5 surfaces and runbook exist", () => {
  assert.match(
    readFileSync(join(root, "app/dashboard/admin/customer-success/page.tsx"), "utf8"),
    /buildCustomerSuccessDashboard/,
  );
  assert.match(
    readFileSync(join(root, "components/dashboard/customer-success-dashboard.tsx"), "utf8"),
    /Attention Center/,
  );
  assert.match(
    readFileSync(join(root, "components/dashboard/admin-ops-dashboard.tsx"), "utf8"),
    /customer-success/,
  );
  const runbook = readFileSync(join(root, "docs/PILOT_RUNBOOK.md"), "utf8");
  assert.match(runbook, /Daily operator checklist/);
  assert.match(runbook, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
  assert.match(runbook, /Pilot exit checklist/);
});

test("schedule activation module untouched", () => {
  const schedule = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(schedule, /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/);
});
