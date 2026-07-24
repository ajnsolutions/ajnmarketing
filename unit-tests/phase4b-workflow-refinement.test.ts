import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  approvalAttentionSummary,
  customerPublishingJobLabel,
  customerPublishingQueueLabel,
  LIBRARY_ZONES,
  publishingJobStatusGuide,
  publishingQueueStatusGuide,
} from "../lib/customer-ux/workflowPresentation.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { formatPublishingJobStatus } from "../lib/publishing/publishingStatus.ts";
import { formatPublishingStatus } from "../lib/publishing-queue/persistence.ts";
import { formatApprovalStatus } from "../lib/content-approval/persistence.ts";

const root = process.cwd();

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("publishing queue statuses use plain customer language", () => {
  assert.equal(formatPublishingStatus("ready"), "Approved · Ready");
  assert.equal(formatPublishingStatus("scheduled"), "Waiting · Scheduled");
  assert.equal(formatPublishingStatus("failed"), "Failed · Retry available");
  assert.equal(customerPublishingQueueLabel("ready"), "Approved · Ready");
  const guide = publishingQueueStatusGuide("ready");
  assert.match(guide.needAction, /Publish|schedule/i);
  assert.ok(guide.happening.length > 0);
  assert.ok(guide.next.length > 0);
});

test("publishing job statuses avoid engine jargon", () => {
  assert.equal(formatPublishingJobStatus("scheduled"), "Waiting");
  assert.equal(formatPublishingJobStatus("verified"), "Published · Confirmed");
  assert.equal(formatPublishingJobStatus("failed"), "Failed · Retry available");
  assert.equal(customerPublishingJobLabel("queued"), "Queued");
  assert.match(publishingJobStatusGuide("publishing").needAction, /wait|Nothing/i);
});

test("approval attention summary answers what needs me today", () => {
  const empty = approvalAttentionSummary(0);
  assert.match(empty.headline, /caught up/i);
  const busy = approvalAttentionSummary(3);
  assert.match(busy.headline, /3 items need your attention today/);
});

test("library zones orient drafts, approvals, publishing, published, history", () => {
  const ids = LIBRARY_ZONES.map((z) => z.id);
  assert.deepEqual(ids, ["drafts", "awaiting", "publishing", "published", "history"]);
});

test("approval status labels are customer-facing", () => {
  assert.equal(formatApprovalStatus("pending"), "Needs your opinion");
});

test("page-chrome ships Phase 4B continuity primitives", () => {
  const chrome = readFileSync(join(root, "components/dashboard/ui/page-chrome.tsx"), "utf8");
  assert.match(chrome, /FULL_CUSTOMER_JOURNEY_STEPS/);
  assert.match(chrome, /export function AttentionBanner/);
  assert.match(chrome, /export function NextStepHint/);
  assert.match(chrome, /export function ProcessingNotice/);
});

test("Approval Center surfaces attention and bulk approve", () => {
  const page = readFileSync(join(root, "components/dashboard/approvals-page.tsx"), "utf8");
  const queue = readFileSync(join(root, "components/dashboard/approval-queue.tsx"), "utf8");
  assert.match(page, /AttentionBanner/);
  assert.match(page, /Needs you today/);
  assert.match(queue, /Approve all needing review/);
  assert.match(queue, /Confirm reject/);
});

test("Publishing surfaces drop engine terminology", () => {
  const jobs = readFileSync(join(root, "components/dashboard/publishing-jobs-panel.tsx"), "utf8");
  assert.match(jobs, /Live publishing activity/);
  assert.doesNotMatch(jobs, /Publishing Engine Jobs/);
  assert.match(jobs, /What’s happening/);
});

test("Library and Results include journey continuity", () => {
  const library = readFileSync(join(root, "components/dashboard/content-page.tsx"), "utf8");
  const results = readFileSync(join(root, "components/dashboard/analytics-page.tsx"), "utf8");
  assert.match(library, /Where things live/);
  assert.match(library, /FULL_CUSTOMER_JOURNEY_STEPS/);
  assert.match(results, /Your marketing wins/);
  assert.match(results, /Successful publications/);
});

test("Phase 4B does not touch schedule activation module", () => {
  const schedule = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(schedule, /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/);
});
