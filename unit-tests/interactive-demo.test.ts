import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  checkRateLimit,
  resetRateLimitBuckets,
} from "../lib/interactive-demo/rate-limit.ts";
import { assertPublicDemoUrl } from "../lib/interactive-demo/url-safety.ts";
import { buildDemoRecommendations } from "../lib/interactive-demo/recommendations.ts";
import { buildWebsiteSnapshot } from "../lib/interactive-demo/analyze.ts";
import type { WebsiteExtractionResult } from "../lib/website-analysis/types.ts";

const scheduleActivation = readFileSync(
  new URL("../lib/trigger/scheduleActivation.ts", import.meta.url),
  "utf8",
);
const orchestrate = readFileSync(
  new URL("../lib/interactive-demo/orchestrate.ts", import.meta.url),
  "utf8",
);
const apiRoute = readFileSync(
  new URL("../app/api/interactive-demo/route.ts", import.meta.url),
  "utf8",
);

function sampleExtraction(
  overrides: Partial<WebsiteExtractionResult> = {},
): WebsiteExtractionResult {
  return {
    businessName: "Peak Plumbing",
    industry: "Plumbing",
    primaryServices: ["Emergency repairs", "Water heaters"],
    secondaryServices: ["Drain cleaning"],
    serviceAreas: ["Austin"],
    citiesMentioned: ["Austin"],
    phoneNumbers: ["512-555-0100"],
    emailAddresses: ["hello@example.com"],
    businessHours: ["Mon-Fri 8-5"],
    callsToAction: ["Call now"],
    keywords: ["plumber", "austin"],
    brandVoice: "Friendly and trustworthy",
    readingLevel: "Easy",
    tone: "Friendly",
    customerPersona: "Homeowners",
    valueProposition: "Fast local plumbing",
    metaTitle: "Peak Plumbing",
    metaDescription: "Local plumber",
    h1Headings: ["Trusted local plumbing"],
    seoIssues: ["Missing meta descriptions"],
    internalLinks: 4,
    pageCountEstimate: 8,
    strengths: ["Clear services", "Phone number visible"],
    weaknesses: ["Few city pages"],
    highestRoiImprovements: [
      "Publish weekly Google posts",
      "Request more reviews",
      "Refresh service page content",
    ],
    nextRecommendedActions: "Improve reviews and GBP posts",
    executiveSummary: "Peak Plumbing serves Austin homeowners.",
    contentOpportunities: [{ title: "Seasonal AC drain tips", seoScore: 70, competition: "Medium" }],
    ...overrides,
  };
}

describe("interactive AI marketing demo", () => {
  it("blocks private and invalid demo URLs", () => {
    assert.throws(() => assertPublicDemoUrl("http://localhost/test"), /can’t be analyzed|valid/i);
    assert.throws(() => assertPublicDemoUrl("http://127.0.0.1"), /can’t be analyzed/i);
    assert.throws(() => assertPublicDemoUrl("not a url :::"), /valid/i);
    assert.match(assertPublicDemoUrl("example.com"), /^https:\/\/example\.com\/?/);
  });

  it("rate limits after the configured window budget", () => {
    resetRateLimitBuckets();
    const key = "test-ip";
    for (let i = 0; i < 5; i += 1) {
      const result = checkRateLimit({ key, limit: 5, windowMs: 60_000 });
      assert.equal(result.allowed, true);
    }
    const blocked = checkRateLimit({ key, limit: 5, windowMs: 60_000 });
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });

  it("builds client-friendly recommendations without fabricated scores", () => {
    const cards = buildDemoRecommendations(sampleExtraction());
    assert.ok(cards.length >= 1 && cards.length <= 3);
    for (const card of cards) {
      assert.equal(card.kind, "recommendation");
      assert.ok(card.title.length > 0);
      assert.ok(card.expectedBenefit.length > 0);
      assert.ok(card.exampleAction.length > 0);
      assert.equal(card.expectedBenefit.includes("%"), false);
    }
  });

  it("labels website snapshot as live findings", () => {
    const snapshot = buildWebsiteSnapshot({
      extraction: sampleExtraction(),
      sourceUrl: "https://peakplumbing.example",
      input: { websiteUrl: "https://peakplumbing.example" },
    });
    assert.equal(snapshot.kind, "live_findings");
    assert.match(snapshot.businessSummary, /Peak Plumbing|Austin/i);
  });

  it("orchestration stays ephemeral and cron gate remains false", () => {
    assert.equal(orchestrate.includes("createServiceRoleClient"), false);
    assert.equal(orchestrate.includes("ForUser"), false);
    assert.equal(apiRoute.includes("createServiceRoleClient"), false);
    assert.match(
      scheduleActivation,
      /ATTACH_DECLARATIVE_PRODUCTION_CRONS = false/,
    );
  });
});
