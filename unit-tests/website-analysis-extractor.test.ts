import test from "node:test";
import assert from "node:assert/strict";
import { PlaceholderWebsiteExtractor } from "../lib/website-analysis/extractor.ts";

const emptyProfile = {
  business_name: null,
  industry: null,
  website: null,
  phone: null,
  city: null,
  state: null,
  primary_service_area: null,
  nearby_cities: null,
  primary_services: null,
  emergency_services: null,
  seasonal_services: null,
  specialty_services: null,
  brand_voice_tone: null,
  preferred_words: null,
  avoid_words: null,
  voice_notes: null,
};

test("extractHeadings never leaks raw HTML tags into extracted service names — regression for a real bug found via the eval dataset", async () => {
  const html = "<html><body><h1>Acme HVAC</h1><h2>Furnace Repair</h2><h2>AC Installation</h2><p>We serve homeowners.</p></body></html>";
  const extractor = new PlaceholderWebsiteExtractor();

  const result = await extractor.extract({
    website: { url: "https://acme.example", finalUrl: "https://acme.example", html, textContent: "Acme HVAC Furnace Repair AC Installation We serve homeowners.", fetchedAt: new Date().toISOString() },
    profile: emptyProfile,
  });

  for (const service of result.primaryServices) {
    assert.ok(!service.includes("<"), `service "${service}" contains raw HTML markup`);
  }
  assert.ok(!result.executiveSummary.includes("<h2>"), "executive summary leaked raw <h2> markup");
  for (const opportunity of result.contentOpportunities) {
    assert.ok(!opportunity.title.includes("<"), `content opportunity title "${opportunity.title}" contains raw HTML markup`);
  }
});
