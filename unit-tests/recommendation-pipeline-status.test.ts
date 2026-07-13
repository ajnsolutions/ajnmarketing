import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPipelineAuditMetadata,
  buildPipelineStageSummary,
  derivePipelineOverallStatus,
  mapPipelineStatusToAuditStatus,
  type PipelineStageResult,
} from "../lib/recommendation-pipeline/types.ts";

function stages(
  statuses: Array<PipelineStageResult["status"]>
): PipelineStageResult[] {
  const names = [
    "website_analysis",
    "ai_marketing_profile",
    "market_context",
    "opportunity_detection",
    "decision_engine",
  ] as const;
  return statuses.map((status, index) => ({
    stage: names[index]!,
    status,
    reason: status,
  }));
}

test("derivePipelineOverallStatus: SUCCESS when no failures", () => {
  assert.equal(
    derivePipelineOverallStatus(stages(["completed", "completed", "skipped", "completed", "completed"])),
    "success"
  );
  assert.equal(
    derivePipelineOverallStatus(stages(["skipped", "skipped", "skipped", "skipped", "skipped"])),
    "success"
  );
});

test("derivePipelineOverallStatus: PARTIAL_SUCCESS when mixed completed + failed", () => {
  assert.equal(
    derivePipelineOverallStatus(stages(["failed", "completed", "completed", "completed", "completed"])),
    "partial_success"
  );
});

test("derivePipelineOverallStatus: FAILURE when failures and zero completions", () => {
  assert.equal(
    derivePipelineOverallStatus(stages(["failed", "failed", "failed", "failed", "skipped"])),
    "failure"
  );
});

test("buildPipelineStageSummary: operator-visible label without nested digging", () => {
  const status = "partial_success" as const;
  const summary = buildPipelineStageSummary(
    stages(["failed", "completed", "skipped", "completed", "completed"]),
    status
  );
  assert.equal(summary.completed, 3);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.label, "partial_success: 3 completed, 1 skipped, 1 failed");
  assert.deepEqual(summary.failedStages, ["website_analysis"]);
});

test("mapPipelineStatusToAuditStatus: failure -> failure; success/partial -> success", () => {
  assert.equal(mapPipelineStatusToAuditStatus("success"), "success");
  assert.equal(mapPipelineStatusToAuditStatus("partial_success"), "success");
  assert.equal(mapPipelineStatusToAuditStatus("failure"), "failure");
});

test("buildPipelineAuditMetadata: flat fields for operators", () => {
  const status = "partial_success" as const;
  const stageResults = stages(["failed", "completed", "skipped", "completed", "completed"]);
  const summary = buildPipelineStageSummary(stageResults, status);
  const metadata = buildPipelineAuditMetadata({
    status,
    summary,
    durationMs: 42,
    stages: stageResults,
  });

  assert.equal(metadata.pipelineStatus, "partial_success");
  assert.equal(metadata.summary, summary.label);
  assert.equal(metadata.completed, 3);
  assert.equal(metadata.skipped, 1);
  assert.equal(metadata.failed, 1);
  assert.equal(metadata.durationMs, 42);
  // Operators can read outcome without inspecting stages[].
  assert.equal(typeof metadata.summary, "string");
  assert.equal(Array.isArray(metadata.failedStages), true);
});
