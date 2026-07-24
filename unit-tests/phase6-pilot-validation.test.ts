import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  composeAdminObservability,
  composeJourneyValidationChecklist,
  composeOperationalValidation,
  composePilotReadinessAudit,
  composeProductionReadinessReport,
} from "../lib/assisted-pilot/pilotValidationCompose.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { TenantHealthStates } from "../lib/ops-dashboard/tenantHealthClassify.ts";
import type { CustomerSuccessCard } from "../lib/assisted-pilot/customerSuccessCompose.ts";

const root = process.cwd();

function sampleCard(overrides: Partial<CustomerSuccessCard> = {}): CustomerSuccessCard {
  return {
    businessProfileId: "biz-1",
    userId: "user-1",
    businessName: "Acme",
    onboardingCompleted: false,
    overallHealth: TenantHealthStates.WARNING,
    websiteConnected: false,
    googleConnected: false,
    googleDetail: "Disconnected",
    aiProfileComplete: false,
    brandVoiceComplete: false,
    marketingPlanGenerated: false,
    firstContentGenerated: false,
    firstApprovalCompleted: false,
    firstPublishCompleted: false,
    latestActivityAt: null,
    lastSuccessfulSyncAt: null,
    pendingApprovals: 0,
    publishFailures: 0,
    pilotBusinessId: null,
    pilotStatus: null,
    completionPercentage: null,
    checklist: [
      {
        id: "website",
        label: "Website analyzed",
        complete: false,
        blocked: true,
        detail: "Analysis failed",
        href: "/dashboard/website-analysis",
      },
    ],
    timeline: [],
    attentionKinds: ["onboarding", "google_business", "attention_needed"],
    setupPercent: 40,
    ...overrides,
  };
}

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("pilot readiness audit includes cron gate and setup signals", () => {
  const audit = composePilotReadinessAudit({
    cards: [sampleCard()],
    readiness: null,
    opsSummary: null,
    scheduleGateOpen: false,
  });
  assert.ok(audit.some((item) => item.id === "cron_gate" && item.tone === "ready"));
  assert.ok(audit.some((item) => item.id === "setup"));
  assert.ok(audit.some((item) => item.id === "trigger"));
});

test("operational validation highlights inconsistent onboarding", () => {
  const items = composeOperationalValidation({
    cards: [
      sampleCard({
        onboardingCompleted: true,
        setupPercent: 50,
      }),
    ],
    readiness: null,
    opsSummary: null,
    stuckJobCount: 1,
    scheduleGateOpen: false,
  });
  const onboarding = items.find((item) => item.id === "onboarding_consistency");
  assert.equal(onboarding?.inconsistent, true);
  assert.equal(items.find((item) => item.id === "retry_actions")?.tone, "warning");
});

test("journey checklist covers required operator scenarios", () => {
  const journey = composeJourneyValidationChecklist({
    cards: [
      sampleCard({
        onboardingCompleted: true,
        googleConnected: true,
        firstApprovalCompleted: true,
        firstPublishCompleted: true,
        attentionKinds: [],
        overallHealth: TenantHealthStates.HEALTHY,
      }),
    ],
  });
  const ids = journey.map((item) => item.id);
  for (const required of [
    "new_customer",
    "returning_customer",
    "gbp_connected",
    "gbp_disconnected",
    "website_unavailable",
    "content_approval",
    "publishing",
    "recovery",
    "completion",
  ]) {
    assert.ok(ids.includes(required), `missing ${required}`);
  }
});

test("production readiness report never opens the cron gate", () => {
  const report = composeProductionReadinessReport({
    readiness: null,
    opsSummary: null,
    attention: [],
    cards: [sampleCard()],
    openIssues: [],
    stuckJobCount: 0,
    scheduleGateOpen: false,
    generatedAt: new Date().toISOString(),
  });
  assert.equal(report.scheduleGateOpen, false);
  assert.ok(
    report.requiredManualActions.some((action) =>
      action.label.includes("ATTACH_DECLARATIVE_PRODUCTION_CRONS"),
    ),
  );
  assert.ok(report.healthySystems.some((item) => item.label.includes("cron gate")));
});

test("observability aggregates use existing card and ops signals only", () => {
  const obs = composeAdminObservability({
    cards: [
      sampleCard({ overallHealth: TenantHealthStates.BLOCKED, attentionKinds: ["inactive", "attention_needed"] }),
      sampleCard({
        businessProfileId: "biz-2",
        onboardingCompleted: true,
        overallHealth: TenantHealthStates.HEALTHY,
        attentionKinds: [],
        firstPublishCompleted: true,
        firstApprovalCompleted: true,
      }),
    ],
    opsSummary: {
      generatedAt: new Date().toISOString(),
      correlationId: "corr",
      scheduleGateOpen: false,
      sections: [
        {
          id: "publishing_queue",
          title: "Publishing Queue",
          counts: { pending: 0, running: 0, failed: 0, completed: 2, retrying: 0 },
          lastExecutionAt: null,
          lastError: null,
          averageDurationMs: null,
          queueDepth: 0,
        },
        {
          id: "approval_activity",
          title: "Approval Activity",
          counts: { pending: 0, running: 0, failed: 0, completed: 1, retrying: 0 },
          lastExecutionAt: null,
          lastError: null,
          averageDurationMs: null,
          queueDepth: 0,
        },
      ],
      alertCounts: { info: 0, warning: 0, critical: 0 },
    },
    stuckJobCount: 3,
    openIssues: [],
  });
  assert.equal(obs.customersBlocked, 1);
  assert.equal(obs.customersInactive, 1);
  assert.equal(obs.customersFullyOnboarded, 1);
  assert.equal(obs.stuckJobs, 3);
  assert.ok(obs.recentPublishes >= 2);
  assert.ok(obs.recentApprovals >= 1);
});

test("Phase 6 surfaces and validation guide exist", () => {
  assert.match(
    readFileSync(join(root, "app/dashboard/admin/pilot-validation/page.tsx"), "utf8"),
    /buildPilotValidationDashboard/,
  );
  assert.match(
    readFileSync(join(root, "components/dashboard/pilot-validation-dashboard.tsx"), "utf8"),
    /Pilot readiness audit/,
  );
  assert.match(
    readFileSync(join(root, "components/dashboard/admin-ops-dashboard.tsx"), "utf8"),
    /pilot-validation/,
  );
  const guide = readFileSync(join(root, "docs/PILOT_VALIDATION_GUIDE.md"), "utf8");
  assert.match(guide, /Daily validation/);
  assert.match(guide, /Criteria before enabling schedules/);
  assert.match(guide, /Rollback considerations/);
  assert.match(guide, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
});

test("schedule activation module untouched", () => {
  const schedule = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(schedule, /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/);
});
