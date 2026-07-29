/**
 * Human-readable Internal Alpha eval report — prints, per business category
 * in the eval dataset, the actual industry classification, persona, business
 * summary, and growth opportunities the deterministic extraction path
 * produces today.
 *
 * This is the manual-review companion to
 * unit-tests/business-discovery-eval-regression.test.ts (which asserts the
 * same fixtures pass/fail automatically). Use this script when iterating on
 * heuristics to actually read the generated copy, not just see a checkmark.
 *
 * Run with:
 *   node --import ./unit-tests/support/register.mjs eval/business-discovery/runEval.ts
 */

import { PlaceholderWebsiteExtractor } from "@/lib/website-analysis/extractor";
import { BUSINESS_DISCOVERY_EVAL_FIXTURES } from "@/eval/business-discovery/fixtures";

async function main() {
  const extractor = new PlaceholderWebsiteExtractor();
  let passCount = 0;

  for (const fixture of BUSINESS_DISCOVERY_EVAL_FIXTURES) {
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

    const checks: Array<[string, boolean]> = [
      ["persona matches expectation", fixture.expect.personaMatches.test(result.customerPersona)],
      ["summary mentions expected services", fixture.expect.summaryMustMention.test(result.executiveSummary)],
      ["growth opportunities relevant", fixture.expect.growthOpportunityMustMention.test(result.highestRoiImprovements.join(" | "))],
      ["industry not generic fallback", result.industry !== "Local Service Business"],
    ];
    const allPass = checks.every(([, passed]) => passed);
    if (allPass) passCount += 1;

    console.log(`\n=== ${fixture.category} (${fixture.id}) — ${allPass ? "PASS" : "FAIL"} ===`);
    console.log(`Industry:        ${result.industry}`);
    console.log(`Persona:         ${result.customerPersona}`);
    console.log(`Summary:         ${result.executiveSummary}`);
    console.log(`Growth ideas:`);
    for (const idea of result.highestRoiImprovements) console.log(`  - ${idea}`);
    console.log(`Content ideas:`);
    for (const item of result.contentOpportunities) console.log(`  - ${item.title} (score ${item.seoScore}, ${item.competition} competition)`);
    for (const [label, passed] of checks) {
      if (!passed) console.log(`  ✗ FAILED CHECK: ${label}`);
    }
  }

  console.log(`\n${passCount}/${BUSINESS_DISCOVERY_EVAL_FIXTURES.length} fixtures passed all checks.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
