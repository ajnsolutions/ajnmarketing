import test from "node:test";
import assert from "node:assert/strict";
import { confidenceBadgeText, sourcePhrase } from "../lib/snapshot-ui/confidenceLanguage.ts";
import { DiscoveryConfidenceTiers } from "../lib/business-discovery/types.ts";

test("never shows the raw tier name — only plain language", () => {
  assert.equal(confidenceBadgeText(DiscoveryConfidenceTiers.KNOWN), "Clearly stated");
  assert.equal(confidenceBadgeText(DiscoveryConfidenceTiers.ASSUMED), "My best understanding");
  assert.equal(confidenceBadgeText(DiscoveryConfidenceTiers.MISSING), "I couldn't determine this yet");

  for (const tier of Object.values(DiscoveryConfidenceTiers)) {
    const text = confidenceBadgeText(tier);
    assert.doesNotMatch(text, /known|assumed|missing/i);
  }
});

test("sourcePhrase never exposes a raw internal source enum value", () => {
  const phrase = sourcePhrase(["ai_website_analysis"]);
  assert.equal(phrase, "your website");
  assert.doesNotMatch(phrase ?? "", /ai_website_analysis|website_analysis/);
});

test("sourcePhrase joins two sources naturally", () => {
  const phrase = sourcePhrase(["business_profile", "ai_marketing_profile"]);
  assert.equal(phrase, "what you told us and AJN's analysis");
});

test("sourcePhrase joins three or more sources with a serial comma", () => {
  const phrase = sourcePhrase(["business_profile", "website", "ai_marketing_profile"]);
  assert.match(phrase ?? "", /, and/);
});

test("sourcePhrase deduplicates identical phrases", () => {
  const phrase = sourcePhrase(["website", "ai_website_analysis"]); // both map to "your website"
  assert.equal(phrase, "your website");
});

test("sourcePhrase returns null for an empty source list", () => {
  assert.equal(sourcePhrase([]), null);
});
