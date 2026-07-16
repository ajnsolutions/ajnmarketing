import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import {
  JOURNAL_FORBIDDEN_TERMS,
  buildHeadOfMarketingJournal,
} from "../lib/head-of-marketing/journal.ts";
import type { JournalInput } from "../lib/head-of-marketing/journal.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const baseInput: JournalInput = {
  gbpConnected: true,
  unansweredReviews: 0,
  pendingApprovals: 0,
  openRecommendations: 0,
  publishFailures: 0,
  publishingReadyOrScheduled: 2,
  businessHealth: {
    overall: 78,
    seo: 70,
    google: 80,
    reviews: 80,
    content: 70,
    consistency: 75,
  },
  healthState: "healthy",
  weeklyWins: {
    reviews: 2,
    views: 120,
    calls: 0,
    clicks: 0,
    posts: 1,
    tasksCompleted: 0,
  },
  planSummary: "Local trust this month.",
  seasonalHint: "Summer service rush (July)",
  topPriorityTitle: null,
  profileCreatedAt: "2026-01-10T00:00:00.000Z",
  websiteUrl: "https://acme.example",
  estimatedReviewMinutes: 0,
  isEarlyCustomer: false,
  now: new Date("2026-07-16T10:00:00"),
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false for HoM Journal", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("journal narrates days without becoming a decision center", () => {
  const journal = buildHeadOfMarketingJournal({
    ...baseInput,
    pendingApprovals: 2,
    estimatedReviewMinutes: 4,
  });

  assert.match(journal.intro, /While you were serving customers/i);
  assert.ok(journal.entries.length >= 2);
  assert.ok(journal.entries.length <= 5);
  assert.ok(journal.entries.some((entry) => entry.dayLabel === "Monday"));
  assert.ok(
    journal.entries.some((entry) =>
      entry.paragraphs.some((p) => /Weekly Briefing|review time/i.test(p)),
    ),
  );
  assert.match(journal.closing ?? "", /briefing is ready|got everything covered|monitor/i);
  assert.equal(journal.detail.activeDetail, "standard");
});

test("journal avoids technical customer language", () => {
  const journal = buildHeadOfMarketingJournal(baseInput);
  const text = [
    journal.intro,
    journal.closing ?? "",
    ...journal.entries.flatMap((entry) => entry.paragraphs),
  ].join("\n");

  for (const term of JOURNAL_FORBIDDEN_TERMS) {
    assert.equal(
      text.toLowerCase().includes(term.toLowerCase()),
      false,
      `forbidden term leaked: ${term}`,
    );
  }
});

test("quiet week still reassures", () => {
  const journal = buildHeadOfMarketingJournal({
    ...baseInput,
    weeklyWins: {
      reviews: 0,
      views: 0,
      calls: 0,
      clicks: 0,
      posts: 0,
      tasksCompleted: 0,
    },
    publishingReadyOrScheduled: 0,
    planSummary: null,
    seasonalHint: null,
    healthState: "excellent",
    businessHealth: {
      overall: 90,
      seo: 90,
      google: 90,
      reviews: 90,
      content: 90,
      consistency: 90,
    },
  });

  const text = journal.entries.flatMap((e) => e.paragraphs).join(" ");
  assert.match(text, /healthy|monitoring|smoothly|visibility/i);
  assert.match(journal.closing ?? "", /weekend|covered|monitor/i);
});

test("new customers get learning-forward journal", () => {
  const journal = buildHeadOfMarketingJournal({
    ...baseInput,
    isEarlyCustomer: true,
    gbpConnected: false,
    profileCreatedAt: "2026-07-14T00:00:00.000Z",
  });

  assert.match(journal.intro, /getting started|learning/i);
  assert.ok(
    journal.entries.some((entry) =>
      entry.paragraphs.some((p) => /learning/i.test(p)),
    ),
  );
});

test("journal docs and UI stay presentation-only with no new nav item", () => {
  const doc = readFileSync(join(root, "docs/HEAD_OF_MARKETING_JOURNAL.md"), "utf8");
  assert.match(doc, /Relationship philosophy/);
  assert.match(doc, /Narrative rules/);
  assert.match(doc, /Weekly Briefing/);
  assert.match(doc, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);

  const journalModule = readFileSync(join(root, "lib/head-of-marketing/journal.ts"), "utf8");
  assert.equal(journalModule.includes("runMarketingDecisionEngine"), false);
  assert.equal(journalModule.includes("generateCommandCenterInsights"), false);

  const nav = readFileSync(join(root, "components/dashboard/dashboard-nav.tsx"), "utf8");
  assert.equal(nav.includes('label: "Journal"'), false);

  const page = readFileSync(
    join(root, "components/dashboard/head-of-marketing-page.tsx"),
    "utf8",
  );
  assert.match(page, /HeadOfMarketingJournalSection/);
});
