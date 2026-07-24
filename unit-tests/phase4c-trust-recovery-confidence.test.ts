import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  awarenessPresentation,
  buildMilestones,
  buildSinceLastVisitItems,
  buildTrustSignals,
  recoveryPublishingFailed,
  successSentToApproval,
} from "../lib/customer-ux/trustPresentation.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

const root = process.cwd();

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("trust signals never fabricate missing timestamps", () => {
  const signals = buildTrustSignals([
    { label: "Last synced", isoDate: "2026-07-01T12:00:00.000Z" },
    { label: "Missing", isoDate: null },
    { label: "Invalid", isoDate: "not-a-date" },
  ]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.label, "Last synced");
});

test("since last visit uses only provided facts", () => {
  const items = buildSinceLastVisitItems({
    thisWeek: ["Published 2 updates."],
    celebrations: ["Nice review week"],
    pendingApprovals: 2,
    publishFailures: 1,
    openRecommendations: 3,
    publishingReady: 0,
  });
  assert.ok(items.some((item) => item.text.includes("Published 2")));
  assert.ok(items.some((item) => /waiting for your opinion/.test(item.text)));
  assert.ok(items.some((item) => /need a retry/.test(item.text)));
});

test("milestones and awareness stay customer-facing", () => {
  const milestones = buildMilestones({
    hasBusinessProfile: true,
    hasMarketingPlan: true,
    hasPublishedContent: false,
    hasGoogleSync: true,
    hasCompletedRecommendation: false,
  });
  assert.ok(milestones.some((m) => m.kind === "first_profile"));
  assert.ok(milestones.some((m) => m.kind === "first_google_sync"));
  assert.equal(awarenessPresentation("all_caught_up").label, "All caught up");
});

test("success and recovery messages explain safety and next steps", () => {
  const success = successSentToApproval();
  assert.match(success.whereToFind, /Approvals/i);
  assert.match(success.whatNext, /publish/i);
  const recovery = recoveryPublishingFailed();
  assert.match(recovery.workSafe, /saved|still/i);
  assert.doesNotMatch(recovery.whatHappened, /stack|exception|sql|oauth|trigger/i);
});

test("page-chrome ships Phase 4C trust primitives", () => {
  const chrome = readFileSync(join(root, "components/dashboard/ui/page-chrome.tsx"), "utf8");
  assert.match(chrome, /export function SuccessNotice/);
  assert.match(chrome, /export function RecoveryNotice/);
  assert.match(chrome, /export function AwarenessChip/);
  assert.match(chrome, /export function TrustSignalList/);
  assert.match(chrome, /export function MilestoneNotice/);
});

test("HoM includes customer confidence panel", () => {
  const hom = readFileSync(join(root, "components/dashboard/head-of-marketing-page.tsx"), "utf8");
  assert.match(hom, /CustomerConfidencePanel/);
  assert.match(hom, /briefing\.confidence/);
});

test("empty states answer why / normal / next", () => {
  const states = readFileSync(join(root, "components/dashboard/ui/dashboard-states.tsx"), "utf8");
  assert.match(states, /Why empty/);
  assert.match(states, /Is that normal/);
  assert.match(states, /What next/);
});

test("Phase 4C does not open the cron gate", () => {
  const schedule = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(schedule, /ATTACH_DECLARATIVE_PRODUCTION_CRONS\s*=\s*false/);
});
