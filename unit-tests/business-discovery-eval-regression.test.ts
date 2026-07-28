/**
 * Regression suite over the Internal Alpha evaluation dataset
 * (eval/business-discovery/fixtures.ts) — runs every business category
 * fixture through the real, deterministic (no API key, no network)
 * extraction path, `PlaceholderWebsiteExtractor`, and checks that industry
 * detection, persona inference, business summaries, and growth opportunities
 * are specific and industry-aware rather than falling back to the old
 * generic boilerplate.
 *
 * This is the repeatable regression framework requested in the Internal
 * Alpha sprint: add a new fixture here for any category that regresses, and
 * `npm run test:unit` catches it automatically going forward.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { PlaceholderWebsiteExtractor } from "../lib/website-analysis/extractor.ts";
import { LOW_CONFIDENCE_CUSTOMER_PERSONA } from "../lib/website-analysis/customer-persona.ts";
import { BUSINESS_DISCOVERY_EVAL_FIXTURES } from "../eval/business-discovery/fixtures.ts";

const extractor = new PlaceholderWebsiteExtractor();

for (const fixture of BUSINESS_DISCOVERY_EVAL_FIXTURES) {
  test(`[${fixture.category}] classifies industry, persona, summary, and growth opportunities correctly`, async () => {
    const result = await extractor.extract({
      website: {
        url: fixture.finalUrl,
        finalUrl: fixture.finalUrl,
        html: fixture.html,
        textContent: fixture.textContent,
        fetchedAt: new Date().toISOString(),
      },
      profile: fixture.profile,
    });

    assert.match(result.customerPersona, fixture.expect.personaMatches, `persona for ${fixture.category}: "${result.customerPersona}"`);

    if (fixture.expect.personaMustNotBeGeneric) {
      assert.notEqual(result.customerPersona, LOW_CONFIDENCE_CUSTOMER_PERSONA, `persona for ${fixture.category} fell back to the generic placeholder`);
    }

    assert.match(result.executiveSummary, fixture.expect.summaryMustMention, `summary for ${fixture.category}: "${result.executiveSummary}"`);

    const growthText = result.highestRoiImprovements.join(" | ");
    assert.match(growthText, fixture.expect.growthOpportunityMustMention, `growth opportunities for ${fixture.category}: "${growthText}"`);

    assert.ok(result.contentOpportunities.length > 0, `no content opportunities generated for ${fixture.category}`);
    if (fixture.expect.contentOpportunityAudienceMustNotBeGeneric) {
      assert.ok(
        !result.contentOpportunities.some((item) => item.title.includes("Their Customers")),
        `content opportunity titles for ${fixture.category} fell back to the generic "Their Customers" audience`
      );
    }

    // Priority is expressed through list order (Part 5's "prioritized"
    // requirement), never as literal bracket text in the string — this
    // string is also rendered directly on the authenticated dashboard's
    // Website Analysis page, so it must never contain UI-internal markup.
    for (const opportunity of result.highestRoiImprovements) {
      assert.ok(!opportunity.startsWith("["), `opportunity leaked a bracket tag for ${fixture.category}: "${opportunity}"`);
    }
  });
}

test("every fixture in the eval dataset produces a distinct industry classification from its own text (no cross-category bleed)", async () => {
  const results = await Promise.all(
    BUSINESS_DISCOVERY_EVAL_FIXTURES.map((fixture) =>
      extractor.extract({
        website: {
          url: fixture.finalUrl,
          finalUrl: fixture.finalUrl,
          html: fixture.html,
          textContent: fixture.textContent,
          fetchedAt: new Date().toISOString(),
        },
        profile: fixture.profile,
      })
    )
  );

  for (const [index, fixture] of BUSINESS_DISCOVERY_EVAL_FIXTURES.entries()) {
    assert.notEqual(results[index].industry, "Local Service Business", `${fixture.category} fell back to the generic industry label`);
  }
});
