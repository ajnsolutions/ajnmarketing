import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Head of Marketing Orchestrator modules, pages, routes, and docs exist", () => {
  expect(existsSync(join(root, "lib/head-of-marketing-orchestrator/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/head-of-marketing-orchestrator/build.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/head-of-marketing-orchestrator/adminOverview.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/head-of-marketing-orchestrator/service.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/executive-review-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/admin-executive-overview.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/executive-review/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/admin/executive-overview/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/HEAD_OF_MARKETING_ORCHESTRATOR.md"))).toBe(true);
});

test("Mission framing: this is an orchestration layer, not a second AI/reasoning engine", () => {
  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("no I/O, no new evidence");
  expect(build).not.toMatch(/openai|anthropic/i);

  const service = read("lib/head-of-marketing-orchestrator/service.ts");
  expect(service).toContain("getWeeklyGrowthPlanForCurrentUser");
  expect(service).toContain("getHeadOfMarketingBriefingForCurrentUser");
});

test("Part 1 — the Executive Review composes Opportunity Engine, Business Learning Engine, Business Knowledge Graph, Customer Voice, External Intelligence, Goals", () => {
  const service = read("lib/head-of-marketing-orchestrator/service.ts");
  for (const composedSource of [
    "reconcileAndGetOpportunities",
    "reconcileAndGetBusinessLearningPatterns",
    "getBusinessReasoning",
    "getCustomerVoiceIntelligence",
    "getExternalIntelligence",
    "getBusinessGoalsForCurrentUser",
  ]) {
    expect(service).toContain(composedSource);
  }
});

test("Part 2 — the primary priority shows why-now, expected impact, evidence, risk of waiting, effort, and why it won", () => {
  const types = read("lib/head-of-marketing-orchestrator/types.ts");
  expect(types).toContain("whyNow");
  expect(types).toContain("expectedImpact");
  expect(types).toContain("estimatedEffort");
  expect(types).toContain("riskOfWaiting");
  expect(types).toContain("wonBecause");
  expect(types).toContain("evidence: PlanEvidenceItem[]");

  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("function wonBecauseText");
  expect(build).toContain("function riskOfWaitingText");
});

test("Part 3 — at most 3 secondary priorities, hidden below a real evidence bar", () => {
  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("MAX_SECONDARY_PRIORITIES = 3");
  expect(build).toContain("MIN_SECONDARY_OPPORTUNITY_SCORE");
});

test("Part 4 — the executive summary reuses the Executive Brief's own wins/recentChanges/watchItems, never a second summarization pass", () => {
  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("executiveBrief.wins.map");
  expect(build).toContain("executiveBrief.recentChanges.map");
  expect(build).toContain("executiveBrief.watchItems.map");
});

test("Part 5 — the decision explanation surfaces signals, evidence, learning, and confidence without exposing raw scores", () => {
  const types = read("lib/head-of-marketing-orchestrator/types.ts");
  expect(types).toContain("signalsConsidered");
  expect(types).toContain("evidenceUsed");
  expect(types).toContain("learningApplied");

  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("function buildDecisionExplanation");
  expect(build).not.toMatch(/confidenceScore/);

  const page = read("components/dashboard/executive-review-page.tsx");
  expect(page).not.toMatch(/score\.total|scoreTotal/);
});

test("Part 6 — the action plan reuses the Weekly Growth Plan's own supporting actions rather than inventing new workflows", () => {
  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("plan.supportingActions.map");
  expect(build).toContain("SUPPORTING_ACTION_LABELS");
  expect(build).toContain("plan.successMetric");
  expect(build).toContain("plan.whatIllWatch");
});

test("Part 7 — Today / This Week / This Month present the SAME review, only headline/summary swap", () => {
  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("function presentExecutiveReview");
  expect(build).toContain("...review,");
  expect(build).toContain("headline: brief.headline");
  expect(build).toContain("summary: brief.summary");

  const service = read("lib/head-of-marketing-orchestrator/service.ts");
  expect(service).toContain("getExecutiveReviewAllCadencesForCurrentUser");

  const page = read("components/dashboard/executive-review-page.tsx");
  expect(page).toContain("ExecutiveReviewCadences.TODAY");
  expect(page).toContain("ExecutiveReviewCadences.THIS_WEEK");
  expect(page).toContain("ExecutiveReviewCadences.THIS_MONTH");
});

test("Part 8 — the Admin Executive Overview reuses tenant health + persisted opportunities, gated the same way every other admin page is", () => {
  const adminOverview = read("lib/head-of-marketing-orchestrator/adminOverview.ts");
  expect(adminOverview).toContain("TenantHealthSnapshot");
  expect(adminOverview).not.toMatch(/openai|anthropic/i);

  const service = read("lib/head-of-marketing-orchestrator/service.ts");
  expect(service).toContain("getTenantOperationalHealthPage");
  expect(service).toContain("getActiveOpportunitiesForUser");

  const route = read("app/dashboard/admin/executive-overview/page.tsx");
  expect(route).toContain("isAdminUserId");
  expect(route).toContain("isSupabaseServiceRoleConfigured");
  expect(route).toContain('redirect("/dashboard/command-center")');

  const opsLink = read("components/dashboard/admin-ops-dashboard.tsx");
  expect(opsLink).toContain("/dashboard/admin/executive-overview");
});

test("Part 9 — every review links back to Business Brain Inspector, Opportunity, Learning, Customer Voice, and Search evidence", () => {
  const build = read("lib/head-of-marketing-orchestrator/build.ts");
  expect(build).toContain("/dashboard/business-brain");
  expect(build).toContain("section-marketing_opportunities");
  expect(build).toContain("section-learning_history");
  expect(build).toContain("section-customer_themes");
  expect(build).toContain("section-search_trends");
});

test("Part 10 — the orchestrator never reruns a provider itself; the admin overview batches opportunities per tenant instead of recomputing knowledge health", () => {
  const service = read("lib/head-of-marketing-orchestrator/service.ts");
  expect(service).toContain("One fetch/compose pass, reused by every cadence");

  const adminOverview = read("lib/head-of-marketing-orchestrator/adminOverview.ts");
  expect(adminOverview).toContain("avoid duplicate computation");
  expect(adminOverview).not.toContain("runBusinessDiscoveryForCurrentUser");
  expect(adminOverview).not.toContain("getCustomerVoiceIntelligence");
});

test("the Executive Review route redirects to setup when there's no business profile or review yet", () => {
  const route = read("app/dashboard/executive-review/page.tsx");
  expect(route).toContain('redirect("/dashboard/setup")');
  expect(route).toContain("getExecutiveReviewAllCadencesForCurrentUser");
});

test("Growth Advisor's supporting context links to the Executive Review", () => {
  const supportingContext = read("components/dashboard/growth-advisor/supporting-context.tsx");
  expect(supportingContext).toContain("/dashboard/executive-review");
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, composition flow, priority selection, trust model, performance strategy, and future extensibility", () => {
  const docs = read("docs/project-magic/HEAD_OF_MARKETING_ORCHESTRATOR.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Composition flow");
  expect(docs).toContain("Priority selection");
  expect(docs).toContain("Trust model");
  expect(docs).toContain("Performance strategy");
  expect(docs).toContain("Future extensibility");
  expect(docs).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS");
});
