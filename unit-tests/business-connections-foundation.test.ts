import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CONNECTION_CATALOG } from "../lib/business-connections/catalog.ts";
import { composeBusinessConnectionsSnapshot } from "../lib/business-connections/compose.ts";
import { buildBusinessBrainReadiness } from "../lib/business-connections/readiness.ts";
import { recommendNextConnection } from "../lib/business-connections/recommendNext.ts";
import { resolveBusinessConnections } from "../lib/business-connections/resolve.ts";
import {
  ConnectionCategories,
  ConnectionProviderIds,
  ConnectionStatuses,
} from "../lib/business-connections/types.ts";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "../lib/trigger/scheduleActivation.ts";

const root = process.cwd();

const emptySignals = {
  gbpConnected: false,
  gbpNeedsAttention: false,
  gbpLastSyncAt: null,
  hasWebsite: false,
  websiteAnalyzed: false,
  websiteAnalyzedAt: null,
};

test("ATTACH_DECLARATIVE_PRODUCTION_CRONS remains false", () => {
  assert.equal(ATTACH_DECLARATIVE_PRODUCTION_CRONS, false);
});

test("docs and modules ship for Business Connections foundation", () => {
  assert.ok(existsSync(join(root, "docs/project-magic/BUSINESS_CONNECTIONS.md")));
  assert.ok(existsSync(join(root, "lib/business-connections/catalog.ts")));
  assert.ok(existsSync(join(root, "lib/business-connections/resolve.ts")));
  assert.ok(existsSync(join(root, "components/dashboard/business-connections-page.tsx")));
  assert.ok(existsSync(join(root, "app/dashboard/business-connections/page.tsx")));
  const docs = readFileSync(join(root, "docs/project-magic/BUSINESS_CONNECTIONS.md"), "utf8");
  assert.ok(docs.includes("Architecture"));
  assert.ok(docs.includes("Connection lifecycle"));
  assert.ok(docs.includes("Capability model"));
  assert.ok(docs.includes("Future providers"));
});

test("connection catalog covers required categories and seeds GBP", () => {
  const categories = new Set(CONNECTION_CATALOG.map((c) => c.category));
  for (const required of Object.values(ConnectionCategories)) {
    assert.ok(categories.has(required), `missing category ${required}`);
  }

  const gbp = CONNECTION_CATALOG.find(
    (c) => c.providerId === ConnectionProviderIds.GOOGLE_BUSINESS_PROFILE,
  );
  assert.ok(gbp);
  assert.equal(gbp!.implementation, "live");
  assert.ok(gbp!.whatYouLearn.length > 0);
  assert.ok(gbp!.businessBrainContribution.summary.length > 0);

  const placeholders = CONNECTION_CATALOG.filter((c) => c.implementation === "placeholder");
  assert.ok(placeholders.length >= 5);
  assert.ok(CONNECTION_CATALOG.every((c) => c.capabilities.length > 0));
});

test("resolve maps live GBP and website signals; placeholders stay coming soon", () => {
  const connected = resolveBusinessConnections({
    ...emptySignals,
    gbpConnected: true,
    gbpLastSyncAt: "2026-07-28T12:00:00.000Z",
    hasWebsite: true,
    websiteAnalyzed: true,
    websiteAnalyzedAt: "2026-07-27T12:00:00.000Z",
  });

  const gbp = connected.find((c) => c.providerId === ConnectionProviderIds.GOOGLE_BUSINESS_PROFILE)!;
  assert.equal(gbp.status, ConnectionStatuses.CONNECTED);
  assert.ok(gbp.availableCapabilities.includes("reviews"));
  assert.equal(gbp.lastSyncAt, "2026-07-28T12:00:00.000Z");

  const website = connected.find((c) => c.providerId === ConnectionProviderIds.WEBSITE_ANALYSIS)!;
  assert.equal(website.status, ConnectionStatuses.CONNECTED);

  assert.ok(
    connected
      .filter((c) => c.implementation === "placeholder")
      .every((c) => c.status === ConnectionStatuses.COMING_SOON),
  );

  const attention = resolveBusinessConnections({
    ...emptySignals,
    gbpNeedsAttention: true,
    gbpLastSyncAt: "2026-07-01T00:00:00.000Z",
  });
  const gbpAttention = attention.find(
    (c) => c.providerId === ConnectionProviderIds.GOOGLE_BUSINESS_PROFILE,
  )!;
  assert.equal(gbpAttention.status, ConnectionStatuses.NEEDS_ATTENTION);
});

test("readiness exposes available vs unavailable intelligence sources", () => {
  const empty = resolveBusinessConnections(emptySignals);
  const emptyReadiness = buildBusinessBrainReadiness(empty);
  const feedback = emptyReadiness.find((r) => r.id === "readiness_customer_feedback")!;
  const search = emptyReadiness.find((r) => r.id === "readiness_search_performance")!;
  const analytics = emptyReadiness.find((r) => r.id === "readiness_website_analytics")!;
  const docs = emptyReadiness.find((r) => r.id === "readiness_document_knowledge")!;

  assert.equal(feedback.state, "unavailable");
  assert.match(feedback.detail, /unavailable/i);
  assert.equal(search.state, "coming_soon");
  assert.equal(analytics.state, "coming_soon");
  assert.equal(docs.state, "coming_soon");

  const live = resolveBusinessConnections({
    ...emptySignals,
    gbpConnected: true,
    websiteAnalyzed: true,
  });
  const liveReadiness = buildBusinessBrainReadiness(live);
  assert.equal(
    liveReadiness.find((r) => r.id === "readiness_customer_feedback")!.state,
    "available",
  );
  assert.equal(
    liveReadiness.find((r) => r.id === "readiness_website_content")!.state,
    "available",
  );
});

test("recommendation logic picks one highest-value live gap", () => {
  const none = recommendNextConnection(resolveBusinessConnections(emptySignals));
  assert.ok(none);
  assert.equal(none!.connectionId, "conn_google_business_profile");

  const gbpDone = recommendNextConnection(
    resolveBusinessConnections({
      ...emptySignals,
      gbpConnected: true,
      hasWebsite: true,
    }),
  );
  assert.ok(gbpDone);
  assert.equal(gbpDone!.connectionId, "conn_website_analysis");

  const allLive = recommendNextConnection(
    resolveBusinessConnections({
      ...emptySignals,
      gbpConnected: true,
      websiteAnalyzed: true,
    }),
  );
  assert.equal(allLive, null);

  const fixFirst = recommendNextConnection(
    resolveBusinessConnections({
      ...emptySignals,
      gbpNeedsAttention: true,
      websiteAnalyzed: false,
      hasWebsite: true,
    }),
  );
  assert.ok(fixFirst);
  assert.equal(fixFirst!.connectionId, "conn_google_business_profile");
  assert.match(fixFirst!.why, /reconnect/i);
});

test("empty states compose calmly without fabricating connections", () => {
  const snapshot = composeBusinessConnectionsSnapshot(emptySignals, { hasProfile: true });
  assert.equal(snapshot.emptyState, "nothing_connected");
  assert.ok(snapshot.recommendedNext);
  assert.ok(snapshot.byCategory.length >= 8);
  assert.ok(snapshot.readiness.length >= 4);

  const noProfile = composeBusinessConnectionsSnapshot(emptySignals, { hasProfile: false });
  assert.equal(noProfile.emptyState, "no_profile");

  const ui = readFileSync(
    join(root, "components/dashboard/business-connections-page.tsx"),
    "utf8",
  );
  assert.ok(ui.includes("What will I learn if you connect this?"));
  assert.ok(ui.includes("Recommended next"));
  assert.ok(!/oauth|access_token|client_secret/i.test(ui));
});
