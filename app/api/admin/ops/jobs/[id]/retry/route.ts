import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { resetBackgroundJobForRetry } from "@/lib/background-jobs/persistence";
import { scheduleBackgroundJobProcessing } from "@/lib/background-jobs/scheduler";
import {
  classifyRetrySafety,
  RetrySafetyClassifications,
} from "@/lib/ops-dashboard/jobLifecycle";
import { logAuditEvent } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";

function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Admin-only, cross-tenant background job retry. Distinct from POST /api/jobs (PATCH
 * action=retry), which is customer-self-service and already scoped to the caller's
 * own jobs — this route exists for operators recovering *another* tenant's stuck or
 * failed job during pilot support, reusing the exact same safe transition primitive
 * (resetBackgroundJobForRetry only allows failed|cancelled -> queued) rather than a
 * new retry mechanism.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if ("error" in auth) return auth.error;

  if (!isSupabaseServiceRoleConfigured()) {
    return jsonNoStore({ error: "Service-role access is not configured." }, 503);
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return jsonNoStore({ error: "Job id is required." }, 400);
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — confirmOperatorReview simply defaults to false.
  }
  const confirmOperatorReview =
    typeof body === "object" && body !== null && (body as Record<string, unknown>).confirmOperatorReview === true;

  const supabase = createServiceRoleClient();

  const { data: existing, error: lookupError } = await supabase
    .from("background_jobs")
    .select("id, user_id, business_profile_id, job_type, status, attempts")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !existing) {
    return jsonNoStore({ error: "Job not found." }, 404);
  }

  const safety = classifyRetrySafety({
    job_type: existing.job_type,
    status: existing.status,
    attempts: existing.attempts,
  });

  if (safety === RetrySafetyClassifications.NOT_RETRYABLE) {
    return jsonNoStore({ error: "This job is not in a retryable state.", retrySafety: safety }, 409);
  }

  if (
    safety === RetrySafetyClassifications.REQUIRES_OPERATOR_REVIEW &&
    !confirmOperatorReview
  ) {
    return jsonNoStore(
      {
        error:
          "This job requires operator review before retrying (possible duplicate side effect or exhausted automatic retries). Resubmit with confirmOperatorReview: true after verifying no duplicate work will occur.",
        retrySafety: safety,
      },
      409
    );
  }

  const job = await resetBackgroundJobForRetry(supabase, existing.user_id, id);

  if (!job) {
    // Another actor already retried/changed this job — idempotent no-op, not an error.
    return jsonNoStore({ retried: false, message: "Job is no longer in a retryable state (already retried or changed)." });
  }

  await logAuditEvent(supabase, {
    userId: job.user_id,
    businessProfileId: job.business_profile_id,
    action: AuditActions.BACKGROUND_JOB_QUEUED,
    entityType: "background_job",
    entityId: job.id,
    status: "started",
    metadata: {
      jobType: job.job_type,
      retry: true,
      triggeredByAdmin: auth.user.id,
      retrySafety: safety,
    },
  });

  scheduleBackgroundJobProcessing(job.id);

  return jsonNoStore({ retried: true, job: { id: job.id, status: job.status, jobType: job.job_type } });
}
