import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toCampaignDashboardCard } from "../lib/campaign-intelligence/campaign-dashboard.ts";
import { planCampaignFromDirector } from "../lib/campaign-intelligence/campaign-planner.ts";
import { CampaignStatuses, CampaignTypes } from "../lib/campaign-intelligence/campaign-types.ts";
import { buildWeeklyBriefing } from "../lib/head-of-marketing/weeklyBriefing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const emptyWins = { reviews: 0, views: 0, calls: 0, clicks: 0, posts: 0, tasksCompleted: 0 };

test("dashboard card projection includes status, milestone, completion, timeline", () => {
  const draft = planCampaignFromDirector({
    campaignType: CampaignTypes.BACK_TO_SCHOOL,
    marketingDirectorDecisionKey: "md|1",
    startDate: "2026-08-01",
    initiatedBy: "marketing_director",
  });
  const card = toCampaignDashboardCard({
    id: "c1",
    user_id: "u1",
    business_profile_id: "b1",
    ...draft,
    status: CampaignStatuses.IN_PROGRESS,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
  });

  assert.equal(card.title, "Back to School");
  assert.equal(card.status, CampaignStatuses.IN_PROGRESS);
  assert.ok(card.nextMilestone);
  assert.equal(typeof card.completionPercent, "number");
  assert.ok(card.timeline.length >= 3);
  assert.ok(card.recentProgress.length >= 1);
});

test("Head of Marketing briefing includes campaigns array (empty by default in pure composition)", () => {
  const briefing = buildWeeklyBriefing({
    userName: "Alex",
    businessName: "Demo Shop",
    websiteUrl: null,
    voiceNotes: null,
    profileCreatedAt: "2026-01-01T00:00:00.000Z",
    gbpConnected: true,
    unansweredReviews: 0,
    pendingApprovals: 0,
    openRecommendations: 0,
    publishFailures: 0,
    publishingReadyOrScheduled: 0,
    businessHealth: {
      overall: 80,
      seo: 80,
      google: 80,
      reviews: 80,
      content: 80,
      consistency: 80,
    },
    weeklyWins: emptyWins,
    planSummary: null,
    marketingThemes: [],
    businessGoals: [],
    seasonalHint: null,
    topPriorityTitle: null,
    upcomingCalendar: [],
    competitorWatchMessage: null,
    candidateRecommendations: [],
    topRecommendationDetail: null,
    memoryEvidence: null,
  });

  assert.ok(Array.isArray(briefing.campaigns));
  assert.equal(briefing.campaigns.length, 0);
});

test("Campaigns section: expand/collapse, accessibility, mobile-friendly layout", () => {
  const section = readFileSync(join(root, "components/dashboard/campaigns-section.tsx"), "utf8");
  assert.match(section, /Show timeline|Hide timeline/);
  assert.match(section, /aria-expanded/);
  assert.match(section, /aria-controls/);
  assert.match(section, /aria-labelledby/);
  assert.match(section, /role="progressbar"/);
  assert.match(section, /hom-focusable/);
  assert.match(section, /sm:p-6|sm:grid-cols-2|sm:p-5/);
  assert.match(section, /Active campaigns/);

  const page = readFileSync(join(root, "components/dashboard/head-of-marketing-page.tsx"), "utf8");
  assert.match(page, /CampaignsSection/);
  assert.match(page, /MonthlyFocusSection/);
  // Campaigns ships after Monthly Focus in the rendered tree (not import order).
  const monthlyJsx = page.indexOf("<MonthlyFocusSection");
  const campaignsJsx = page.indexOf("<CampaignsSection");
  assert.ok(monthlyJsx >= 0 && campaignsJsx >= 0);
  assert.ok(monthlyJsx < campaignsJsx);
});

test("documentation and cron gate ship with Campaign Intelligence", () => {
  const doc = readFileSync(join(root, "docs/CAMPAIGN_INTELLIGENCE_ENGINE.md"), "utf8");
  assert.match(doc, /Marketing Director/);
  assert.match(doc, /Marketing Memory/);
  assert.match(doc, /lifecycle/i);
  assert.match(doc, /template/i);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const gate = readFileSync(join(root, "lib/trigger/scheduleActivation.ts"), "utf8");
  assert.match(gate, /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/);
});
