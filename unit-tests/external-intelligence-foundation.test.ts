import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isBusinessInsight, TimeHorizons } from "../lib/business-brain/insight.ts";
import { composeExternalIntelligence } from "../lib/external-intelligence/compose.ts";
import { calculateExternalConfidence } from "../lib/external-intelligence/confidence.ts";
import { calculateExternalBusinessImpact } from "../lib/external-intelligence/impact.ts";
import {
  clusterKeyForSignal,
  normalizeProviderBatch,
  normalizeProviderSignal,
} from "../lib/external-intelligence/normalize.ts";
import {
  createExternalIntelligenceProviderRegistry,
  createUnimplementedProvider,
} from "../lib/external-intelligence/provider.ts";
import { createDesignedExternalProviders } from "../lib/external-intelligence/providers/designed.ts";
import {
  calculateExternalIntelligenceScore,
  maturityCopyFor,
} from "../lib/external-intelligence/score.ts";
import {
  ExternalIntelligenceCategories,
  ExternalIntelligenceProviderIds,
  ExternalMaturityLabels,
} from "../lib/external-intelligence/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";
import { ConfidenceLevels } from "../lib/customer-voice/types.ts";

const root = process.cwd();
const now = new Date("2026-07-29T12:00:00.000Z");

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("BusinessInsight contract validates required fields", () => {
  const insight = {
    id: "external:seasonal_opportunities:back_to_school",
    category: ExternalIntelligenceCategories.SEASONAL_OPPORTUNITIES,
    insight: "Back-to-school demand is rising in your area.",
    confidence: "medium",
    businessImpact: "high",
    timeHorizon: TimeHorizons.THIS_SEASON,
    evidence: [
      {
        id: "google_trends:1",
        summary: "Search interest up for related terms",
        occurredAt: "2026-07-20T00:00:00.000Z",
        sourceProviderId: "google_trends",
        sourceLabel: "Google Trends",
        quality: "medium",
      },
    ],
    possibleActions: [{ id: "content", label: "Create seasonal content", href: null }],
    relatedGoals: ["more_leads"],
    lastUpdated: "2026-07-20T00:00:00.000Z",
  };
  assert.equal(isBusinessInsight(insight), true);
  assert.equal(isBusinessInsight({ id: "x" }), false);
});

test("Customer Voice still shares the same confidence vocabulary", () => {
  assert.equal(ConfidenceLevels.LOW, "low");
  assert.equal(ConfidenceLevels.HIGH, "high");
});

test("provider abstraction supports registry and future providers without brain changes", () => {
  const googleTrends = createUnimplementedProvider(
    ExternalIntelligenceProviderIds.GOOGLE_TRENDS,
    "Google Trends",
  );
  const weather = createUnimplementedProvider(ExternalIntelligenceProviderIds.WEATHER, "Weather");
  const registry = createExternalIntelligenceProviderRegistry([googleTrends, weather]);
  assert.equal(registry.size, 2);
  assert.ok(registry.has(ExternalIntelligenceProviderIds.GOOGLE_TRENDS));

  assert.throws(() =>
    createExternalIntelligenceProviderRegistry([googleTrends, googleTrends]),
  );
});

test("designed providers return empty signals and never fabricate", async () => {
  const providers = createDesignedExternalProviders();
  assert.ok(providers.length >= 8);
  for (const provider of providers) {
    const result = await provider.fetchSignals({
      userId: "u1",
      businessProfileId: "biz-1",
      now,
    });
    assert.equal(result.signals.length, 0);

    // Search Console is the first live provider — for an unconnected user it still
    // returns empty signals (never fabricated), but its note explains *why*
    // ("not connected") rather than "designed but not implemented" like the
    // remaining foundation-only stubs.
    if (provider.id === ExternalIntelligenceProviderIds.SEARCH_CONSOLE) {
      assert.ok((result.notes ?? []).some((n) => /not connected|unavailable/i.test(n)));
    } else {
      assert.ok((result.notes ?? []).some((n) => /not implemented/i.test(n)));
    }
  }
});

test("normalization is provider-shaped but consumer-safe", () => {
  const normalized = normalizeProviderSignal({
    providerId: ExternalIntelligenceProviderIds.LOCAL_EVENTS,
    sourceLabel: "Local Events",
    now,
    signal: {
      externalId: "evt-1",
      category: ExternalIntelligenceCategories.LOCAL_EVENTS,
      title: "Downtown Festival",
      summary: "A multi-day downtown festival expected to draw local foot traffic.",
      occurredAt: "2026-07-25T00:00:00.000Z",
      signalStrength: 0.8,
      relatedGoalHints: ["more_leads"],
      actionHints: ["Create local-event content"],
    },
  });
  assert.equal(normalized.id.startsWith("local_events:"), true);
  assert.equal(normalized.category, ExternalIntelligenceCategories.LOCAL_EVENTS);
  assert.ok(normalized.evidenceWeight > 0);
  assert.ok(["low", "medium", "high"].includes(normalized.quality));
});

test("corroborating evidence across providers increases confidence", () => {
  const batchA = normalizeProviderBatch({
    providerId: ExternalIntelligenceProviderIds.GOOGLE_TRENDS,
    sourceLabel: "Google Trends",
    now,
    signals: [
      {
        externalId: "1",
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: "Emergency Plumbing",
        summary: "Search interest for emergency plumbing is rising in the service area.",
        occurredAt: "2026-07-20T00:00:00.000Z",
        signalStrength: 0.7,
      },
    ],
  });
  const batchB = normalizeProviderBatch({
    providerId: ExternalIntelligenceProviderIds.SEARCH_CONSOLE,
    sourceLabel: "Search Console",
    now,
    signals: [
      {
        externalId: "2",
        category: ExternalIntelligenceCategories.SEARCH_DEMAND_TRENDS,
        title: "Emergency Plumbing",
        summary: "Owned search clicks for emergency plumbing queries increased this week.",
        occurredAt: "2026-07-22T00:00:00.000Z",
        signalStrength: 0.75,
      },
    ],
  });

  assert.equal(clusterKeyForSignal(batchA[0]!), clusterKeyForSignal(batchB[0]!));

  const intelligence = composeExternalIntelligence({
    businessProfileId: "biz-1",
    signals: [...batchA, ...batchB],
    knownGoalKeys: ["more_leads"],
    now,
  });

  assert.ok(intelligence.insights.length >= 1);
  const insight = intelligence.searchDemandTrends[0] ?? intelligence.insights[0]!;
  assert.ok(insight.corroboratingProviderCount >= 2);
  assert.notEqual(insight.confidence, "low");
  assert.equal(isBusinessInsight(insight), true);
  assert.ok(insight.possibleActions.length > 0);
  assert.ok(insight.evidence.length >= 2);
});

test("confidence calculation never exaggerates isolated thin signals", () => {
  const low = calculateExternalConfidence({
    evidenceCount: 1,
    providerCount: 1,
    averageReliability: 0.5,
    recentShare: 0.2,
    averageEvidenceQuality: 0.4,
  });
  assert.equal(low, "low");

  const high = calculateExternalConfidence({
    evidenceCount: 4,
    providerCount: 3,
    averageReliability: 0.85,
    recentShare: 0.8,
    averageEvidenceQuality: 0.8,
  });
  assert.equal(high, "high");
});

test("business impact is not the same as frequency", () => {
  const weather = calculateExternalBusinessImpact({
    category: ExternalIntelligenceCategories.WEATHER,
    impactHints: ["operational"],
    evidenceCount: 5,
    confidence: "medium",
    timeHorizon: TimeHorizons.NEAR_TERM,
  });
  const regulatory = calculateExternalBusinessImpact({
    category: ExternalIntelligenceCategories.INDUSTRY_REGULATORY_UPDATES,
    impactHints: ["operational", "customer_impact"],
    evidenceCount: 2,
    confidence: "medium",
    timeHorizon: TimeHorizons.IMMEDIATE,
  });
  assert.ok(
    regulatory === "high" ||
      (regulatory === "medium" && weather !== "high"),
  );
});

test("External Intelligence Score stays internal and surfaces natural language only", () => {
  const empty = calculateExternalIntelligenceScore({
    signals: [],
    insightCount: 0,
    highConfidenceInsights: 0,
    corroboratingInsightCount: 0,
    categoryCount: 0,
    overallConfidence: "low",
    now,
  });
  assert.equal(empty.maturityLabel, ExternalMaturityLabels.EMPTY);
  assert.match(empty.maturityCopy, /Monitoring for stronger trends/);
  assert.equal(typeof empty.score, "number");
  assert.equal(maturityCopyFor(ExternalMaturityLabels.WELL_UNDERSTOOD).includes("100"), false);
  assert.match(
    maturityCopyFor(ExternalMaturityLabels.WELL_UNDERSTOOD),
    /Market conditions are well understood/,
  );
});

test("low-data and empty situations stay honest", () => {
  const empty = composeExternalIntelligence({
    businessProfileId: "biz-empty",
    signals: [],
    now,
  });
  assert.equal(empty.emptyState, "no_evidence");
  assert.equal(empty.insights.length, 0);
  assert.match(empty.score.maturityCopy, /Monitoring for stronger trends/);

  const thin = normalizeProviderBatch({
    providerId: ExternalIntelligenceProviderIds.WEATHER,
    sourceLabel: "Weather",
    now,
    signals: [
      {
        externalId: "w1",
        category: ExternalIntelligenceCategories.WEATHER,
        title: "Rain",
        summary: "Rain.",
        occurredAt: "2026-07-28T00:00:00.000Z",
        signalStrength: 0.3,
      },
    ],
  });
  const thinIntel = composeExternalIntelligence({
    businessProfileId: "biz-thin",
    signals: thin,
    now,
  });
  assert.ok(
    thinIntel.emptyState === "insufficient_evidence" ||
      thinIntel.insights.every((i) => i.confidence === "low") ||
      thinIntel.score.maturityLabel !== ExternalMaturityLabels.WELL_UNDERSTOOD,
  );
});

test("related goals only include known goal keys", () => {
  const signals = normalizeProviderBatch({
    providerId: ExternalIntelligenceProviderIds.HOLIDAY_CALENDAR,
    sourceLabel: "Holiday Calendar",
    now,
    signals: [
      {
        externalId: "h1",
        category: ExternalIntelligenceCategories.HOLIDAY_CALENDAR,
        title: "Labor Day",
        summary: "Labor Day weekend often creates service and promotion opportunities.",
        occurredAt: "2026-07-15T00:00:00.000Z",
        signalStrength: 0.9,
        relatedGoalHints: ["more_leads", "invented_goal"],
      },
    ],
  });
  const intel = composeExternalIntelligence({
    businessProfileId: "biz-goals",
    signals,
    knownGoalKeys: ["more_leads"],
    now,
  });
  const insight = intel.holidayCalendar[0] ?? intel.insights[0]!;
  assert.deepEqual(insight.relatedGoals, ["more_leads"]);
});

test("foundation docs and modules exist; no External Intelligence UI page", () => {
  const docs = readFileSync(join(root, "docs/project-magic/EXTERNAL_INTELLIGENCE.md"), "utf8");
  assert.match(docs, /Architecture/);
  assert.match(docs, /BusinessInsight contract/);
  assert.match(docs, /Provider interface/);
  assert.match(docs, /Normalization/);
  assert.match(docs, /Confidence model/);
  assert.match(docs, /Business Impact/);
  assert.match(docs, /External Intelligence Score/);
  assert.match(docs, /Extension guide/);
  assert.match(docs, /ATTACH_DECLARATIVE_PRODUCTION_CRONS/);
  assert.match(docs, /No External Intelligence UI/);

  assert.ok(existsSync(join(root, "lib/business-brain/insight.ts")));
  assert.ok(existsSync(join(root, "lib/external-intelligence/compose.ts")));
  assert.ok(existsSync(join(root, "lib/external-intelligence/service.ts")));

  let uiPage = false;
  try {
    readFileSync(join(root, "app/dashboard/external-intelligence/page.tsx"), "utf8");
    uiPage = true;
  } catch {
    uiPage = false;
  }
  assert.equal(uiPage, false);
});
