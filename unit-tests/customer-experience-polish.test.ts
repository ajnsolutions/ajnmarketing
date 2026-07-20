import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  campaignStatusLabel,
  confidenceLabel,
  evidenceTypeLabel,
  experimentStatusLabel,
  memoryKindLabel,
  publishingStatusLabel,
  recommendationStatusLabel,
} from "../lib/customer-ux/statusVocabulary.ts";
import { groupInteractiveHomPrompts } from "../lib/interactive-hom/promptGroups.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for Customer Experience Polish", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("status vocabulary maps closed enums to customer labels (not raw snake_case)", () => {
  assert.equal(campaignStatusLabel("in_progress").label, "Active");
  assert.equal(experimentStatusLabel("proposed").label, "Proposed");
  assert.equal(publishingStatusLabel("awaiting_approval").label, "Awaiting approval");
  assert.equal(recommendationStatusLabel("dismissed").label, "Dismissed");
  assert.equal(memoryKindLabel("temporary_override").label, "Temporary override");
  assert.equal(confidenceLabel("early").label, "Early signal");
  assert.equal(evidenceTypeLabel("observation").label, "Observation");
  assert.notEqual(campaignStatusLabel("in_progress").label, "in_progress");
});

test("identical status inputs produce identical presentations", () => {
  assert.deepEqual(experimentStatusLabel("completed"), experimentStatusLabel("completed"));
  assert.deepEqual(confidenceLabel("insufficient"), confidenceLabel("insufficient"));
});

test("Head of Marketing hierarchy places strategy and action above history", () => {
  const page = readFileSync(join(root, "components/dashboard/head-of-marketing-page.tsx"), "utf8");
  const executive = page.indexOf("<ExecutiveBriefSection");
  const primary = page.indexOf('id="hom-primary-action"');
  const why = page.indexOf("<WhyPlanChangedSection");
  const calendar = page.indexOf("<StrategicCalendarPreviewSection");
  const campaigns = page.indexOf("<CampaignsSection");
  const experiments = page.indexOf("<ExperimentsSection");
  const ask = page.indexOf("<AskHeadOfMarketingPanel");
  const monthly = page.indexOf("<MonthlyFocusSection");
  assert.ok(executive >= 0 && primary > executive);
  assert.ok(why > primary);
  assert.ok(calendar > why);
  assert.ok(campaigns > calendar);
  assert.ok(experiments > campaigns);
  assert.ok(ask > experiments);
  assert.ok(monthly > ask);
  assert.match(page, /hom-skip-link/);
  assert.match(page, /decision-intelligence/);
});

test("shared empty/error/partial primitives ship", () => {
  const states = readFileSync(join(root, "components/dashboard/ui/dashboard-states.tsx"), "utf8");
  assert.match(states, /DashboardEmptyState/);
  assert.match(states, /PartialDataNotice/);
  assert.match(states, /DashboardErrorState/);
  assert.match(states, /DashboardLoadingSkeleton/);
  assert.match(states, /no_filter_results/);

  const badges = readFileSync(join(root, "components/dashboard/ui/status-badge.tsx"), "utf8");
  assert.match(badges, /StatusBadge/);
  assert.match(badges, /ConfidenceBadge/);
  assert.match(badges, /sr-only/);

  const chrome = readFileSync(join(root, "components/dashboard/ui/page-chrome.tsx"), "utf8");
  assert.match(chrome, /PageHeader/);
  assert.match(chrome, /ReadOnlyNotice/);
  assert.match(chrome, /LastUpdatedIndicator/);
  assert.match(chrome, /PrimaryActionBar/);
});

test("Decision Intelligence and Experiments avoid raw IDs and winner language", () => {
  const di = readFileSync(join(root, "components/dashboard/decision-intelligence-page.tsx"), "utf8");
  assert.match(di, /Why the plan changed/);
  assert.match(di, /PartialDataNotice/);
  assert.match(di, /Show evidence/);
  assert.doesNotMatch(di, /idempotency|service.role|Trigger\.dev/i);

  const experiments = readFileSync(join(root, "components/dashboard/experiments-section.tsx"), "utf8");
  assert.match(experiments, /Inconclusive/);
  assert.match(experiments, /No winner was selected/);
  assert.doesNotMatch(experiments, /Winner badge|Declare winner|statistical significance/i);
  assert.doesNotMatch(experiments, /slice\(0,\s*8\)/);
});

test("Interactive HoM prompt groups cover required topics", () => {
  const groups = groupInteractiveHomPrompts();
  const labels = groups.map((group) => group.label);
  assert.ok(labels.includes("Current priorities"));
  assert.ok(labels.includes("Why the plan changed"));
  assert.ok(labels.includes("Campaigns"));
  assert.ok(labels.some((label) => /Experiment|Preferences|uncertain|performance/i.test(label)));
});

test("advanced nav includes Decision Intelligence discoverability", () => {
  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  assert.match(nav, /decision-intelligence/);
  assert.match(nav, /Why the plan changed/);
});

test("regression: polish does not attach schedules or mutate strategy engines", () => {
  const gate = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(gate, /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/);

  const md = readFileSync(join(root, "lib/marketing-director/resolveDecision.ts"), "utf8");
  assert.doesNotMatch(md, /customer-ux|StatusBadge|PageHeader/);

  const docs = readFileSync(join(root, "docs/CUSTOMER_EXPERIENCE_POLISH.md"), "utf8");
  assert.match(docs, /non-goals|Non-goals/i);
  assert.match(docs, /Marketing Director/);
});
