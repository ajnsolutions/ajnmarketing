/**
 * Release-candidate audit: exercises captureSnapshotForUser -- the same core business
 * logic analyticsCaptureForTenantTask wraps -- directly against the real test account,
 * bypassing Trigger.dev entirely. This is necessary because `trigger.dev dev start`
 * requires a registered Trigger.dev Cloud project (confirmed via --help: it needs a
 * project ref and defaults to connecting to api.trigger.dev even for "local" execution),
 * which was out of scope for this audit. Run twice to check for duplicate-row behavior
 * on the same day (the idempotency guarantee the Trigger.dev wrapper's idempotency key
 * is designed to enforce at the orchestration layer -- this checks the persistence
 * layer's own behavior independent of that).
 *
 * Run with: node --env-file=.env.local --import ./unit-tests/support/register.mjs \
 *   --experimental-strip-types scripts/audit/run-analytics-capture.ts <userId>
 */
import { createServiceRoleClient } from "../../lib/supabase/service.ts";
import { captureSnapshotForUser } from "../../lib/analytics/analyticsEngine.ts";

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error("Usage: run-analytics-capture.ts <userId>");
  process.exit(1);
}

async function main() {
  const supabase = createServiceRoleClient();

  console.log("=== CALL 1: captureSnapshotForUser ===");
  const call1 = await captureSnapshotForUser(USER_ID, supabase);
  console.log(JSON.stringify(
    {
      snapshotId: call1.snapshot?.id,
      snapshotDate: call1.snapshot?.snapshot_date,
      engagementScore: call1.snapshot?.engagement_score,
      googleViews: call1.snapshot?.google_views,
      postsPublished: call1.snapshot?.posts_published,
      contentPerformanceCount: call1.contentPerformanceCount,
    },
    null,
    2
  ));

  console.log("\n=== CALL 2 (immediate rerun, same day) ===");
  const call2 = await captureSnapshotForUser(USER_ID, supabase);
  console.log(JSON.stringify(
    { snapshotId: call2.snapshot?.id, sameIdAsCall1: call2.snapshot?.id === call1.snapshot?.id },
    null,
    2
  ));

  const { data: snapshotRows, error } = await supabase
    .from("analytics_snapshots")
    .select("id, snapshot_date")
    .eq("user_id", USER_ID)
    .eq("snapshot_date", call1.snapshot?.snapshot_date);
  console.log(
    `\nRows in analytics_snapshots for user+date after both calls: ${snapshotRows?.length} (expect 1, proving upsert-not-duplicate)`
  );
  if (error) console.error("query error:", error.message);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});
