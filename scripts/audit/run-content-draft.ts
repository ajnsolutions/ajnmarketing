/**
 * Release-candidate audit: generates one real content draft from a real recommendation
 * (produced by run-marketing-pipeline.ts) using the same injectable core function the
 * production API route calls. Verifies: draft stored as pending, recommendation flips to
 * in_progress only after the draft insert, and an immediate rerun reuses the same draft
 * rather than creating a duplicate (the "reused" contract).
 *
 * Run with: node --env-file=.env.local --import ./unit-tests/support/register.mjs \
 *   --experimental-strip-types scripts/audit/run-content-draft.ts <userId> <recommendationId>
 */
import { createServiceRoleClient } from "../../lib/supabase/service.ts";
import { generateContentDraftForRecommendation } from "../../lib/marketing-decisions/create-content.ts";

const USER_ID = process.argv[2];
const RECOMMENDATION_ID = process.argv[3];
if (!USER_ID || !RECOMMENDATION_ID) {
  console.error("Usage: run-content-draft.ts <userId> <recommendationId>");
  process.exit(1);
}

async function main() {
  const supabase = createServiceRoleClient();

  console.log("=== CALL 1: generateContentDraftForRecommendation ===");
  const call1 = await generateContentDraftForRecommendation(USER_ID, RECOMMENDATION_ID, supabase);
  console.log(JSON.stringify(
    {
      error: call1.error,
      reused: call1.result?.reused,
      contentApprovalId: call1.result?.contentApproval.id,
      contentApprovalStatus: call1.result?.contentApproval.status,
      contentApprovalTitle: call1.result?.contentApproval.title,
      contentLength: call1.result?.contentApproval.content.length,
      recommendationStatusAfter: call1.result?.recommendation.status,
    },
    null,
    2
  ));

  if (!call1.result) {
    console.error("First call failed -- aborting rerun check.");
    process.exit(1);
  }

  console.log("\n=== CALL 2 (immediate rerun -- should reuse, not duplicate) ===");
  const call2 = await generateContentDraftForRecommendation(USER_ID, RECOMMENDATION_ID, supabase);
  console.log(JSON.stringify(
    {
      error: call2.error,
      reused: call2.result?.reused,
      contentApprovalId: call2.result?.contentApproval.id,
      sameIdAsCall1: call2.result?.contentApproval.id === call1.result.contentApproval.id,
    },
    null,
    2
  ));

  console.log("\n=== Full draft content (for prompt-grounding evidence review) ===");
  console.log(call1.result.contentApproval.content);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});
