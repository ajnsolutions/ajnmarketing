/**
 * Release-candidate audit: exercises evaluateOpportunitiesForUser and
 * runMarketingDecisionEngineForUser against the real (only) test account, using the
 * service-role client explicitly scoped to that account's userId -- the same injectable-
 * client pattern the codebase already uses for Trigger.dev tasks. This is the "safest
 * existing path" available since neither function has any UI/API/background-job trigger
 * (see the audit's pre-test investigation). Run twice back-to-back to prove idempotency
 * (no duplicate rows, correct status-preservation / supersede behavior on rerun).
 *
 * Run with: node --env-file=.env.local --import ./unit-tests/support/register.mjs \
 *   --experimental-strip-types scripts/audit/run-marketing-pipeline.ts
 */
import { createServiceRoleClient } from "../../lib/supabase/service.ts";
import { evaluateOpportunitiesForUser } from "../../lib/marketing-opportunities/detectionEngine.ts";
import { runMarketingDecisionEngineForUser } from "../../lib/marketing-decisions/service.ts";

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error("Usage: run-marketing-pipeline.ts <userId>");
  process.exit(1);
}

async function main() {
  const supabase = createServiceRoleClient();

  console.log("=== RUN 1: evaluateOpportunitiesForUser ===");
  const detection1 = await evaluateOpportunitiesForUser(USER_ID, supabase);
  console.log(JSON.stringify(
    {
      businessProfileId: detection1?.businessProfileId,
      expiredCount: detection1?.expiredCount,
      opportunityCount: detection1?.opportunities.length,
      opportunities: detection1?.opportunities.map((o) => ({
        id: o.id, category: o.category, severity: o.severity, status: o.status, dedupe_key: o.dedupe_key, title: o.title,
      })),
    },
    null,
    2
  ));

  if (!detection1) {
    console.error("No business profile found for this user -- aborting.");
    process.exit(1);
  }

  console.log("\n=== RUN 1: runMarketingDecisionEngineForUser ===");
  const decision1 = await runMarketingDecisionEngineForUser(USER_ID, detection1.businessProfileId, supabase);
  console.log(JSON.stringify(
    {
      supersededCount: decision1.supersededCount,
      evaluatedOpportunityCount: decision1.evaluatedOpportunityCount,
      recommendationCount: decision1.recommendations.length,
      recommendations: decision1.recommendations.map((r) => ({
        id: r.id, action_type: r.recommended_action_type, priority_score: r.priority_score,
        urgency: r.urgency, status: r.status, dedupe_key: r.dedupe_key,
      })),
    },
    null,
    2
  ));

  console.log("\n=== RUN 2 (rerun immediately, proving idempotency): evaluateOpportunitiesForUser ===");
  const detection2 = await evaluateOpportunitiesForUser(USER_ID, supabase);
  console.log(JSON.stringify(
    { expiredCount: detection2?.expiredCount, opportunityCount: detection2?.opportunities.length },
    null,
    2
  ));

  console.log("\n=== RUN 2: runMarketingDecisionEngineForUser ===");
  const decision2 = await runMarketingDecisionEngineForUser(USER_ID, detection1.businessProfileId, supabase);
  console.log(JSON.stringify(
    { supersededCount: decision2.supersededCount, recommendationCount: decision2.recommendations.length },
    null,
    2
  ));

  const idsRun1 = new Set(decision1.recommendations.map((r) => r.id));
  const idsRun2 = new Set(decision2.recommendations.map((r) => r.id));
  const sameIds = idsRun1.size === idsRun2.size && [...idsRun1].every((id) => idsRun2.has(id));
  console.log(`\nIdempotency check: run1 produced ${idsRun1.size} recommendation ids, run2 produced ${idsRun2.size}, identical set: ${sameIds}`);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});
