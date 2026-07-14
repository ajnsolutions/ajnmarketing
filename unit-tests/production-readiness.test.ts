import test from "node:test";
import assert from "node:assert/strict";
import {
  FailureInjectionFaults,
  getFailureInjectionState,
  isFailureInjectionAllowed,
  isFaultActive,
  maybeInjectFailure,
  InjectedFailureError,
} from "../lib/failure-injection/gate.ts";
import { evaluateOpsAlerts } from "../lib/production-alerts/evaluate.ts";
import { runProductionHealthChecks } from "../lib/production-health/service.ts";
import { runWorkflowValidationHarness } from "../lib/workflow-validation/harness.ts";
import {
  createCorrelationId,
  sanitizeWorkflowMetadata,
} from "../lib/observability/workflowLogger.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for production readiness", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("failure injection is disabled by default and blocked in production", () => {
  assert.equal(isFailureInjectionAllowed({ NODE_ENV: "test" }), false);
  assert.equal(
    isFailureInjectionAllowed({
      NODE_ENV: "production",
      FAILURE_INJECTION_ENABLED: "true",
    }),
    false
  );
  assert.equal(
    isFailureInjectionAllowed({
      VERCEL_ENV: "production",
      FAILURE_INJECTION_ENABLED: "true",
      NODE_ENV: "development",
    }),
    false
  );

  const enabled = getFailureInjectionState({
    NODE_ENV: "development",
    FAILURE_INJECTION_ENABLED: "true",
    FAILURE_INJECTION_FAULTS: "openai_outage,duplicate_publish",
  });
  assert.equal(enabled.enabled, true);
  assert.deepEqual(enabled.activeFaults, [
    FailureInjectionFaults.OPENAI_OUTAGE,
    FailureInjectionFaults.DUPLICATE_PUBLISH,
  ]);
  assert.equal(
    isFaultActive(FailureInjectionFaults.OPENAI_OUTAGE, {
      NODE_ENV: "development",
      FAILURE_INJECTION_ENABLED: "true",
      FAILURE_INJECTION_FAULTS: "openai_outage",
    }),
    true
  );
  assert.throws(
    () =>
      maybeInjectFailure(FailureInjectionFaults.GOOGLE_FAILURE, {
        NODE_ENV: "development",
        FAILURE_INJECTION_ENABLED: "true",
        FAILURE_INJECTION_FAULTS: "google_failure",
      }),
    InjectedFailureError
  );
});

test("health checks never open the cron gate and never include secrets", async () => {
  const report = await runProductionHealthChecks();
  assert.ok(report.correlationId);
  assert.ok(report.checks.length >= 8);
  const schedules = report.checks.find((c) => c.title.includes("Declarative production cron"));
  assert.ok(schedules);
  assert.equal(schedules?.status, "healthy");
  const blob = JSON.stringify(report);
  assert.equal(blob.includes("sk-"), false);
  assert.equal(blob.toLowerCase().includes("service_role"), false);
});

test("alert evaluation covers publishing, oauth, retries, and injection", () => {
  const previous = process.env.FAILURE_INJECTION_ENABLED;
  delete process.env.FAILURE_INJECTION_ENABLED;
  try {
    const quiet = evaluateOpsAlerts({});
    assert.equal(quiet.alerts.length, 0);

    const noisy = evaluateOpsAlerts({
      publishingFailedCount: 5,
      publishingRetryingCount: 6,
      oauthDisconnectedCount: 2,
      recommendationExecutionFailures24h: 4,
      analyticsBacklogCount: 12,
      emailGenerationFailures24h: 1,
      approvalFailures24h: 1,
      highRetryJobCount: 2,
    });
    assert.ok(noisy.counts.critical >= 1);
    assert.ok(noisy.counts.warning >= 1);
    assert.ok(noisy.alerts.some((a) => a.id === "publishing-repeated-failures"));
    assert.ok(noisy.alerts.some((a) => a.id === "oauth-disconnected"));
  } finally {
    if (previous === undefined) delete process.env.FAILURE_INJECTION_ENABLED;
    else process.env.FAILURE_INJECTION_ENABLED = previous;
  }
});

test("workflow validation harness covers the autonomous loop contracts", () => {
  const report = runWorkflowValidationHarness({
    attachDeclarativeProductionCrons: false,
    autoPublishingEnabled: false,
    autoApprovalEnabled: false,
  });
  assert.equal(report.ok, true);
  assert.equal(report.scenarios.length, 12);
  assert.ok(report.scenarios.every((s) => s.ok));

  const blocked = runWorkflowValidationHarness({
    attachDeclarativeProductionCrons: true,
    autoPublishingEnabled: false,
    autoApprovalEnabled: false,
  });
  assert.equal(blocked.ok, false);
});

test("workflow logger sanitizes secrets and private content keys", () => {
  const id = createCorrelationId();
  assert.ok(id.length > 10);
  const sanitized = sanitizeWorkflowMetadata({
    access_token: "secret",
    prompt: "private",
    content: "draft body",
    retryCount: 2,
    stage: "publishing",
    nested: { access_token: "nested-secret", ok: true },
  });
  assert.equal("access_token" in sanitized, false);
  assert.equal("prompt" in sanitized, false);
  assert.equal("content" in sanitized, false);
  assert.equal(sanitized.retryCount, 2);
  assert.equal(sanitized.stage, "publishing");
  assert.deepEqual(sanitized.nested, { ok: true });
});
