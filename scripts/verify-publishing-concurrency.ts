/**
 * One-time / repeatable production-readiness check:
 * race two executePublishingJobById() calls against the same real publishing_jobs row.
 *
 * Safety:
 * - Uses the connected Supabase project via SUPABASE_SECRET_KEY (service role).
 * - Creates temporary approval/queue/job rows marked in metadata, then deletes them.
 * - Monkey-patches the GBP provider singleton so provider.publish never reaches Google.
 * - Does not activate Trigger.dev schedules.
 *
 * Usage (from repo root):
 *   set -a && source .env.local && set +a
 *   node --import ./unit-tests/support/register.mjs scripts/verify-publishing-concurrency.ts
 */
import { createServiceRoleClient } from "../lib/supabase/service.ts";
import { executePublishingJobById } from "../lib/publishing/publishingEngine.ts";
import { getPublishingProvider } from "../lib/publishing/providerRouter.ts";
import { claimPublishingJobForExecution } from "../lib/publishing/publishingHistory.ts";
import { PublishingJobStatuses } from "../lib/publishing/publishingTypes.ts";
import type { PublishProviderContext, PublishProviderResult } from "../lib/publishing/publishingTypes.ts";

const MARKER = "publishing-concurrency-verification";
const BLOCKED = "VERIFICATION_BLOCKED_NO_GOOGLE_PUBLISH";

type CleanupIds = {
  userId: string;
  approvalId: string | null;
  queueId: string | null;
  jobId: string | null;
};

function fail(message: string): never {
  console.error(`\nFAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

async function cleanup(supabase: ReturnType<typeof createServiceRoleClient>, ids: CleanupIds) {
  const { userId, jobId, queueId, approvalId } = ids;

  if (jobId) {
    await supabase.from("publishing_history").delete().eq("publishing_job_id", jobId);
    await supabase.from("audit_logs").delete().eq("entity_id", jobId);
    await supabase.from("publishing_jobs").delete().eq("id", jobId).eq("user_id", userId);
  }
  if (queueId) {
    await supabase.from("publishing_queue").delete().eq("id", queueId).eq("user_id", userId);
  }
  if (approvalId) {
    await supabase.from("content_approvals").delete().eq("id", approvalId).eq("user_id", userId);
  }
}

async function main() {
  const supabase = createServiceRoleClient();
  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    fail("ADMIN_USER_IDS is empty; need a real auth.users id to attach temp rows.");
  }

  const userId = adminIds[0]!;
  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .select("id, business_name")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (profileError || !profile) {
    fail(`No business_profiles row for admin user ${userId}: ${profileError?.message ?? "missing"}`);
  }

  const businessProfileId = profile.id as string;
  const ids: CleanupIds = { userId, approvalId: null, queueId: null, jobId: null };

  // Patch provider BEFORE any execute — singleton from getPublishingProvider.
  const provider = getPublishingProvider("google_business_profile");
  let providerPublishCalls = 0;
  const originalPublish = provider.publish.bind(provider);
  provider.publish = async (
    _context: PublishProviderContext
  ): Promise<PublishProviderResult> => {
    providerPublishCalls += 1;
    throw new Error(BLOCKED);
  };

  try {
    console.log("=== Publishing concurrency verification (real Supabase) ===");
    console.log(`userId=${userId}`);
    console.log(`businessProfileId=${businessProfileId} (${profile.business_name})`);
    console.log("Google publish: blocked via provider.publish monkey-patch\n");

    // --- Phase A: pure CAS via claimPublishingJobForExecution (setup job, reset, race) ---
    const { data: approval, error: approvalError } = await supabase
      .from("content_approvals")
      .insert({
        user_id: userId,
        business_profile_id: businessProfileId,
        content_type: "gbp_post",
        title: `[${MARKER}] temp approval`,
        content: "Temporary concurrency verification body — do not publish.",
        status: "approved",
        source: "content_generator",
        notes: MARKER,
      })
      .select("id")
      .single();

    if (approvalError || !approval) {
      fail(`Failed to create temp content_approvals: ${approvalError?.message}`);
    }
    ids.approvalId = approval.id;

    const { data: queueItem, error: queueError } = await supabase
      .from("publishing_queue")
      .insert({
        user_id: userId,
        business_profile_id: businessProfileId,
        content_approval_id: approval.id,
        platform: "google_business_profile",
        title: `[${MARKER}] temp queue`,
        content: "Temporary concurrency verification body — do not publish.",
        status: "ready",
      })
      .select("id")
      .single();

    if (queueError || !queueItem) {
      fail(`Failed to create temp publishing_queue: ${queueError?.message}`);
    }
    ids.queueId = queueItem.id;

    const { data: job, error: jobError } = await supabase
      .from("publishing_jobs")
      .insert({
        user_id: userId,
        business_profile_id: businessProfileId,
        content_id: queueItem.id,
        provider: "google_business_profile",
        status: "queued",
        metadata: { marker: MARKER, purpose: "concurrency-claim-cas" },
      })
      .select("*")
      .single();

    if (jobError || !job) {
      fail(`Failed to create temp publishing_jobs: ${jobError?.message}`);
    }
    ids.jobId = job.id;
    console.log(`Created temp job ${job.id}`);

    // Phase A — race raw CAS claims (re-seed status between phases)
    const casResults = await Promise.all([
      claimPublishingJobForExecution(supabase, userId, job.id, PublishingJobStatuses.QUEUED),
      claimPublishingJobForExecution(supabase, userId, job.id, PublishingJobStatuses.QUEUED),
    ]);
    const casWins = casResults.filter(Boolean);
    const casLosses = casResults.filter((r) => r === null);
    console.log("\n--- Phase A: claimPublishingJobForExecution CAS ---");
    console.log(`wins=${casWins.length} losses=${casLosses.length}`);
    if (casWins.length !== 1 || casLosses.length !== 1) {
      fail(`CAS race expected exactly 1 win / 1 loss, got wins=${casWins.length} losses=${casLosses.length}`);
    }

    // Reset job to queued for Phase B (full executePublishingJobById race)
    const { error: resetError } = await supabase
      .from("publishing_jobs")
      .update({
        status: "queued",
        last_error: null,
        retry_count: 0,
        scheduled_for: null,
        metadata: { marker: MARKER, purpose: "concurrency-executePublishingJobById" },
      })
      .eq("id", job.id)
      .eq("user_id", userId);

    if (resetError) {
      fail(`Failed to reset job for Phase B: ${resetError.message}`);
    }

    // Clear any history/audit left from Phase A (claim itself writes none; belt-and-suspenders)
    await supabase.from("publishing_history").delete().eq("publishing_job_id", job.id);
    await supabase.from("audit_logs").delete().eq("entity_id", job.id);

    providerPublishCalls = 0;

    console.log("\n--- Phase B: concurrent executePublishingJobById ---");
    const [resultA, resultB] = await Promise.all([
      executePublishingJobById(job.id, userId, supabase),
      executePublishingJobById(job.id, userId, supabase),
    ]);

    const results = [
      { caller: "A", ...resultA },
      { caller: "B", ...resultB },
    ];

    for (const r of results) {
      console.log(
        `caller=${r.caller} status=${r.job?.status ?? "null"} error=${r.error ?? "(none)"}`
      );
    }

    const winners = results.filter(
      (r) =>
        r.error?.includes(BLOCKED) ||
        r.error?.includes("Publishing failed") ||
        r.job?.status === "retrying" ||
        r.job?.status === "failed" ||
        r.job?.last_error?.includes(BLOCKED)
    );
    const losers = results.filter((r) =>
      (r.error ?? "").toLowerCase().includes("already being executed")
    );

    // Winner path: claimed → publish_started → provider threw BLOCKED → retrying/failed
    // Loser path: claim lost → "already being executed"
    if (losers.length !== 1) {
      fail(
        `Expected exactly 1 loser with "already being executed", got ${losers.length}: ${JSON.stringify(results)}`
      );
    }
    if (winners.length !== 1) {
      // Fallback: the non-loser is the winner
      const nonLosers = results.filter((r) => !losers.includes(r));
      if (nonLosers.length !== 1) {
        fail(`Expected exactly 1 winner execution path, got ${JSON.stringify(results)}`);
      }
    }

    if (providerPublishCalls !== 1) {
      fail(`Expected exactly 1 provider.publish call, got ${providerPublishCalls}`);
    }

    const { data: history, error: historyError } = await supabase
      .from("publishing_history")
      .select("id, action, status, created_at")
      .eq("publishing_job_id", job.id)
      .order("created_at", { ascending: true });

    if (historyError) {
      fail(`Failed to read publishing_history: ${historyError.message}`);
    }

    const { data: audits, error: auditError } = await supabase
      .from("audit_logs")
      .select("id, action, status, created_at")
      .eq("entity_id", job.id)
      .order("created_at", { ascending: true });

    if (auditError) {
      fail(`Failed to read audit_logs: ${auditError.message}`);
    }

    const startedHistory = (history ?? []).filter((h) => h.action === "publish_started");
    const startedAudits = (audits ?? []).filter((a) => a.action === "publishing.started");
    const retryOrFailHistory = (history ?? []).filter(
      (h) => h.action === "retry_scheduled" || h.action === "failed"
    );
    const retryOrFailAudits = (audits ?? []).filter(
      (a) => a.action === "publishing.retrying" || a.action === "publishing.failed"
    );

    console.log("\n--- History / audit ---");
    console.log(`publishing_history rows=${history?.length ?? 0}`, history);
    console.log(`audit_logs rows=${audits?.length ?? 0}`, audits);
    console.log(`providerPublishCalls=${providerPublishCalls}`);

    if (startedHistory.length !== 1) {
      fail(`Expected exactly 1 publish_started history row, got ${startedHistory.length}`);
    }
    if (startedAudits.length !== 1) {
      fail(`Expected exactly 1 publishing.started audit, got ${startedAudits.length}`);
    }
    if (retryOrFailHistory.length !== 1) {
      fail(
        `Expected exactly 1 retry_scheduled/failed history row, got ${retryOrFailHistory.length}`
      );
    }
    if (retryOrFailAudits.length !== 1) {
      fail(
        `Expected exactly 1 publishing.retrying/failed audit, got ${retryOrFailAudits.length}`
      );
    }

    const { data: finalJob } = await supabase
      .from("publishing_jobs")
      .select("id, status, retry_count, last_error, provider_post_id")
      .eq("id", job.id)
      .single();

    console.log("\n--- Final job ---", finalJob);
    if (finalJob?.provider_post_id) {
      fail("provider_post_id was set — a live publish may have occurred");
    }
    if (!String(finalJob?.last_error ?? "").includes(BLOCKED) &&
        !String(finalJob?.last_error ?? "").toLowerCase().includes("publishing failed")) {
      // toSafeUserErrorMessage may sanitize BLOCKED message
      console.log("(note) last_error may be sanitized:", finalJob?.last_error);
    }

    console.log("\nPASS: exactly one claim, one provider execution, one started+outcome history/audit pair; loser exited cleanly.");
  } finally {
    provider.publish = originalPublish;
    console.log("\n--- Cleanup ---");
    await cleanup(supabase, ids);
    // Confirm gone
    if (ids.jobId) {
      const { data: leftover } = await supabase
        .from("publishing_jobs")
        .select("id")
        .eq("id", ids.jobId)
        .maybeSingle();
      console.log(leftover ? `WARN: job still present ${ids.jobId}` : `Removed temp job ${ids.jobId}`);
    }
    if (ids.queueId) {
      const { data: leftover } = await supabase
        .from("publishing_queue")
        .select("id")
        .eq("id", ids.queueId)
        .maybeSingle();
      console.log(
        leftover ? `WARN: queue still present ${ids.queueId}` : `Removed temp queue ${ids.queueId}`
      );
    }
    if (ids.approvalId) {
      const { data: leftover } = await supabase
        .from("content_approvals")
        .select("id")
        .eq("id", ids.approvalId)
        .maybeSingle();
      console.log(
        leftover
          ? `WARN: approval still present ${ids.approvalId}`
          : `Removed temp approval ${ids.approvalId}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
