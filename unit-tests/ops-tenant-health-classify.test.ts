import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyTenantDimensions,
  worstTenantState,
  TenantHealthStates,
} from "../lib/ops-dashboard/tenantHealthClassify.ts";
import type { CustomerSetupSnapshot } from "../lib/customer-setup/types.ts";
import type { GoogleBusinessProfileConnectionStatus } from "../lib/google-business-profile/types.ts";

function setup(overrides: Partial<CustomerSetupSnapshot> = {}): CustomerSetupSnapshot {
  return {
    businessProfileId: "biz-1",
    overallStatus: "complete",
    readinessExplanation: "",
    requiredComplete: 3,
    requiredTotal: 3,
    optionalComplete: 0,
    optionalTotal: 10,
    requiredPercentComplete: 100,
    canEnterMainProduct: true,
    headOfMarketingReady: true,
    publishingReady: false,
    googleBusinessDataAvailable: false,
    nextStepKey: null,
    steps: [],
    blockedStepKeys: [],
    needsAttentionStepKeys: [],
    preferences: null,
    warnings: [],
    ...overrides,
  } as CustomerSetupSnapshot;
}

function gbp(
  overrides: Partial<GoogleBusinessProfileConnectionStatus> = {}
): GoogleBusinessProfileConnectionStatus {
  return {
    setupRequired: false,
    setupMessage: undefined,
    connected: false,
    connection: null,
    scopesValid: true,
    missingScopes: [],
    ...overrides,
  } as GoogleBusinessProfileConnectionStatus;
}

test("fully healthy tenant: all dimensions healthy", () => {
  const dims = classifyTenantDimensions({
    setup: setup(),
    gbp: gbp({ connected: true, connection: { connection_status: "connected" } as never }),
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 0, overdue: 0 },
    jobFailures: 0,
  });
  assert.ok(dims.every((d) => d.state === TenantHealthStates.HEALTHY));
  assert.equal(worstTenantState(dims.map((d) => d.state)), TenantHealthStates.HEALTHY);
});

test("incomplete setup is a warning, not blocked", () => {
  const dims = classifyTenantDimensions({
    setup: setup({ requiredComplete: 1, requiredTotal: 3 }),
    gbp: gbp(),
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 0, overdue: 0 },
    jobFailures: 0,
  });
  const setupDim = dims.find((d) => d.key === "setup")!;
  assert.equal(setupDim.state, TenantHealthStates.WARNING);
});

test("Google Business never connected is intentionally_unused, not a failure", () => {
  const dims = classifyTenantDimensions({
    setup: setup(),
    gbp: gbp({ connected: false, connection: null }),
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 0, overdue: 0 },
    jobFailures: 0,
  });
  const gbpDim = dims.find((d) => d.key === "google_business")!;
  assert.equal(gbpDim.state, TenantHealthStates.INTENTIONALLY_UNUSED);
});

test("Google Business globally unavailable (setupRequired) is unavailable, distinct from disconnected", () => {
  const dims = classifyTenantDimensions({
    setup: setup(),
    gbp: gbp({ setupRequired: true }),
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 0, overdue: 0 },
    jobFailures: 0,
  });
  const gbpDim = dims.find((d) => d.key === "google_business")!;
  assert.equal(gbpDim.state, TenantHealthStates.UNAVAILABLE);
});

test("Google Business reauthorization required (previously connected, now expired) is a warning", () => {
  const dims = classifyTenantDimensions({
    setup: setup(),
    gbp: gbp({
      connected: false,
      connection: { connection_status: "expired" } as never,
    }),
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 0, overdue: 0 },
    jobFailures: 0,
  });
  const gbpDim = dims.find((d) => d.key === "google_business")!;
  assert.equal(gbpDim.state, TenantHealthStates.WARNING);
});

test("failed publishing jobs block the publishing dimension", () => {
  const dims = classifyTenantDimensions({
    setup: setup(),
    gbp: gbp(),
    publishing: { failed: 2, queued: 0, retrying: 0 },
    approvals: { pending: 0, overdue: 0 },
    jobFailures: 0,
  });
  const publishingDim = dims.find((d) => d.key === "publishing")!;
  assert.equal(publishingDim.state, TenantHealthStates.BLOCKED);
  assert.equal(worstTenantState(dims.map((d) => d.state)), TenantHealthStates.BLOCKED);
});

test("pending but not overdue approvals stay healthy", () => {
  const dims = classifyTenantDimensions({
    setup: setup(),
    gbp: gbp(),
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 3, overdue: 0 },
    jobFailures: 0,
  });
  const approvalsDim = dims.find((d) => d.key === "approvals")!;
  assert.equal(approvalsDim.state, TenantHealthStates.HEALTHY);
});

test("overdue approvals are a warning", () => {
  const dims = classifyTenantDimensions({
    setup: setup(),
    gbp: gbp(),
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 3, overdue: 1 },
    jobFailures: 0,
  });
  const approvalsDim = dims.find((d) => d.key === "approvals")!;
  assert.equal(approvalsDim.state, TenantHealthStates.WARNING);
});

test("missing setup or GBP data is unknown, not silently healthy", () => {
  const dims = classifyTenantDimensions({
    setup: null,
    gbp: null,
    publishing: { failed: 0, queued: 0, retrying: 0 },
    approvals: { pending: 0, overdue: 0 },
    jobFailures: 0,
  });
  assert.equal(dims.find((d) => d.key === "setup")!.state, TenantHealthStates.UNKNOWN);
  assert.equal(dims.find((d) => d.key === "google_business")!.state, TenantHealthStates.UNKNOWN);
});

test("worstTenantState prioritizes blocked over warning over unknown over healthy", () => {
  assert.equal(
    worstTenantState([TenantHealthStates.HEALTHY, TenantHealthStates.WARNING, TenantHealthStates.BLOCKED]),
    TenantHealthStates.BLOCKED
  );
  assert.equal(
    worstTenantState([TenantHealthStates.HEALTHY, TenantHealthStates.UNKNOWN]),
    TenantHealthStates.UNKNOWN
  );
  assert.equal(worstTenantState([TenantHealthStates.HEALTHY]), TenantHealthStates.HEALTHY);
});
